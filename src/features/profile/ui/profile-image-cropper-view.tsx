import type { RefObject } from 'react'
import Cropper, { type Area, type MediaSize, type Point } from 'react-easy-crop'

import { Button } from '#/components/ui/button'
import type { ProfileMediaKind } from '../shared/profile-contracts'

const label: Record<ProfileMediaKind, string> = {
  avatar: 'avatar',
  banner: 'banner',
}

export interface ProfileImageCropperModel {
  applyCrop: () => Promise<void>
  busy: boolean
  crop: Point
  cropPixels: Area | null
  inputRef: RefObject<HTMLInputElement | null>
  mediaLoaded: (size: MediaSize) => void
  mediaReady: boolean
  message: string | null
  remove: () => Promise<void>
  revokeSelection: () => void
  selectFile: (file: File) => Promise<void>
  setCrop: (crop: Point) => void
  setCropPixels: (crop: Area) => void
  setMessage: (message: string | null) => void
  setZoom: (zoom: number) => void
  sourceUrl: string | null
  status: string | null
  zoom: number
}

interface ProfileImageCropperViewProps {
  currentUrl: string | null
  disabled: boolean
  kind: ProfileMediaKind
  model: ProfileImageCropperModel
}

/** Renders one Profile media cropper from its lifecycle model. */
export function ProfileImageCropperView({
  currentUrl,
  disabled,
  kind,
  model,
}: ProfileImageCropperViewProps) {
  const blocked = disabled || model.busy
  const title = kind === 'avatar' ? 'Avatar' : 'Banner'
  return (
    <section
      aria-busy={model.busy}
      className="rounded-xl border border-white/10 bg-slate-950/40 p-3"
    >
      <CurrentProfileMedia currentUrl={currentUrl} kind={kind} title={title} />
      <input
        ref={model.inputRef}
        accept="image/jpeg,image/png,image/webp"
        aria-label={`Choose ${label[kind]} image`}
        className="sr-only"
        disabled={blocked}
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void model.selectFile(file)
        }}
      />
      <ProfileCropEditor
        blocked={blocked}
        kind={kind}
        model={model}
        title={title}
      />
      <ProfileMediaActions
        blocked={blocked}
        currentUrl={currentUrl}
        kind={kind}
        model={model}
      />
      <ProfileMediaFeedback blocked={blocked} kind={kind} model={model} />
    </section>
  )
}

function CurrentProfileMedia({
  currentUrl,
  kind,
  title,
}: { currentUrl: string | null; kind: ProfileMediaKind; title: string }) {
  return (
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
  )
}

function ProfileCropEditor({
  blocked,
  kind,
  model,
  title,
}: { blocked: boolean; kind: ProfileMediaKind; model: ProfileImageCropperModel; title: string }) {
  if (!model.sourceUrl) return null
  return (
    <>
      <div className={`relative mt-3 overflow-hidden rounded-lg bg-black ${
        kind === 'avatar' ? 'h-64' : 'h-48'
      }`}>
        <Cropper
          aspect={kind === 'avatar' ? 1 : 4}
          classes={{
            cropAreaClassName: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
          }}
          crop={model.crop}
          cropShape={kind === 'avatar' ? 'round' : 'rect'}
          cropperProps={{
            'aria-describedby': `${kind}-crop-instructions`,
            'aria-label': `Pan ${label[kind]} crop`,
          }}
          image={model.sourceUrl}
          keyboardStep={2}
          mediaProps={{
            alt: `${title} crop source`,
            onError: () => model.setMessage('PROFILE_MEDIA_INVALID'),
          }}
          restrictPosition
          roundCropAreaPixels
          zoom={model.zoom}
          zoomWithScroll
          onCropChange={model.setCrop}
          onCropComplete={(_area, pixels) => model.setCropPixels(pixels)}
          onMediaLoaded={model.mediaLoaded}
          onZoomChange={model.setZoom}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground" id={`${kind}-crop-instructions`}>
        Use arrow keys to pan the crop area, or drag with pointer or touch.
      </p>
      <label className="mt-3 flex flex-col gap-1 text-sm font-bold">
        Zoom {title.toLowerCase()}
        <input
          aria-label={`Zoom ${label[kind]}`}
          disabled={blocked}
          max="3"
          min="1"
          step="0.01"
          type="range"
          value={model.zoom}
          onChange={(event) => model.setZoom(Number(event.target.value))}
        />
      </label>
    </>
  )
}

function ProfileMediaActions({
  blocked,
  currentUrl,
  kind,
  model,
}: { blocked: boolean; currentUrl: string | null; kind: ProfileMediaKind; model: ProfileImageCropperModel }) {
  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button disabled={blocked} onClick={() => model.inputRef.current?.click()} type="button" variant="outline">
          {model.sourceUrl ? `Replace ${label[kind]}` : `Change ${label[kind]}`}
        </Button>
        {model.sourceUrl ? (
          <Button disabled={blocked} onClick={model.revokeSelection} type="button" variant="outline">
            Cancel crop
          </Button>
        ) : (
          <Button disabled={blocked || !currentUrl} onClick={() => void model.remove()} type="button" variant="outline">
            Remove {label[kind]}
          </Button>
        )}
      </div>
      {model.sourceUrl ? (
        <Button
          className="mt-2 w-full"
          disabled={blocked || !model.mediaReady || !model.cropPixels}
          onClick={() => void model.applyCrop()}
          type="button"
        >
          {model.busy ? `Applying ${label[kind]}…` : `Apply ${label[kind]} crop`}
        </Button>
      ) : null}
    </>
  )
}

function ProfileMediaFeedback({
  blocked,
  kind,
  model,
}: { blocked: boolean; kind: ProfileMediaKind; model: ProfileImageCropperModel }) {
  return (
    <>
      {model.status ? <p aria-live="polite" className="mt-2 text-sm">{model.status}</p> : null}
      {model.message ? (
        <div className="mt-2" role="alert">
          <p className="text-sm text-destructive">{model.message}</p>
          {model.sourceUrl ? (
            <Button
              className="mt-2"
              disabled={blocked}
              onClick={() => void model.applyCrop()}
              type="button"
              variant="outline"
            >
              Retry {label[kind]}
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
