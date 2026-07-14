// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { FeedPage } from '../social/shared/social-contracts'
import { useFeedPages, type FeedView } from './use-feed-pages'

const query = vi.fn()
const client = { query }
vi.mock('convex/react', () => ({ useConvex: () => client }))

const post = (id: string) => ({ id, kind: 'post' as const, postId: `post-${id}`, author: { id: 'author', username: 'author', displayName: 'Author', avatarUrl: null }, text: id, media: null, hasSpoiler: false, visibility: 'public' as const, createdAt: 1, updatedAt: 1 })
const page = (ids: string[], cursor: string | null, hasMore: boolean): FeedPage<ReturnType<typeof post>> => ({ items: ids.map(post), cursor, hasMore })
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (cause: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }

beforeEach(() => query.mockReset())

describe('useFeedPages', () => {
  it('clears immediately and ignores late pages when view/auth scope changes', async () => {
    const home = deferred<unknown>()
    const global = deferred<unknown>()
    query.mockReturnValueOnce(home.promise).mockReturnValueOnce(global.promise)
    const { result, rerender } = renderHook(({ view, authKey }: { view: FeedView; authKey: string }) => useFeedPages(view, authKey), { initialProps: { view: 'home', authKey: 'profile-1' } })
    rerender({ view: 'global', authKey: 'signed-out' })
    expect(result.current.items).toEqual([])
    await act(async () => { home.resolve(page(['private'], null, false)); await home.promise })
    expect(result.current.items).toEqual([])
    await act(async () => { global.resolve(page(['public'], null, false)); await global.promise })
    await waitFor(() => expect(result.current.items.map((item) => item.id)).toEqual(['public']))
  })

  it('suppresses concurrent same-cursor loads and retains cards for retry', async () => {
    const next = deferred<unknown>()
    query.mockResolvedValueOnce(page(['one'], 'cursor-1', true)).mockReturnValueOnce(next.promise).mockResolvedValueOnce(page(['two'], null, false))
    const { result } = renderHook(() => useFeedPages('global', 'signed-out'))
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    act(() => { void result.current.loadMore(); void result.current.loadMore() })
    expect(query).toHaveBeenCalledTimes(2)
    await act(async () => { next.reject(new Error('offline')); try { await next.promise } catch {} })
    await waitFor(() => expect(result.current.error).toBe('offline'))
    expect(result.current.items.map((item) => item.id)).toEqual(['one'])
    await act(async () => { await result.current.retry() })
    expect(result.current.items.map((item) => item.id)).toEqual(['one', 'two'])
  })

  it('advances past an empty source-suppressed page to reachable feed cards', async () => {
    query.mockResolvedValueOnce(page([], 'cursor-1', true)).mockResolvedValueOnce(page(['visible'], null, false))

    const { result } = renderHook(() => useFeedPages('global', 'signed-out'))

    await waitFor(() => expect(result.current.items.map((item) => item.id)).toEqual(['visible']))
    expect(query).toHaveBeenNthCalledWith(2, expect.anything(), { cursor: 'cursor-1' })
    expect(result.current.hasMore).toBe(false)
  })

  it('fails explicitly when an empty page repeats its cursor', async () => {
    query.mockResolvedValueOnce(page([], 'cursor-1', true)).mockResolvedValueOnce(page([], 'cursor-1', true))

    const { result } = renderHook(() => useFeedPages('global', 'signed-out'))

    await waitFor(() => expect(result.current.error).toBe('Feed pagination returned a repeated cursor.'))
    expect(query).toHaveBeenCalledTimes(2)
  })

  it.each(['refresh-first', 'load-more-first'] as const)('refresh invalidates load-more when %s resolves', async (order) => {
    const loadMore = deferred<unknown>()
    const refresh = deferred<unknown>()
    query.mockResolvedValueOnce(page(['one'], 'cursor-1', true)).mockReturnValueOnce(loadMore.promise).mockReturnValueOnce(refresh.promise)
    const { result } = renderHook(() => useFeedPages('global', 'signed-out'))
    await waitFor(() => expect(result.current.items.map((item) => item.id)).toEqual(['one']))
    act(() => { void result.current.loadMore() })
    await waitFor(() => expect(result.current.loadingMore).toBe(true))
    act(() => { void result.current.refresh() })
    expect(result.current.items).toEqual([])
    expect(result.current.initialLoading).toBe(true)
    if (order === 'refresh-first') {
      await act(async () => { refresh.resolve(page(['fresh'], null, false)); await refresh.promise })
      expect(result.current.items.map((item) => item.id)).toEqual(['fresh'])
      await act(async () => { loadMore.resolve(page(['stale'], null, false)); await loadMore.promise })
    } else {
      await act(async () => { loadMore.resolve(page(['stale'], null, false)); await loadMore.promise })
      expect(result.current.initialLoading).toBe(true)
      await act(async () => { refresh.resolve(page(['fresh'], null, false)); await refresh.promise })
    }
    expect(result.current.items.map((item) => item.id)).toEqual(['fresh'])
    expect(result.current.initialLoading).toBe(false)
  })
})
