import { useCallback, useEffect, useRef, useState } from 'react'
import { useConvex, useMutation } from 'convex/react'
import { makeFunctionReference } from 'convex/server'
import { type Area, type MediaSize, type Point } from 'react-easy-crop'
import { z } from 'zod'

import type { ProfileMediaKind } from '../shared/profile-contracts'
import {
  cropProfileMedia,
  validateProfileMediaSource,
} from './profile-media-canvas'
import { ProfileImageCropperView } from './profile-image-cropper-view'

type GenerateArgs = { kind: ProfileMediaKind }
type StorageArgs = GenerateArgs & { storageId: string }

const generateRef = makeFunctionReference<'mutation', GenerateArgs, string>(
  'profileMedia:generateUploadUrl',
)
const registerRef = makeFunctionReference<'mutation', StorageArgs, null>(
  'profileMedia:registerPending',
)
const finalizeRef = makeFunctionReference<'action', StorageArgs, null>(
  'profileMedia:finalize',
)
const removeRef = makeFunctionReference<'mutation', GenerateArgs, null>(
  'profileMedia:remove',
)

interface ProfileImageCropperProps {
  active: boolean
  currentUrl: string | null
  disabled: boolean
  kind: ProfileMediaKind
  onBusyChange: (busy: boolean) => void
  onProfileChanged: () => Promise<void>
}

const label: Record<ProfileMediaKind, string> = {
  avatar: 'avatar',
  banner: 'banner',
}
const storageResponseSchema = z.object({
  storageId: z.string().min(1),
}).strict()

const explicitMessage = (error: unknown): string => (
  error instanceof Error ? error.message : 'PROFILE_MEDIA_INVALID'
)

const readStorageId = async (
  response: Response,
  current: () => boolean,
): Promise<string | null> => {
  if (!response.ok) {
    throw new Error(`Profile media upload failed with HTTP ${response.status}.`)
  }
  let value: unknown
  try {
    value = await response.json()
  } catch (error) {
    if (!current()) return null
    throw new Error('Profile media upload returned invalid JSON.', { cause: error })
  }
  if (!current()) return null
  const result = storageResponseSchema.safeParse(value)
  if (!result.success) {
    throw new Error('Profile media upload returned an invalid storage ID.')
  }
  return result.data.storageId
}

const useProfileMediaServices = () => ({
  convex: useConvex(),
  generateUploadUrl: useMutation(generateRef),
  registerPending: useMutation(registerRef),
  removeMedia: useMutation(removeRef),
})

const useCropEditorState = () => {
  const inputRef = useRef<HTMLInputElement>(null)
  const urlRef = useRef<string | null>(null)
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [cropPixels, setCropPixels] = useState<Area | null>(null)
  const [mediaReady, setMediaReady] = useState(false)
  return {
    crop,
    cropPixels,
    inputRef,
    mediaReady,
    setCrop,
    setCropPixels,
    setMediaReady,
    setSourceUrl,
    setZoom,
    sourceUrl,
    urlRef,
    zoom,
  }
}

