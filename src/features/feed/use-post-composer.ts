import { useEffect, useRef, useState } from 'react'
import { useMutation } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { POST_IMAGE_LIMIT, createPostInputSchema, type Visibility } from '../social/shared/social-contracts'
import { processPostImage } from './process-post-image'

export type PendingPostImage = {
  localId: string
  imageId: string
  previewUrl: string
  status: 'ready' | 'processing' | 'uploading' | 'error'
  error: string | null
  ownedPending: boolean
}

interface UploadOperation {
  localId: string
  previewUrl: string
  controller: AbortController
  canceled: boolean
  attached: boolean
  cleaned: boolean
  imageId: string | null
  storageId: string | null
  registered: boolean
  responseReceived: boolean
  finished: Promise<void> | null
  cleanup: Promise<void> | null
}

const newId = (): string => crypto.randomUUID()
const canceledError = (): Error => new DOMException('Image upload canceled.', 'AbortError')
const assertActive = (operation: UploadOperation): void => { if (operation.canceled) throw canceledError() }
const cancelUpload = (operation: UploadOperation): void => {
  operation.canceled = true
  if (!operation.responseReceived) operation.controller.abort()
}

/** Owns Post mutations and cancellation-safe upload cleanup. */
export function usePostComposer(initial: { text: string; imageIds: string[]; imageUrls: string[]; hasSpoiler: boolean; visibility: Visibility }) {
  const generateUploadUrl = useMutation(api.posts.generateUploadUrl)
  const registerImage = useMutation(api.posts.registerImage)
  const discardImage = useMutation(api.posts.discardImage)
  const create = useMutation(api.posts.create)
  const update = useMutation(api.posts.update)
  const initialImages = (): PendingPostImage[] => initial.imageIds.map((imageId, index) => ({ localId: `attached:${imageId}`, imageId, previewUrl: initial.imageUrls[index] ?? '', status: 'ready', error: null, ownedPending: false }))
  const [images, setImages] = useState<PendingPostImage[]>(initialImages)
  const imagesRef = useRef(images)
  const operationsRef = useRef(new Map<string, UploadOperation>())
  const operationId = useRef(newId())
  const submittingRef = useRef(false)
  const mountedRef = useRef(true)
  const [text, setText] = useState(initial.text)
  const [hasSpoiler, setHasSpoiler] = useState(initial.hasSpoiler)
  const [visibility, setVisibility] = useState<Visibility>(initial.visibility)
  const [submitting, setSubmitting] = useState(false)
  const changeImages = (change: (current: PendingPostImage[]) => PendingPostImage[]): void => {
    if (mountedRef.current) setImages(change)
  }

  const cleanupOperation = async (operation: UploadOperation): Promise<void> => {
    if (operation.attached || operation.cleaned || !operation.imageId) return
    if (operation.cleanup) return await operation.cleanup
    const cleanup = discardImage({ imageId: operation.imageId as Id<'postImages'>, ...(!operation.registered && operation.storageId ? { storageId: operation.storageId as Id<'_storage'> } : {}) }).then(() => { operation.cleaned = true })
    operation.cleanup = cleanup
    try { await cleanup }
    finally { if (!operation.cleaned) operation.cleanup = null }
  }

  const finishCancellation = async (operation: UploadOperation, updateImages: boolean): Promise<void> => {
    cancelUpload(operation)
    if (operation.finished) await operation.finished
    await cleanupOperation(operation)
    URL.revokeObjectURL(operation.previewUrl)
    operationsRef.current.delete(operation.localId)
    if (updateImages) changeImages((current) => current.filter((image) => image.localId !== operation.localId))
  }

  useEffect(() => { imagesRef.current = images }, [images])
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      const operations = [...operationsRef.current.values()].filter((operation) => !operation.attached)
      operations.forEach((operation) => {
        cancelUpload(operation)
        void finishCancellation(operation, false).catch((cause: unknown) => { console.error('Pending Post image cleanup failed during unmount.', cause) })
      })
    }
  }, [])

  const upload = async (file: File): Promise<void> => {
    if (submittingRef.current) throw new Error('Wait for Post submission to finish.')
    const attachedCount = imagesRef.current.filter((image) => !image.ownedPending).length
    if (attachedCount + operationsRef.current.size >= POST_IMAGE_LIMIT) throw new Error('A Post can include up to four images.')
    const localId = newId()
    const previewUrl = URL.createObjectURL(file)
    const operation: UploadOperation = { localId, previewUrl, controller: new AbortController(), canceled: false, attached: false, cleaned: false, imageId: null, storageId: null, registered: false, responseReceived: false, finished: null, cleanup: null }
    operationsRef.current.set(localId, operation)
    changeImages((current) => [...current, { localId, imageId: localId, previewUrl, status: 'processing', error: null, ownedPending: true }])
    operation.finished = (async () => {
      try {
        const processed = await processPostImage(file); assertActive(operation)
        changeImages((current) => current.map((image) => image.localId === localId ? { ...image, status: 'uploading' } : image))
        const claimId = newId()
        const claim = await generateUploadUrl({ claimId }); operation.imageId = String(claim.imageId); assertActive(operation)
        const response = await fetch(claim.uploadUrl, { method: 'POST', headers: { 'Content-Type': processed.mimeType }, body: processed.blob, signal: operation.controller.signal })
        operation.responseReceived = true
        if (!response.ok) throw new Error(`Image upload failed (${response.status}).`)
        const body = await response.json() as { storageId?: unknown }
        if (typeof body.storageId !== 'string' || body.storageId.length === 0) throw new Error('Image upload returned no storage ID.')
        operation.storageId = body.storageId
        assertActive(operation)
        const registered = await registerImage({ claimId, storageId: body.storageId as Id<'_storage'>, mimeType: processed.mimeType, size: processed.size, width: processed.width, height: processed.height })
        operation.imageId = String(registered); operation.registered = true; assertActive(operation)
        changeImages((current) => current.map((image) => image.localId === localId ? { ...image, imageId: String(registered), status: 'ready' } : image))
      } catch (cause) {
        let message = cause instanceof Error ? cause.message : 'Image upload failed.'
        try { await cleanupOperation(operation) } catch (cleanupCause) { message = `${message} Cleanup failed: ${cleanupCause instanceof Error ? cleanupCause.message : 'pending image could not be discarded.'}` }
        if (!operation.canceled) changeImages((current) => current.map((image) => image.localId === localId ? { ...image, status: 'error', error: message } : image))
      }
    })()
    await operation.finished
  }

  const cancelOperation = async (operation: UploadOperation): Promise<void> => await finishCancellation(operation, true)

  const remove = async (index: number): Promise<void> => {
    if (submittingRef.current) throw new Error('Wait for Post submission to finish.')
    const image = imagesRef.current[index]
    if (!image) throw new Error('Post image no longer exists.')
    if (!image.ownedPending) { changeImages((current) => current.filter((_, itemIndex) => itemIndex !== index)); return }
    const operation = operationsRef.current.get(image.localId)
    if (!operation) throw new Error('Pending image operation is unavailable.')
    await cancelOperation(operation)
  }

  const move = (index: number, direction: -1 | 1): void => {
    if (submittingRef.current) throw new Error('Wait for Post submission to finish.')
    changeImages((current) => { const target = index + direction; if (target < 0 || target >= current.length) return current; const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next })
  }

  const discardAll = async (): Promise<void> => {
    const operations = [...operationsRef.current.values()].filter((operation) => !operation.attached)
    operations.forEach(cancelUpload)
    await Promise.all(operations.map(cancelOperation))
  }

  const submit = async (postId: string | null): Promise<void> => {
    if (submittingRef.current) throw new Error('Post submission is already running.')
    const currentImages = imagesRef.current
    if (currentImages.some((image) => image.status === 'error')) throw new Error('Remove failed images before publishing.')
    if (currentImages.some((image) => image.status !== 'ready')) throw new Error('Wait for every image upload to finish.')
    const imageIds = currentImages.map((image) => image.imageId)
    const input = createPostInputSchema.parse({ requestId: operationId.current, text, imageIds, hasSpoiler, visibility })
    submittingRef.current = true; if (mountedRef.current) setSubmitting(true)
    try {
      if (postId) await update({ postId: postId as Id<'posts'>, ...input, imageIds: imageIds as Id<'postImages'>[] })
      else await create({ ...input, imageIds: imageIds as Id<'postImages'>[] })
      operationsRef.current.forEach((operation) => { operation.attached = true; URL.revokeObjectURL(operation.previewUrl) })
      operationsRef.current.clear(); changeImages(() => []); if (mountedRef.current) { setText(''); setHasSpoiler(false) }; operationId.current = newId()
    } catch (cause) { await discardAll(); throw cause }
    finally { submittingRef.current = false; if (mountedRef.current) setSubmitting(false) }
  }

  const dirty = text !== initial.text || images.map((image) => image.imageId).join('|') !== initial.imageIds.join('|') || hasSpoiler !== initial.hasSpoiler || visibility !== initial.visibility
  return { text, setText, images, hasSpoiler, setHasSpoiler, visibility, setVisibility, submitting, dirty, upload, remove, move, submit, discardAll }
}
