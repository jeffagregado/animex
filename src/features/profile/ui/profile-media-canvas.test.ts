// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  cropProfileMedia,
  validateProfileMediaSource,
} from './profile-media-canvas'

const signature = {
  jpeg: [0xff, 0xd8, 0xff, 0],
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  webp: [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
}

const file = (type: string, bytes: number[]) => new File(
  [new Uint8Array(bytes)],
  'source',
  { type },
)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('validateProfileMediaSource', () => {
  it.each([
    ['image/jpeg', signature.jpeg],
    ['image/png', signature.png],
    ['image/webp', signature.webp],
  ])('accepts matching %s metadata and signature', async (type, bytes) => {
    await expect(validateProfileMediaSource(file(type, bytes))).resolves.toBeUndefined()
  })

  it('rejects mismatched signatures and oversized metadata', async () => {
    await expect(validateProfileMediaSource(file('image/png', signature.jpeg)))
      .rejects.toThrow('PROFILE_MEDIA_INVALID')
    const source = file('image/png', signature.png)
    Object.defineProperty(source, 'size', { value: 10 * 1024 * 1024 + 1 })
    await expect(validateProfileMediaSource(source))
      .rejects.toThrow('PROFILE_MEDIA_INVALID')
  })
})

describe('cropProfileMedia', () => {
  it('draws a clamped rounded source crop and returns first WebP under limit', async () => {
    const drawImage = vi.fn()
    const blobs = [
      new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], { type: 'image/webp' }),
      new Blob(['ok'], { type: 'image/webp' }),
    ]
    const toBlob = vi.fn((
      callback: BlobCallback,
      _type?: string,
      _quality?: number,
    ) => callback(blobs.shift() ?? null))
    vi.spyOn(document, 'createElement').mockReturnValue({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toBlob,
    } as unknown as HTMLCanvasElement)
    class ImageStub {
      naturalWidth = 100
      naturalHeight = 80
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) { this.onload?.() }
    }
    vi.stubGlobal('Image', ImageStub)

    const blob = await cropProfileMedia(
      'blob:source',
      { x: -2.2, y: 4.6, width: 104.4, height: 90 },
      'avatar',
    )

    expect(blob).not.toBeInstanceOf(File)
    expect(blob.type).toBe('image/webp')
    expect(drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      5,
      100,
      75,
      0,
      0,
      512,
      512,
    )
    expect(toBlob.mock.calls.map((call) => call[2])).toEqual([0.92, 0.86])
  })

  it('rejects invalid crops, decode/canvas failures, wrong blobs, and all oversized output', async () => {
    class BrokenImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) { this.onerror?.() }
    }
    vi.stubGlobal('Image', BrokenImage)
    await expect(cropProfileMedia(
      'blob:source',
      { x: 0, y: 0, width: 1, height: 1 },
      'banner',
    )).rejects.toThrow('PROFILE_MEDIA_INVALID')

    class ImageStub {
      naturalWidth = 100
      naturalHeight = 100
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) { this.onload?.() }
    }
    vi.stubGlobal('Image', ImageStub)
    vi.spyOn(document, 'createElement').mockReturnValue({
      getContext: () => null,
    } as unknown as HTMLCanvasElement)
    await expect(cropProfileMedia(
      'blob:source',
      { x: 0, y: 0, width: 0, height: 1 },
      'banner',
    )).rejects.toThrow('PROFILE_MEDIA_INVALID')
  })

  it('uses exact banner dimensions and rejects every oversized quality', async () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: vi.fn() }),
      toBlob: (callback: BlobCallback) => callback(new Blob(
        [new Uint8Array(2 * 1024 * 1024 + 1)],
        { type: 'image/webp' },
      )),
    } as unknown as HTMLCanvasElement
    vi.spyOn(document, 'createElement').mockReturnValue(canvas)
    class ImageStub {
      naturalWidth = 1600
      naturalHeight = 400
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) { this.onload?.() }
    }
    vi.stubGlobal('Image', ImageStub)

    await expect(cropProfileMedia(
      'blob:source',
      { x: 0, y: 0, width: 1600, height: 400 },
      'banner',
    )).rejects.toThrow('PROFILE_MEDIA_INVALID')
    expect(canvas.width).toBe(1600)
    expect(canvas.height).toBe(400)
  })

  it.each([null, new Blob(['png'], { type: 'image/png' })])(
    'rejects null or wrong-MIME canvas output',
    async (result) => {
      vi.spyOn(document, 'createElement').mockReturnValue({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: vi.fn() }),
        toBlob: (callback: BlobCallback) => callback(result),
      } as unknown as HTMLCanvasElement)
      class ImageStub {
        naturalWidth = 100
        naturalHeight = 100
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        set src(_value: string) { this.onload?.() }
      }
      vi.stubGlobal('Image', ImageStub)
      await expect(cropProfileMedia(
        'blob:source',
        { x: 0, y: 0, width: 100, height: 100 },
        'avatar',
      )).rejects.toThrow('PROFILE_MEDIA_INVALID')
    },
  )
})
