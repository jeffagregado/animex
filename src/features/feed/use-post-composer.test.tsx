// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { usePostComposer } from './use-post-composer'

const mocks = vi.hoisted(() => ({ index: 0, create: vi.fn(), update: vi.fn() }))
vi.mock('convex/react', () => ({ useMutation: () => [mocks.create, mocks.update][mocks.index++ % 2] }))

const initial = { text: '', media: null, hasSpoiler: false, visibility: 'public' as const }

beforeEach(() => {
  mocks.index = 0
  mocks.create.mockReset().mockResolvedValue('post-1')
  mocks.update.mockReset().mockResolvedValue('post-1')
})

describe('usePostComposer', () => {
  it('submits media-only image Posts with optional descriptions', async () => {
    const { result } = renderHook(() => usePostComposer(initial))
    act(() => { result.current.setMediaType('image'); result.current.setMediaUrl('https://media.example/image'); result.current.setMediaCopy('Cover art') })
    await act(async () => result.current.submit(null))
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ text: '', media: { type: 'image', url: 'https://media.example/image', description: 'Cover art' } }))
  })

  it('derives provider only after explicit Video choice', async () => {
    const { result } = renderHook(() => usePostComposer(initial))
    act(() => { result.current.setMediaType('video'); result.current.setMediaUrl('https://youtu.be/dQw4w9WgXcQ') })
    await act(async () => result.current.submit(null))
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ media: { type: 'video', url: 'https://youtu.be/dQw4w9WgXcQ', provider: 'youtube', label: null } }))
  })

  it('retains invalid URL drafts and exposes inline validation', async () => {
    const { result } = renderHook(() => usePostComposer(initial))
    act(() => { result.current.setMediaType('image'); result.current.setMediaUrl('http://unsafe.example/image') })
    expect(result.current.mediaError).toBe('Media URL must use HTTPS without credentials.')
    await expect(result.current.submit(null)).rejects.toThrow('Media URL must use HTTPS without credentials.')
    expect(result.current.mediaDraft?.url).toBe('http://unsafe.example/image')
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('removes persisted media before updating', async () => {
    const edit = { ...initial, text: 'Keep this text', media: { type: 'image' as const, url: 'https://media.example/old', description: null } }
    const { result } = renderHook(() => usePostComposer(edit))
    act(() => result.current.removeMedia())
    await act(async () => result.current.submit('post-1'))
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ postId: 'post-1', media: null }))
  })

  it('replaces persisted image media with a labeled video', async () => {
    const edit = { ...initial, text: 'Edit', media: { type: 'image' as const, url: 'https://media.example/old', description: null } }
    const { result } = renderHook(() => usePostComposer(edit))
    act(() => { result.current.setMediaType('video'); result.current.setMediaUrl('https://vimeo.com/123'); result.current.setMediaCopy('Trailer') })
    await act(async () => result.current.submit('post-1'))
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ media: { type: 'video', url: 'https://vimeo.com/123', provider: 'vimeo', label: 'Trailer' } }))
  })

  it('retains edits and unlocks the composer after mutation failure', async () => {
    mocks.update.mockRejectedValueOnce(new Error('save offline'))
    const edit = { ...initial, text: 'Original', media: null }
    const { result } = renderHook(() => usePostComposer(edit))
    act(() => result.current.setText('Changed'))
    await expect(result.current.submit('post-1')).rejects.toThrow('save offline')
    expect(result.current.text).toBe('Changed')
    expect(result.current.submitting).toBe(false)
    expect(result.current.dirty).toBe(true)
  })
})
