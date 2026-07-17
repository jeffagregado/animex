import { Buffer } from 'node:buffer'

import { describe, expect, test, vi } from 'vitest'

import {
  fetchProfileMedia,
  parseWebpDimensions,
  validateProfileMedia,
} from './profileMediaPolicy'

const text = (value: string): number[] => [...new TextEncoder().encode(value)]
const u24 = (value: number): number[] => [
  value & 0xff,
  (value >>> 8) & 0xff,
  (value >>> 16) & 0xff,
]
const u32 = (value: number): number[] => [
  value & 0xff,
  (value >>> 8) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 24) & 0xff,
]
const chunk = (name: string, payload: number[]): number[] => [
  ...text(name),
  ...u32(payload.length),
  ...payload,
  ...(payload.length % 2 === 1 ? [0] : []),
]
const webp = (...chunks: number[][]): Uint8Array => {
  const body = chunks.flat()
  return Uint8Array.from([...text('RIFF'), ...u32(body.length + 4), ...text('WEBP'), ...body])
}
const vp8 = (width: number, height: number): Uint8Array => webp(chunk('VP8 ', [
  0, 0, 0, 0x9d, 0x01, 0x2a,
  width & 0xff, (width >>> 8) & 0x3f,
  height & 0xff, (height >>> 8) & 0x3f,
]))
const vp8l = (width: number, height: number): Uint8Array => {
  const w = width - 1
  const h = height - 1
  return webp(chunk('VP8L', [
    0x2f,
    w & 0xff,
    ((w >>> 8) & 0x3f) | ((h & 0x03) << 6),
    (h >>> 2) & 0xff,
    (h >>> 10) & 0x0f,
  ]))
}
const vp8x = (width: number, height: number, flags: number): Uint8Array => webp(chunk('VP8X', [
  flags, 0, 0, 0, ...u24(width - 1), ...u24(height - 1),
]))
const vp8xChunk = (width: number, height: number, flags: number): number[] => chunk('VP8X', [
  flags, 0, 0, 0, ...u24(width - 1), ...u24(height - 1),
])
const malformedRiffFixture = Uint8Array.from(Buffer.from(
    'UklGRloCAABXRUJQVlA4WAoAAAAQAAAA/wEA/wEAQUxQSBwAAAABB9C/iAgIBJL9vWcoov8Z//nPf/7zn//85/8AVlA4IBgCAADQOgCdASoAAgACPm02mUmkIyKhIAgAgA2JaW7hd2Ee3AfgAAAT2Ae+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ9YAAD+/7ge///8guWF1yNf//yA/5Af8gP/4+KarTgZtUCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
  'base64',
))
const staticAlphaAvatar = Uint8Array.from(Buffer.from([
  'UklGRlACAABXRUJQVlA4WAoAAAAQAAAA/wEA/wEAQUxQSBwAAAABB9C/iAgIBJL9vWcoov8Z//nPf/7zn//85/8AVlA4IA4CAABw',
  'OQCdASoAAgACAAAAJaW7hd2Ee3AfgB+gH8AAhYmNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomN',
  'NomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomN',
  'NomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomN',
  'NomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomN',
  'NomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomN',
  'NomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomNNomN',
  'NomNNomNNomNNomNNomNNWAA/v/8jIb///LD8f1J5/8sQ////E9ObxFTyv/4mQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
].join(''), 'base64'))

