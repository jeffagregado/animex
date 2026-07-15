// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { PostMediaCard } from './post-media-card'

afterEach(cleanup)

describe('PostMediaCard', () => {
  it('renders secure lazy images with contextual alt and stable broken geometry', () => {
    render(<PostMediaCard media={{ type: 'image', url: 'https://media.example/image', description: null }} username="mika" />)
    const image = screen.getByRole('img', { name: 'Image attached to post by mika' })
    const media = image.parentElement
    expect(media?.className).toContain('aspect-4/5')
    expect(media?.className).toContain('w-full')
    expect(media?.className).toContain('sm:max-w-[65%]')
    expect(media?.className).not.toContain('max-h-[32rem]')
    expect(image.getAttribute('loading')).toBe('lazy')
    expect(image.getAttribute('referrerpolicy')).toBe('no-referrer')
    fireEvent.error(image)
    const unavailable = screen.getByText('Image unavailable').parentElement?.parentElement
    expect(unavailable?.className).toContain('aspect-4/5')
    expect(unavailable?.className).toContain('w-full')
    expect(unavailable?.className).toContain('sm:max-w-[65%]')
  })

  it('renders YouTube as linked thumbnail without playback', () => {
    render(<PostMediaCard media={{ type: 'video', url: 'https://youtu.be/dQw4w9WgXcQ', provider: 'youtube', label: null }} username="mika" />)
    const link = screen.getByRole('link', { name: 'Open youtube video' })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer noopener')
    expect(document.querySelector('img')?.getAttribute('src')).toContain('dQw4w9WgXcQ')
    expect(document.querySelector('iframe')).toBeNull()
    expect(link.className).not.toContain('aspect-4/5')
    expect(link.className).not.toContain('max-w-[65%]')
  })

  it('renders external videos as truthful domain cards', () => {
    render(<PostMediaCard media={{ type: 'video', url: 'https://video.example/watch/1', provider: 'external', label: null }} username="mika" />)
    expect(screen.getByRole('link', { name: 'Open video.example video' })).toBeTruthy()
  })

  it('recovers from a broken image when media changes', () => {
    const { rerender } = render(<PostMediaCard media={{ type: 'image', url: 'https://media.example/broken', description: null }} username="mika" />)
    fireEvent.error(screen.getByRole('img'))
    expect(screen.getByText('Image unavailable')).toBeTruthy()
    rerender(<PostMediaCard media={{ type: 'image', url: 'https://media.example/replacement', description: 'Replacement' }} username="mika" />)
    expect(screen.getByRole('img', { name: 'Replacement' }).getAttribute('src')).toBe('https://media.example/replacement')
  })
})
