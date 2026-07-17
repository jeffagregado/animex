import type { Area } from 'react-easy-crop'

import {
  PROFILE_MEDIA_OUTPUT_MAX_BYTES,
  parseProfileMediaSource,
  type ProfileMediaKind,
} from '../shared/profile-contracts'

const WEBP_QUALITIES = [0.92, 0.86, 0.80, 0.74, 0.68, 0.62] as const
const outputSize: Record<ProfileMediaKind, { width: number; height: number }> = {
  avatar: { width: 512, height: 512 },
  banner: { width: 1600, height: 400 },
}

const invalid = (cause?: unknown): TypeError => (
  new TypeError('PROFILE_MEDIA_INVALID', { cause })
)

const bytesMatch = (
  bytes: Uint8Array,
  expected: readonly number[],
  offset: number,
): boolean => expected.every((byte, index) => bytes[offset + index] === byte)

/** Validates source metadata and declared MIME against first-byte signature. */
export async function validateProfileMediaSource(file: File): Promise<void> {
  parseProfileMediaSource({
    name: file.name,
    type: file.type,
    size: file.size,
  })
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const valid = file.type === 'image/jpeg'
    ? bytesMatch(bytes, [0xff, 0xd8, 0xff], 0)
    : file.type === 'image/png'
      ? bytesMatch(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
      : bytesMatch(bytes, [0x52, 0x49, 0x46, 0x46], 0)
        && bytesMatch(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  if (!valid) throw invalid()
}

const loadImage = async (sourceUrl: string): Promise<HTMLImageElement> => (
  await new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(invalid())
    image.src = sourceUrl
  })
)

const normalizeCrop = (
  crop: Area,
  naturalWidth: number,
  naturalHeight: number,
): Area => {
  const finiteValues = [crop.x, crop.y, crop.width, crop.height]
  const dimensions = [crop.width, crop.height, naturalWidth, naturalHeight]
  if (!finiteValues.every(Number.isFinite) || !dimensions.every((value) => value > 0)) {
    throw invalid()
  }
  const x = Math.max(0, Math.min(naturalWidth - 1, Math.round(crop.x)))
  const y = Math.max(0, Math.min(naturalHeight - 1, Math.round(crop.y)))
  const width = Math.min(naturalWidth - x, Math.round(crop.width))
  const height = Math.min(naturalHeight - y, Math.round(crop.height))
  if (![width, height].every((value) => value > 0)) throw invalid()
  return { x, y, width, height }
}

const encodeWebp = async (
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> => await new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (!blob || blob.type !== 'image/webp') {
      reject(invalid())
      return
    }
    resolve(blob)
  }, 'image/webp', quality)
})

/** Draws exact selected source pixels into fixed Profile output dimensions. */
export async function cropProfileMedia(
  sourceUrl: string,
  crop: Area,
  kind: ProfileMediaKind,
): Promise<Blob> {
  try {
    const image = await loadImage(sourceUrl)
    const source = normalizeCrop(crop, image.naturalWidth, image.naturalHeight)
    const destination = outputSize[kind]
    const canvas = document.createElement('canvas')
    canvas.width = destination.width
    canvas.height = destination.height
    const context = canvas.getContext('2d')
    if (!context) throw invalid()
    context.drawImage(
      image,
      source.x,
      source.y,
      source.width,
      source.height,
      0,
      0,
      destination.width,
      destination.height,
    )
    for (const quality of WEBP_QUALITIES) {
      const blob = await encodeWebp(canvas, quality)
      if (blob.size <= PROFILE_MEDIA_OUTPUT_MAX_BYTES) return blob
    }
    throw invalid()
  } catch (error) {
    if (error instanceof TypeError && error.message === 'PROFILE_MEDIA_INVALID') {
      throw error
    }
    throw invalid(error)
  }
}