describe('Profile media byte policy', () => {
  test('parses simple images and a real static alpha VP8X image', () => {
    expect(parseWebpDimensions(vp8(512, 512))).toEqual({ width: 512, height: 512 })
    expect(parseWebpDimensions(vp8l(1600, 400))).toEqual({ width: 1600, height: 400 })
    expect(parseWebpDimensions(staticAlphaAvatar)).toEqual({ width: 512, height: 512 })
    expect(validateProfileMedia(staticAlphaAvatar, 'avatar')).toBeUndefined()
  })

  test('accepts only exact static avatar and banner output', () => {
    expect(validateProfileMedia(vp8(512, 512), 'avatar')).toBeUndefined()
    expect(validateProfileMedia(vp8l(1600, 400), 'banner')).toBeUndefined()
    expect(() => validateProfileMedia(vp8(511, 512), 'avatar')).toThrow('PROFILE_MEDIA_INVALID')
    expect(() => validateProfileMedia(webp(
      vp8xChunk(512, 512, 0x02),
      chunk('VP8 ', [...vp8(512, 512).slice(20)]),
    ), 'avatar')).toThrow('PROFILE_MEDIA_INVALID')
    expect(() => validateProfileMedia(webp(
      vp8xChunk(512, 512, 0),
      chunk('ANIM', [0, 0, 0, 0, 0, 0]),
      chunk('VP8 ', [...vp8(512, 512).slice(20)]),
    ), 'avatar')).toThrow('PROFILE_MEDIA_INVALID')
  })

  test('enforces extended WebP canvas and image-data structure', () => {
    const vp8Payload = [...vp8(512, 512).slice(20)]
    const vp8lPayload = [...vp8l(512, 512).slice(20)]
    expect(() => parseWebpDimensions(vp8x(512, 512, 0))).toThrow('PROFILE_MEDIA_INVALID')
    expect(() => parseWebpDimensions(webp(
      vp8xChunk(512, 512, 0),
      vp8xChunk(512, 512, 0),
      chunk('VP8 ', vp8Payload),
    ))).toThrow('PROFILE_MEDIA_INVALID')
    expect(() => parseWebpDimensions(webp(
      vp8xChunk(512, 512, 0),
      chunk('VP8 ', vp8Payload),
      chunk('VP8L', vp8lPayload),
    ))).toThrow('PROFILE_MEDIA_INVALID')
    expect(() => parseWebpDimensions(webp(
      vp8xChunk(512, 512, 0),
      chunk('VP8 ', [...vp8(511, 512).slice(20)]),
    ))).toThrow('PROFILE_MEDIA_INVALID')
    expect(() => parseWebpDimensions(webp(
      vp8xChunk(512, 512, 0),
      chunk('ANMF', [0, 0, 0, 0]),
      chunk('VP8 ', vp8Payload),
    ))).toThrow('PROFILE_MEDIA_INVALID')
  })

  test('rejects empty, malformed, non-WebP, and oversized bytes', () => {
    expect(() => parseWebpDimensions(new Uint8Array())).toThrow('PROFILE_MEDIA_INVALID')
    expect(() => parseWebpDimensions(Uint8Array.from(text('not a webp')))).toThrow('PROFILE_MEDIA_INVALID')
    expect(() => parseWebpDimensions(webp(chunk('VP8 ', [0, 0])))).toThrow('PROFILE_MEDIA_INVALID')
    expect(() => parseWebpDimensions(Uint8Array.from([
      ...text('RIFF'), ...u32(100), ...text('WEBP'), ...chunk('VP8 ', [0]),
    ]))).toThrow('PROFILE_MEDIA_INVALID')
    expect(() => parseWebpDimensions(malformedRiffFixture)).toThrow('PROFILE_MEDIA_INVALID')
    const malformedSize = webp(chunk('JUNK', [1, 2]))
    malformedSize.set(u32(100), 16)
    expect(() => parseWebpDimensions(malformedSize)).toThrow('PROFILE_MEDIA_INVALID')
    const malformedPad = webp(
      chunk('JUNK', [1]),
      chunk('VP8 ', [...vp8(512, 512).slice(20)]),
    )
    malformedPad[21] = 1
    expect(() => parseWebpDimensions(malformedPad)).toThrow('PROFILE_MEDIA_INVALID')
    expect(() => validateProfileMedia(new Uint8Array(2 * 1024 * 1024 + 1), 'avatar'))
      .toThrow('PROFILE_MEDIA_INVALID')
  })
})

describe('Profile media fetch policy', () => {
  test('returns bytes on first successful response', async () => {
    const bytes = vp8(512, 512)
    const fetchMedia = vi.fn(async () => new Response(new Blob([Uint8Array.from(bytes)])))
    const warn = vi.fn()
    const wait = vi.fn(async () => undefined)

    await expect(fetchProfileMedia(fetchMedia, 'https://storage.test/1', wait, warn))
      .resolves.toEqual(bytes)
    expect(fetchMedia).toHaveBeenCalledOnce()
    expect(warn).not.toHaveBeenCalled()
  })

  test('warns before two bounded retries and throws the last failure', async () => {
    const first = new Error('first')
    const second = new Error('second')
    const last = new Error('last')
    const fetchMedia = vi.fn()
      .mockRejectedValueOnce(first)
      .mockRejectedValueOnce(second)
      .mockRejectedValueOnce(last)
    const order: string[] = []
    const warn = vi.fn((message: string) => order.push(message))
    const wait = vi.fn(async (delayMs: number) => {
      expect(delayMs).toBeGreaterThan(0)
      expect(delayMs).toBeLessThanOrEqual(250)
      order.push('wait')
    })

    await expect(fetchProfileMedia(fetchMedia, 'https://storage.test/1', wait, warn))
      .rejects.toBe(last)
    expect(fetchMedia).toHaveBeenCalledTimes(3)
    expect(order).toEqual([
      'Profile media fetch failed; retrying attempt 2 of 3.',
      'wait',
      'Profile media fetch failed; retrying attempt 3 of 3.',
      'wait',
    ])
  })
})
