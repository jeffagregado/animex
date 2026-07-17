import { useCallback, useEffect, useRef, useState } from 'react'
import { useConvex, useMutation } from 'convex/react'
import { makeFunctionReference } from 'convex/server'
import Cropper, { type Area, type MediaSize, type Point } from 'react-easy-crop'

import { Button } from '#/components/ui/button'
import type { ProfileMediaKind } from '../shared/profile-contracts'
import {
  cropProfileMedia,
  validateProfileMediaSource,
} from './profile-media-canvas'

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
}

const label: Record<ProfileMediaKind, string> = {
  avatar: 'avatar',
  banner: 'banner',
}

const explicitMessage = (error: unknown): string => (
  error instanceof Error ? error.message : 'PROFILE_MEDIA_INVALID'
)

const readStorageId = async (response: Response): Promise<string> => {
  if (!response.ok) {
    throw new Error(`Profile media upload failed with HTTP ${response.status}.`)
  }
  let value: unknown
  try {
    value = await response.json()
  } catch (error) {
    throw new Error('Profile media upload returned invalid JSON.', { cause: error })
  }
  if (
    typeof value !== 'object'
    || value === null
    || Object.keys(value).length !== 1
    || !('storageId' in value)
    || typeof value.storageId !== 'string'
    || value.storageId.length === 0
  ) throw new Error('Profile media upload returned an invalid storage ID.')
  return value.storageId
}

/** Owns one guided Profile media selection and independent commit lifecycle. */
export function ProfileImageCropper({
  active,
  currentUrl,
  disabled,
  kind,
  onBusyChange,
}: ProfileImageCropperProps) {
  const generateUploadUrl = useMutation(generateRef)
  const registerPending = useMutation(registerRef)
  const convex = useConvex()
  const removeMedia = useMutation(removeRef)
  const inputRef = useRef<HTMLInputElement>(null)
  const mountedRef = useRef(true)
  const tokenRef = useRef(0)
  const urlRef = useRef<string | null>(null)
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [cropPixels, setCropPixels] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const [mediaReady, setMediaReady] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const revokeSelection = useCallback((): void => {
    tokenRef.current += 1
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    setSourceUrl(null)
    setCropPixels(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setMediaReady(false)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      tokenRef.current += 1
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [])

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

  const applyCrop = async (): Promise<void> => {
    if (!sourceUrl || !cropPixels || busy) return
    const token = ++tokenRef.current
    setBusy(true)
    setMessage(null)
    setStatus(`Preparing ${label[kind]}…`)
    try {
      const blob = await cropProfileMedia(sourceUrl, cropPixels, kind)
      if (!mountedRef.current || tokenRef.current !== token) return
      setStatus(`Uploading ${label[kind]}…`)
      const uploadUrl = await generateUploadUrl({ kind })
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'image/webp' },
        body: blob,
      })
      const storageId = await readStorageId(response)
      await registerPending({ kind, storageId })
      await convex.action(finalizeRef, { kind, storageId })
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
      finish(token, `${kind === 'avatar' ? 'Avatar' : 'Banner'} removed.`)
    } catch (error) {
      fail(token, error)
    }
  }

  const mediaLoaded = (_size: MediaSize): void => {
    setMediaReady(true)
    setMessage(null)
  }

  const blocked = disabled || busy
  const title = kind === 'avatar' ? 'Avatar' : 'Banner'
  return (
    <section
      aria-busy={busy}
      className="rounded-xl border border-white/10 bg-slate-950/40 p-3"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold">{title}</h3>
        {currentUrl ? (
          <img
            alt={`Current ${label[kind]}`}
            className={kind === 'avatar'
              ? 'size-12 rounded-full object-cover'
              : 'h-12 w-24 rounded object-cover'}
            src={currentUrl}
          />
        ) : <span className="text-xs text-muted-foreground">Not set</span>}
      </div>
      <input
        ref={inputRef}
        accept="image/jpeg,image/png,image/webp"
        aria-label={`Choose ${label[kind]} image`}
        className="sr-only"
        disabled={blocked}
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void selectFile(file)
        }}
      />
      {sourceUrl ? (
        <>
          <div className={`relative mt-3 overflow-hidden rounded-lg bg-black ${
            kind === 'avatar' ? 'h-64' : 'h-48'
          }`}>
            <Cropper
              aspect={kind === 'avatar' ? 1 : 4}
              crop={crop}
              cropShape={kind === 'avatar' ? 'round' : 'rect'}
              image={sourceUrl}
              keyboardStep={2}
              mediaProps={{
                alt: `${title} crop source`,
                onError: () => setMessage('PROFILE_MEDIA_INVALID'),
              }}
              restrictPosition
              roundCropAreaPixels
              zoom={zoom}
              zoomWithScroll
              onCropChange={setCrop}
              onCropComplete={(_area, pixels) => setCropPixels(pixels)}
              onMediaLoaded={mediaLoaded}
              onZoomChange={setZoom}
            />
          </div>
          <label className="mt-3 flex flex-col gap-1 text-sm font-bold">
            Zoom {title.toLowerCase()}
            <input
              aria-label={`Zoom ${label[kind]}`}
              disabled={blocked}
              max="3"
              min="1"
              step="0.01"
              type="range"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
          </label>
        </>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          disabled={blocked}
          onClick={() => inputRef.current?.click()}
          type="button"
          variant="outline"
        >
          {sourceUrl ? `Replace ${label[kind]}` : `Change ${label[kind]}`}
        </Button>
        {sourceUrl ? (
          <Button
            disabled={blocked}
            onClick={revokeSelection}
            type="button"
            variant="outline"
          >
            Cancel crop
          </Button>
        ) : (
          <Button
            disabled={blocked || !currentUrl}
            onClick={() => void remove()}
            type="button"
            variant="outline"
          >
            Remove {label[kind]}
          </Button>
        )}
      </div>
      {sourceUrl ? (
        <Button
          className="mt-2 w-full"
          disabled={blocked || !mediaReady || !cropPixels}
          onClick={() => void applyCrop()}
          type="button"
        >
          {busy ? `Applying ${label[kind]}…` : `Apply ${label[kind]} crop`}
        </Button>
      ) : null}
      {status ? <p aria-live="polite" className="mt-2 text-sm">{status}</p> : null}
      {message ? (
        <div className="mt-2" role="alert">
          <p className="text-sm text-destructive">{message}</p>
          {sourceUrl ? (
            <Button
              className="mt-2"
              disabled={blocked}
              onClick={() => void applyCrop()}
              type="button"
              variant="outline"
            >
              Retry {label[kind]}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
