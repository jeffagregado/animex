import { describe, expect, test } from 'vitest'

import {
  EXTERNAL_MEDIA_URL_MAX_LENGTH,
  externalMediaUrlSchema,
  getLinkedVideoLabel,
  getVideoProvider,
  parseExternalMediaUrl,
  postMediaSchema,
} from './external-media'

describe('external media contracts', () => {
  test('accepts HTTPS URLs without credentials', () => {
    expect(parseExternalMediaUrl('https://media.example/path').hostname).toBe('media.example')
    expect(externalMediaUrlSchema.parse('https://media.example/path')).toBe('https://media.example/path')
  })

  test('rejects non-HTTPS and credentialed URLs with stable errors', () => {
    expect(() => parseExternalMediaUrl('http://media.example/path')).toThrow('Media URL must use HTTPS without credentials.')
    expect(() => parseExternalMediaUrl('https://user:pass@media.example/path')).toThrow('Media URL must use HTTPS without credentials.')
    expect(() => parseExternalMediaUrl('not a URL')).toThrow('Media URL must be a valid HTTPS URL.')
  })

  test('enforces the 2,048-character URL limit', () => {
    const prefix = 'https://example.com/'
    const maximumUrl = `${prefix}${'x'.repeat(EXTERNAL_MEDIA_URL_MAX_LENGTH - prefix.length)}`

    expect(EXTERNAL_MEDIA_URL_MAX_LENGTH).toBe(2_048)
    expect(maximumUrl).toHaveLength(EXTERNAL_MEDIA_URL_MAX_LENGTH)
    expect(parseExternalMediaUrl(maximumUrl).href).toBe(maximumUrl)
    expect(() => parseExternalMediaUrl(`https://example.com/${'x'.repeat(EXTERNAL_MEDIA_URL_MAX_LENGTH)}`)).toThrow('Media URL must not exceed 2048 characters.')
  })

  test('detects YouTube, Vimeo, and external video providers', () => {
    expect(getVideoProvider('https://youtu.be/abc123')).toBe('youtube')
    expect(getVideoProvider('https://www.youtube.com/watch?v=abc123')).toBe('youtube')
    expect(getVideoProvider('https://player.vimeo.com/video/123')).toBe('vimeo')
    expect(getVideoProvider('https://videos.example/watch/123')).toBe('external')
  })

  test('builds explicit or provider/domain linked-card labels', () => {
    expect(getLinkedVideoLabel('https://youtu.be/abc123', 'youtube', 'Official trailer')).toBe('Official trailer')
    expect(getLinkedVideoLabel('https://youtu.be/abc123', 'youtube', null)).toBe('Open youtube video')
    expect(getLinkedVideoLabel('https://youtu.be/abc123', 'youtube', '   ')).toBe('Open youtube video')
    expect(getLinkedVideoLabel('https://videos.example/watch/123', 'external', null)).toBe('Open videos.example video')
  })

  test('accepts only strict image and video media with nullable copy', () => {
    const image = { type: 'image', url: 'https://images.example/frieren.jpg', description: null }
    const video = { type: 'video', url: 'https://youtu.be/abc123', provider: 'youtube', label: null }

    expect(postMediaSchema.parse(image)).toEqual(image)
    expect(postMediaSchema.parse(video)).toEqual(video)
    expect(postMediaSchema.parse({ ...image, description: '   ' })).toEqual({ ...image, description: '' })
    expect(postMediaSchema.parse({ ...video, label: '   ' })).toEqual({ ...video, label: '' })
    expect(() => postMediaSchema.parse({ ...image, description: undefined })).toThrow()
    expect(() => postMediaSchema.parse({ ...video, label: undefined })).toThrow()
    expect(() => postMediaSchema.parse({ ...video, provider: 'vimeo' })).toThrow('Video provider must match its URL.')
    expect(() => postMediaSchema.parse({ ...image, extra: true })).toThrow()
  })
})
