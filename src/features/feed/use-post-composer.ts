import { useEffect, useRef, useState } from 'react'
import { useMutation } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { POST_IMAGE_LIMIT, createPostInputSchema, type Visibility } from '../social/shared/social-contracts'
import { processPostImage } from './process-post-image'

export type PendingPostImage = {
  imageId: string
  previewUrl: string
  storageId: string | null
  status: 'ready' | 'processing' | 'uploading' | 'error'
  error: string | null
  ownedPending: boolean
}

const requestId = (): string => crypto.randomUUID()

/** Owns Post mutation, upload, retry-ID, preview, and pending cleanup state. */
export function usePostComposer(initial: { text: string; imageIds: string[]; imageUrls: string[]; hasSpoiler: boolean; visibility: Visibility }) {
  const generateUploadUrl = useMutation(api.posts.generateUploadUrl)
  const registerImage = useMutation(api.posts.registerImage)
  const discardImage = useMutation(api.posts.discardImage)
  const create = useMutation(api.posts.create)
  const update = useMutation(api.posts.update)
  const [images, setImages] = useState<PendingPostImage[]>(() => initial.imageIds.map((imageId, index) => ({ imageId, previewUrl: initial.imageUrls[index] ?? '', storageId: null, status: 'ready', error: null, ownedPending: false })))
  const imagesRef = useRef(images)
  const operationId = useRef(requestId())
  const [text, setText] = useState(initial.text)
  const [hasSpoiler, setHasSpoiler] = useState(initial.hasSpoiler)
  const [visibility, setVisibility] = useState<Visibility>(initial.visibility)
  const [submitting, setSubmitting] = useState(false)
  useEffect(() => { imagesRef.current = images }, [images])
  useEffect(() => () => { imagesRef.current.filter((image) => image.ownedPending).forEach((image) => URL.revokeObjectURL(image.previewUrl)) }, [])

  const upload = async (file: File): Promise<void> => {
    if (imagesRef.current.length >= POST_IMAGE_LIMIT) throw new Error('A Post can include up to four images.')
    const previewUrl = URL.createObjectURL(file)
    const localId = requestId()
    const pending: PendingPostImage = { imageId: localId, previewUrl, storageId: null, status: 'processing', error: null, ownedPending: true }
    setImages((current) => [...current, pending])
    let claimedImageId: string | null = null
    let storageId: string | null = null
    try {
      const processed = await processPostImage(file)
      setImages((current) => current.map((image) => image.imageId === localId ? { ...image, status: 'uploading' } : image))
      const claimId = requestId()
      const claim = await generateUploadUrl({ claimId })
      claimedImageId = String(claim.imageId)
      const response = await fetch(claim.uploadUrl, { method: 'POST', headers: { 'Content-Type': processed.mimeType }, body: processed.blob })
      if (!response.ok) throw new Error(`Image upload failed (${response.status}).`)
      const body = await response.json() as { storageId?: unknown }
      if (typeof body.storageId !== 'string' || body.storageId.length === 0) throw new Error('Image upload returned no storage ID.')
      storageId = body.storageId
      const registered = await registerImage({ claimId, storageId: storageId as Id<'_storage'>, mimeType: processed.mimeType, size: processed.size, width: processed.width, height: processed.height })
      setImages((current) => current.map((image) => image.imageId === localId ? { ...image, imageId: String(registered), storageId, status: 'ready' } : image))
    } catch (cause) {
      let message = cause instanceof Error ? cause.message : 'Image upload failed.'
      if (claimedImageId) {
        try { await discardImage({ imageId: claimedImageId as Id<'postImages'>, ...(storageId ? { storageId: storageId as Id<'_storage'> } : {}) }) }
        catch (cleanupCause) { message = `${message} Cleanup failed: ${cleanupCause instanceof Error ? cleanupCause.message : 'pending image could not be discarded.'}` }
      }
      setImages((current) => current.map((image) => image.imageId === localId ? { ...image, status: 'error', error: message } : image))
    }
  }

  const remove = async (index: number): Promise<void> => {
    const image = imagesRef.current[index]
    if (!image) return
    if (image.status === 'ready' && image.ownedPending) await discardImage({ imageId: image.imageId as Id<'postImages'> })
    if (image.ownedPending) URL.revokeObjectURL(image.previewUrl)
    setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  const move = (index: number, direction: -1 | 1): void => setImages((current) => {
    const target = index + direction
    if (target < 0 || target >= current.length) return current
    const next = [...current]
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
  })

  const discardAll = async (): Promise<void> => {
    const pendingIndexes = imagesRef.current.map((image, index) => image.ownedPending ? index : -1).filter((index) => index >= 0).reverse()
    for (const index of pendingIndexes) await remove(index)
  }

  const submit = async (postId: string | null): Promise<void> => {
    const imageIds = images.filter((image) => image.status === 'ready').map((image) => image.imageId)
    const input = createPostInputSchema.parse({ requestId: operationId.current, text, imageIds, hasSpoiler, visibility })
    setSubmitting(true)
    try {
      if (postId) await update({ postId: postId as Id<'posts'>, ...input, imageIds: imageIds as Id<'postImages'>[] })
      else await create({ ...input, imageIds: imageIds as Id<'postImages'>[] })
      images.filter((image) => image.ownedPending).forEach((image) => URL.revokeObjectURL(image.previewUrl))
      setImages([]); setText(''); setHasSpoiler(false); operationId.current = requestId()
    } catch (cause) {
      await discardAll()
      throw cause
    } finally { setSubmitting(false) }
  }

  const dirty = text !== initial.text || images.map((image) => image.imageId).join('|') !== initial.imageIds.join('|') || hasSpoiler !== initial.hasSpoiler || visibility !== initial.visibility
  return { text, setText, images, hasSpoiler, setHasSpoiler, visibility, setVisibility, submitting, dirty, upload, remove, move, submit, discardAll }
}
