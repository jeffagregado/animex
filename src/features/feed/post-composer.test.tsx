// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PendingPostImage } from './use-post-composer'
import { PostComposer } from './post-composer'

const mocks = vi.hoisted(() => ({
  blocker: { status: 'idle' as 'idle' | 'blocked', reset: vi.fn(), proceed: vi.fn() },
  blockerOptions: null as { shouldBlockFn: () => boolean; enableBeforeUnload: () => boolean } | null,
  composer: {
    text: 'draft', setText: vi.fn(), images: [] as PendingPostImage[], hasSpoiler: false, setHasSpoiler: vi.fn(), visibility: 'public' as 'public' | 'followers' | 'private', setVisibility: vi.fn(), submitting: false, dirty: true,
    upload: vi.fn(), remove: vi.fn(), move: vi.fn(), submit: vi.fn(), discardAll: vi.fn(),
  },
  onCancel: vi.fn(), onSaved: vi.fn(), confirm: vi.fn(), success: vi.fn(), error: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({ useBlocker: (options: { shouldBlockFn: () => boolean; enableBeforeUnload: () => boolean }) => { mocks.blockerOptions = options; return mocks.blocker } }))
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }))
vi.mock('./use-post-composer', () => ({ usePostComposer: () => mocks.composer }))

const initial = { text: '', imageIds: [], imageUrls: [], hasSpoiler: false, visibility: 'public' as const }

beforeEach(() => {
  mocks.blocker.status = 'idle'
  mocks.blockerOptions = null
  mocks.composer.images = []
  mocks.composer.submitting = false
  mocks.composer.dirty = true
  mocks.composer.visibility = 'public'
  mocks.composer.submit.mockReset().mockResolvedValue(undefined)
  mocks.composer.discardAll.mockReset().mockResolvedValue(undefined)
  mocks.composer.remove.mockReset().mockResolvedValue(undefined)
  mocks.onCancel.mockReset(); mocks.onSaved.mockReset(); mocks.success.mockReset(); mocks.error.mockReset(); mocks.blocker.proceed.mockReset(); mocks.blocker.reset.mockReset()
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('PostComposer lifecycle UI', () => {
  it('uses themed AlertDialog and awaits cleanup before closing', async () => {
    vi.stubGlobal('confirm', mocks.confirm)
    render(<PostComposer initial={initial} onCancel={mocks.onCancel} onSaved={mocks.onSaved} postId={null} registerClose={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(await screen.findByText('Discard unsaved Post?')).toBeTruthy()
    expect(mocks.confirm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(mocks.onCancel).toHaveBeenCalled())
    expect(mocks.composer.discardAll).toHaveBeenCalled()
  })

  it('publishes successfully and reports completion', async () => {
    mocks.composer.visibility = 'private'
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

  it('keeps changed visibility dirty and blocked when publishing fails', async () => {
    mocks.composer.visibility = 'private'
    mocks.composer.submit.mockRejectedValueOnce(new Error('save failed'))
    render(<PostComposer initial={initial} onCancel={mocks.onCancel} onSaved={mocks.onSaved} postId={null} registerClose={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Publish Post' }))
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('save failed'))
    expect(mocks.blockerOptions?.shouldBlockFn()).toBe(true)
    expect(mocks.blockerOptions?.enableBeforeUnload()).toBe(true)
    expect(mocks.onSaved).not.toHaveBeenCalled()
  })

  it('discards pending uploads before proceeding with blocked navigation', async () => {
    mocks.blocker.status = 'blocked'
    render(<PostComposer initial={initial} onCancel={mocks.onCancel} onSaved={mocks.onSaved} postId={null} registerClose={() => undefined} />)
    expect(await screen.findByText('Discard unsaved Post?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(mocks.blocker.proceed).toHaveBeenCalled())
    expect(mocks.composer.discardAll).toHaveBeenCalled()
    expect(mocks.onCancel).not.toHaveBeenCalled()
  })

  it('keeps the composer open and toasts cleanup failures', async () => {
    mocks.composer.discardAll.mockRejectedValueOnce(new Error('cleanup offline'))
    render(<PostComposer initial={initial} onCancel={mocks.onCancel} onSaved={mocks.onSaved} postId={null} registerClose={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Post cleanup failed: cleanup offline'))
    expect(mocks.onCancel).not.toHaveBeenCalled()
  })

  it('catches image removal cleanup failures with an actionable toast', async () => {
    mocks.composer.images = [{ localId: 'pending', imageId: 'image-1', previewUrl: 'blob:preview', status: 'ready', error: null, ownedPending: true }]
    mocks.composer.remove.mockRejectedValueOnce(new Error('discard rejected'))
    render(<PostComposer initial={initial} onCancel={mocks.onCancel} onSaved={mocks.onSaved} postId={null} registerClose={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove image 1' }))
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Image cleanup failed: discard rejected'))
  })
})
