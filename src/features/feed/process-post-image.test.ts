// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'

import { inspectPostImage, processPostImage } from './process-post-image'

describe('Post image inspection', () => {
  it('rejects SVG and non-image input', () => {
    expect(() => inspectPostImage(new File(['<svg/>'], 'bad.svg', { type: 'image/svg+xml' }))).toThrow('SVG')
    expect(() => inspectPostImage(new File(['text'], 'bad.txt', { type: 'text/plain' }))).toThrow('image')
  })

  it('allows an unchanged GIF only within five megabytes', () => {
    const gif = new File([new Uint8Array(12)], 'ok.gif', { type: 'image/gif' })
    expect(inspectPostImage(gif)).toEqual({ kind: 'gif', mimeType: 'image/gif' })
    const large = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.gif', { type: 'image/gif' })
    expect(() => inspectPostImage(large)).toThrow('5 MB')
  })

  it('reads exact unchanged GIF dimensions', async () => {
    const gif = new File([new Uint8Array([71, 73, 70, 56, 57, 97, 2, 0, 3, 0])], 'ok.gif', { type: 'image/gif' })
    const processed = await processPostImage(gif)
    expect(processed).toMatchObject({ blob: gif, mimeType: 'image/gif', size: 10, width: 2, height: 3 })
  })

  it('records resized static output metadata from encoded Blob', async () => {
    const close = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 3000, height: 1000, close })))
    const context = { drawImage: vi.fn() }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) => callback(new Blob([new Uint8Array(100)], { type: type ?? 'image/jpeg' })))
    const processed = await processPostImage(new File(['jpeg'], 'photo.jpg', { type: 'image/jpeg' }))
    expect(processed).toMatchObject({ mimeType: 'image/jpeg', size: 100, width: 1920, height: 640 })
    expect(context.drawImage).toHaveBeenCalled()
    expect(close).toHaveBeenCalled()
  })
})
