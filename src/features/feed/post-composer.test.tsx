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
  blockerOptions: null as { shouldBlockFn: () => boolean; enableBeforeUnload: () => boolean } | null,
  onCancel: vi.fn(), onSaved: vi.fn(), success: vi.fn(), error: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({ useBlocker: (options: { shouldBlockFn: () => boolean; enableBeforeUnload: () => boolean }) => { mocks.blockerOptions = options; return mocks.blocker } }))
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }))
vi.mock('./use-post-composer', () => ({ usePostComposer: () => mocks.composer }))

const initial = { text: '', media: null, hasSpoiler: false, visibility: 'public' as const }

beforeEach(() => {
  mocks.blocker.status = 'idle'
  mocks.blockerOptions = null
  mocks.composer.mediaDraft = null
  mocks.composer.mediaError = null
  mocks.composer.text = ''
  mocks.composer.visibility = 'public'
  mocks.composer.submitting = false
  mocks.composer.dirty = true
  mocks.composer.submit.mockReset().mockResolvedValue(undefined)
  mocks.onCancel.mockReset(); mocks.onSaved.mockReset(); mocks.success.mockReset(); mocks.error.mockReset(); mocks.blocker.reset.mockReset(); mocks.blocker.proceed.mockReset()
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

  it('uses the shared checkbox and toggles spoiler state from its label', () => {
    render(<PostComposer initial={initial} onCancel={mocks.onCancel} onSaved={mocks.onSaved} postId={null} registerClose={() => undefined} />)
    const checkbox = screen.getByRole('checkbox', { name: 'Hide whole Post as spoiler' })
    expect(checkbox.tagName).toBe('SPAN')
    expect(checkbox.getAttribute('data-slot')).toBe('checkbox')
    expect(document.querySelector('input[type="checkbox"]')?.getAttribute('aria-hidden')).toBe('true')
    fireEvent.click(screen.getByText('Hide whole Post as spoiler'))
    expect(mocks.composer.setHasSpoiler).toHaveBeenCalledWith(true)
  })

  it('publishes successfully, clears blocker predicates, and uses Sonner', async () => {
    mocks.onSaved.mockImplementationOnce(() => {
      expect(mocks.blockerOptions?.shouldBlockFn()).toBe(false)
      expect(mocks.blockerOptions?.enableBeforeUnload()).toBe(false)
    })
    render(<PostComposer initial={initial} onCancel={mocks.onCancel} onSaved={mocks.onSaved} postId={null} registerClose={() => undefined} />)
    expect(mocks.blockerOptions?.shouldBlockFn()).toBe(true)
    expect(mocks.blockerOptions?.enableBeforeUnload()).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Publish Post' }))
    await waitFor(() => expect(mocks.onSaved).toHaveBeenCalled())
    expect(mocks.composer.submit).toHaveBeenCalledWith(null)
    expect(mocks.success).toHaveBeenCalledWith('Post published.')
  })

  it('routes malformed URLs through shared validation and retains the draft', async () => {
    mocks.composer.mediaDraft = { type: 'image', url: 'not a URL', copy: '' }
    mocks.composer.mediaError = 'Media URL must be a valid HTTPS URL.'
    mocks.composer.submit.mockRejectedValueOnce(new Error('Media URL must be a valid HTTPS URL.'))
    render(<PostComposer initial={initial} onCancel={mocks.onCancel} onSaved={mocks.onSaved} postId={null} registerClose={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Publish Post' }))
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Media URL must be a valid HTTPS URL.'))
    expect(screen.getByLabelText('Image URL').getAttribute('value')).toBe('not a URL')
    expect(mocks.onSaved).not.toHaveBeenCalled()
  })

  it('stays blocked and preserves the editor when save fails', async () => {
    mocks.composer.submit.mockRejectedValueOnce(new Error('save failed'))
    render(<PostComposer initial={initial} onCancel={mocks.onCancel} onSaved={mocks.onSaved} postId={null} registerClose={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Publish Post' }))
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('save failed'))
    expect(mocks.blockerOptions?.shouldBlockFn()).toBe(true)
    expect(mocks.blockerOptions?.enableBeforeUnload()).toBe(true)
    expect(mocks.onSaved).not.toHaveBeenCalled()
  })

  it('uses the themed discard dialog for blocked navigation', async () => {
    mocks.blocker.status = 'blocked'
    render(<PostComposer initial={initial} onCancel={mocks.onCancel} onSaved={mocks.onSaved} postId={null} registerClose={() => undefined} />)
    expect(await screen.findByText('Discard unsaved Post?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(mocks.blocker.proceed).toHaveBeenCalled())
    expect(mocks.onCancel).not.toHaveBeenCalled()
  })
})
