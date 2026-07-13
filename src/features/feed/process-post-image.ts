import { POST_IMAGE_MAX_BYTES } from '../social/shared/social-contracts'

const MAX_EDGE = 1920
const STATIC_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
type StaticMime = (typeof STATIC_TYPES)[number]

export interface ProcessedPostImage {
  blob: Blob
  mimeType: StaticMime | 'image/gif'
  size: number
  width: number
  height: number
}

export type PostImageInspection =
  | { kind: 'gif'; mimeType: 'image/gif' }
  | { kind: 'static'; mimeType: StaticMime }

/** Validates a Post image before browser decode. */
export const inspectPostImage = (file: File): PostImageInspection => {
  if (file.type === 'image/svg+xml') throw new Error('SVG images are not supported.')
  if (file.type === 'image/gif') {
    if (file.size > POST_IMAGE_MAX_BYTES) throw new Error('Animated GIF must be 5 MB or smaller.')
    return { kind: 'gif', mimeType: 'image/gif' }
  }
  if (!STATIC_TYPES.includes(file.type as StaticMime)) throw new Error('Choose a JPEG, PNG, WebP, or GIF image.')
  return { kind: 'static', mimeType: file.type as StaticMime }
}

const gifDimensions = async (file: File): Promise<{ width: number; height: number }> => {
  const bytes = new Uint8Array(await file.slice(0, 10).arrayBuffer())
  const signature = String.fromCharCode(...bytes.slice(0, 6))
  if (bytes.length < 10 || (signature !== 'GIF87a' && signature !== 'GIF89a')) throw new Error('GIF file is invalid.')
  const width = bytes[6] + bytes[7] * 256
  const height = bytes[8] + bytes[9] * 256
  if (width < 1 || height < 1) throw new Error('GIF dimensions are invalid.')
  return { width, height }
}

const canvasBlob = async (canvas: HTMLCanvasElement, mimeType: StaticMime, quality: number): Promise<Blob> => await new Promise((resolve, reject) => {
  canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Browser could not encode the image.')), mimeType, quality)
})

/** Decodes, orients, resizes, and strips metadata from a browser image. */
export const processPostImage = async (file: File): Promise<ProcessedPostImage> => {
  const inspected = inspectPostImage(file)
  if (inspected.kind === 'gif') {
    const { width, height } = await gifDimensions(file)
    return { blob: file, mimeType: inspected.mimeType, size: file.size, width, height }
  }

  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const initialScale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    let width = Math.max(1, Math.round(bitmap.width * initialScale))
    let height = Math.max(1, Math.round(bitmap.height * initialScale))
    let quality = inspected.mimeType === 'image/png' ? 1 : 0.9
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Browser image canvas is unavailable.')
      context.drawImage(bitmap, 0, 0, width, height)
      const blob = await canvasBlob(canvas, inspected.mimeType, quality)
      if (blob.size <= POST_IMAGE_MAX_BYTES) return { blob, mimeType: inspected.mimeType, size: blob.size, width, height }
      if (inspected.mimeType !== 'image/png' && quality > 0.5) quality -= 0.1
      else { width = Math.max(1, Math.round(width * 0.82)); height = Math.max(1, Math.round(height * 0.82)) }
    }
    throw new Error('Image could not be reduced to 5 MB.')
  } finally {
    bitmap.close()
  }
}