function useProfileImageCropper({
  active,
  kind,
  onBusyChange,
  onProfileChanged,
}: Pick<
  ProfileImageCropperProps,
  'active' | 'kind' | 'onBusyChange' | 'onProfileChanged'
>) {
  const {
    convex,
    generateUploadUrl,
    registerPending,
    removeMedia,
  } = useProfileMediaServices()
  const mountedRef = useRef(true)
  const tokenRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const {
    crop,
    cropPixels,
    inputRef,
    mediaReady,
    setCrop,
    setCropPixels,
    setMediaReady,
    setSourceUrl,
    setZoom,
    sourceUrl,
    urlRef,
    zoom,
  } = useCropEditorState()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const stopOperation = useCallback((): void => {
    tokenRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const revokeSelection = useCallback((): void => {
    stopOperation()
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    setSourceUrl(null)
    setCropPixels(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setMediaReady(false)
  }, [stopOperation])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stopOperation()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [stopOperation])

  useEffect(() => {
    if (!active && !busy) revokeSelection()
  }, [active, busy, revokeSelection])

  useEffect(() => onBusyChange(busy), [busy, onBusyChange])

  const selectFile = async (file: File): Promise<void> => {
    revokeSelection()
    const token = tokenRef.current
    setMessage(null)
    setStatus(null)
    try {
      await validateProfileMediaSource(file)
      if (!mountedRef.current || tokenRef.current !== token) return
      const url = URL.createObjectURL(file)
      urlRef.current = url
      setSourceUrl(url)
    } catch (error) {
      if (!mountedRef.current || tokenRef.current !== token) return
      setMessage(explicitMessage(error))
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const finish = (token: number, nextStatus: string): void => {
    if (!mountedRef.current || tokenRef.current !== token) return
    setBusy(false)
    setMessage(null)
    setStatus(nextStatus)
    revokeSelection()
  }

  const fail = (token: number, error: unknown): void => {
    if (!mountedRef.current || tokenRef.current !== token) return
    setBusy(false)
    setMessage(explicitMessage(error))
  }

  const prepareCrop = async (
    current: () => boolean,
    selectedUrl: string,
    selectedCrop: Area,
  ): Promise<{ controller: AbortController; storageId: string } | null> => {
    const blob = await cropProfileMedia(selectedUrl, selectedCrop, kind)
    if (!current()) return null
    setStatus(`Uploading ${label[kind]}…`)
    const uploadUrl = await generateUploadUrl({ kind })
    if (!current()) return null
    const controller = new AbortController()
    abortRef.current = controller
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'image/webp' },
      body: blob,
      signal: controller.signal,
    })
    if (!current()) return null
    const storageId = await readStorageId(response, current)
    return storageId === null ? null : { controller, storageId }
  }

  const saveCrop = async (
    current: () => boolean,
    storageId: string,
  ): Promise<boolean> => {
    await registerPending({ kind, storageId })
    if (!current()) return false
    await convex.action(finalizeRef, { kind, storageId })
    return current()
  }

  const applyCrop = async (): Promise<void> => {
    if (busy) return
    if (!sourceUrl) return
    if (!cropPixels) return
    abortRef.current?.abort()
    abortRef.current = null
    const token = ++tokenRef.current
    const current = (): boolean => (
      mountedRef.current && tokenRef.current === token
    )
    setBusy(true)
    setMessage(null)
    setStatus(`Preparing ${label[kind]}…`)
    try {
      const prepared = await prepareCrop(current, sourceUrl, cropPixels)
      if (!prepared) return
      const saved = await saveCrop(current, prepared.storageId)
      if (!saved) return
      await onProfileChanged()
      if (!current()) return
      if (abortRef.current === prepared.controller) abortRef.current = null
      finish(token, `${kind === 'avatar' ? 'Avatar' : 'Banner'} updated.`)
    } catch (error) {
      fail(token, error)
    }
  }

  const remove = async (): Promise<void> => {
    if (busy) return
    const token = ++tokenRef.current
    setBusy(true)
    setMessage(null)
    setStatus(`Removing ${label[kind]}…`)
    try {
      await removeMedia({ kind })
      await onProfileChanged()
      finish(token, `${kind === 'avatar' ? 'Avatar' : 'Banner'} removed.`)
    } catch (error) {
      fail(token, error)
    }
  }

  const mediaLoaded = (_size: MediaSize): void => {
    setMediaReady(true)
    setMessage(null)
  }

  return {
    applyCrop,
    busy,
    crop,
    cropPixels,
    inputRef,
    mediaLoaded,
    mediaReady,
    message,
    remove,
    revokeSelection,
    selectFile,
    sourceUrl,
    status,
    zoom,
    setCrop,
    setCropPixels,
    setMessage,
    setZoom,
  }
}

/** Owns one guided Profile media selection and independent commit lifecycle. */
export function ProfileImageCropper({
  active,
  currentUrl,
  disabled,
  kind,
  onBusyChange,
  onProfileChanged,
}: ProfileImageCropperProps) {
  const model = useProfileImageCropper({
    active,
    kind,
    onBusyChange,
    onProfileChanged,
  })
  return (
    <ProfileImageCropperView
      currentUrl={currentUrl}
      disabled={disabled}
      kind={kind}
      model={model}
    />
  )
}
