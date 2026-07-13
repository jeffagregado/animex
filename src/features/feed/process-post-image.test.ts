import { describe, expect, it } from 'vitest'

import { inspectPostImage } from './process-post-image'

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
})
