// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PostComposer } from './post-composer'

const mocks = vi.hoisted(() => ({
  blocker: { status: 'idle' as 'idle' | 'blocked', reset: vi.fn(), proceed: vi.fn() },
  composer: {
    text: '', setText: vi.fn(), mediaDraft: null as { type: 'image' | 'video'; url: string; copy: string } | null, mediaError: null as string | null,
    setMediaType: vi.fn(), setMediaUrl: vi.fn(), setMediaCopy: vi.fn(), removeMedia: vi.fn(),
    hasSpoiler: false, setHasSpoiler: vi.fn(), visibility: 'public' as const, setVisibility: vi.fn(), submitting: false, dirty: true, submit: vi.fn(),
  },
  onCancel: vi.fn(), onSaved: vi.fn(), success: vi.fn(), error: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({ useBlocker: () => mocks.blocker }))
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }))
vi.mock('./use-post-composer', () => ({ usePostComposer: () => mocks.composer }))

const initial = { text: '', media: null, hasSpoiler: false, visibility: 'public' as const }

beforeEach(() => {
  mocks.blocker.status = 'idle'
  mocks.composer.mediaDraft = null
  mocks.composer.mediaError = null
  mocks.composer.submit.mockReset().mockResolvedValue(undefined)
  mocks.onCancel.mockReset(); mocks.onSaved.mockReset(); mocks.success.mockReset(); mocks.error.mockReset()
})
afterEach(cleanup)

describe('PostComposer', () => {
  it('offers explicit Image and Video choices without file input', () => {
    render(<PostComposer initial={initial} onCancel={mocks.onCancel} onSaved={mocks.onSaved} postId={null} registerClose={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Image' }))
    fireEvent.click(screen.getByRole('button', { name: 'Video' }))
    expect(mocks.composer.setMediaType).toHaveBeenNthCalledWith(1, 'image')
    expect(mocks.composer.setMediaType).toHaveBeenNthCalledWith(2, 'video')
    expect(document.querySelector('input[type="file"]')).toBeNull()
  })

  it('shows one URL and optional description, with retained inline errors', () => {
    mocks.composer.mediaDraft = { type: 'image', url: 'http://unsafe.example', copy: 'Alt' }
    mocks.composer.mediaError = 'Media URL must use HTTPS without credentials.'
    render(<PostComposer initial={initial} onCancel={mocks.onCancel} onSaved={mocks.onSaved} postId={null} registerClose={() => undefined} />)
    expect(screen.getByLabelText('Image URL').getAttribute('value')).toBe('http://unsafe.example')
    expect(screen.getByLabelText('Image description (optional)').getAttribute('value')).toBe('Alt')
    expect(screen.getByRole('alert').textContent).toContain('HTTPS')
    fireEvent.click(screen.getByRole('button', { name: 'Remove media' }))
    expect(mocks.composer.removeMedia).toHaveBeenCalled()
  })

  it('uses Sonner for success and validation errors', async () => {
    const { rerender } = render(<PostComposer initial={initial} onCancel={mocks.onCancel} onSaved={mocks.onSaved} postId={null} registerClose={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Publish Post' }))
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Post published.'))
    mocks.composer.submit.mockRejectedValueOnce(new Error('Media URL must use HTTPS without credentials.'))
    rerender(<PostComposer initial={initial} onCancel={mocks.onCancel} onSaved={mocks.onSaved} postId="post-1" registerClose={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save Post' }))
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Media URL must use HTTPS without credentials.'))
  })
})
