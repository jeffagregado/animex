import { describe, expect, it, vi } from 'vitest'

import {
  detectAvatarMediaType,
  fetchProviderAvatar,
  storeAvatarForProfile,
  validateProviderAvatarUrl,
} from './avatarImport'

describe('owned avatar import', () => {
  it('allows HTTPS Google hosts only', () => {
    expect(validateProviderAvatarUrl('https://lh3.googleusercontent.com/a/photo')).toBe(true)
    expect(validateProviderAvatarUrl('http://lh3.googleusercontent.com/a/photo')).toBe(false)
    expect(validateProviderAvatarUrl('https://googleusercontent.com.evil.test/a')).toBe(false)
  })

  it('recognizes JPEG PNG and WebP signatures', () => {
    expect(detectAvatarMediaType(new Uint8Array([0xff, 0xd8, 0xff]))).toBe('image/jpeg')
    expect(detectAvatarMediaType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png')
    expect(detectAvatarMediaType(new TextEncoder().encode('RIFFxxxxWEBP'))).toBe('image/webp')
    expect(detectAvatarMediaType(new Uint8Array([1, 2, 3]))).toBe(null)
  })

  it('validates redirects and rejects oversized responses', async () => {
    const redirectFetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://evil.test/a' } }))
    await expect(fetchProviderAvatar(redirectFetch, 'https://lh3.googleusercontent.com/a', 5_000, 5 * 1024 * 1024)).rejects.toThrow('redirect')

    const largeFetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
      headers: { 'content-length': `${5 * 1024 * 1024 + 1}` },
    }))
    await expect(fetchProviderAvatar(largeFetch, 'https://lh3.googleusercontent.com/a', 5_000, 5 * 1024 * 1024)).rejects.toThrow('5 MiB')
  })

  it('cancels chunked response as soon as streamed bytes exceed limit', async () => {
    const cancel = vi.fn()
    const body = new ReadableStream<Uint8Array>({
      cancel,
      start(controller) {
        controller.enqueue(new Uint8Array([0xff, 0xd8, 0xff]))
        controller.enqueue(new Uint8Array([1, 2]))
      },
    })
    const chunkedFetch = vi.fn(async () => new Response(body))

    await expect(fetchProviderAvatar(
      chunkedFetch,
      'https://lh3.googleusercontent.com/a',
      5_000,
      4,
    )).rejects.toThrow('5 MiB')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('cancels a declared oversized response before reading the stream', async () => {
    const cancel = vi.fn()
    const body = new ReadableStream<Uint8Array>({ cancel })
    const largeFetch = vi.fn(async () => new Response(body, {
      headers: { 'content-length': '6' },
    }))

    await expect(fetchProviderAvatar(
      largeFetch,
      'https://lh3.googleusercontent.com/a',
      5_000,
      5,
    )).rejects.toThrow('5 MiB')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('replaces a sensitive fetch rejection with stable copy', async () => {
    const sensitive = 'provider URL user@example.com token=secret'
    const rejectedFetch = vi.fn().mockRejectedValue(new Error(sensitive))

    await expect(fetchProviderAvatar(
      rejectedFetch,
      'https://lh3.googleusercontent.com/a',
      5_000,
      5 * 1024 * 1024,
    )).rejects.toThrow('Provider avatar request failed.')
    await expect(fetchProviderAvatar(
      rejectedFetch,
      'https://lh3.googleusercontent.com/a',
      5_000,
      5 * 1024 * 1024,
    )).rejects.not.toThrow(sensitive)
  })

  it('accepts valid signature split across streamed chunks', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([0xff]))
        controller.enqueue(new Uint8Array([0xd8, 0xff]))
        controller.close()
      },
    })
    const chunkedFetch = vi.fn(async () => new Response(body))
    const blob = await fetchProviderAvatar(
      chunkedFetch,
      'https://lh3.googleusercontent.com/a',
      5_000,
      4,
    )
    expect(blob.type).toBe('image/jpeg')
  })

  it('deletes stored blob when profile completion fails', async () => {
    const remove = vi.fn(async () => undefined)
    await expect(storeAvatarForProfile({
      blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }),
      complete: async () => { throw new Error('username race') },
      remove,
      store: async () => 'storage-1',
    })).rejects.toThrow('username race')
    expect(remove).toHaveBeenCalledWith('storage-1')
  })
})
