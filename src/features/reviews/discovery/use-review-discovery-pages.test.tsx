// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ReviewDiscoveryInput, ReviewDiscoveryPage } from '../shared/review-discovery-contracts'
import { useReviewDiscoveryPages } from './use-review-discovery-pages'

const query = vi.fn()
const client = { query }
vi.mock('convex/react', () => ({ useConvex: () => client }))

const review = (id: string) => ({ id, author: { id: 'author', username: 'author', displayName: 'Author', avatarUrl: null }, anime: { publicId: 'anime_frieren', slug: 'frieren', title: 'Frieren', coverImageUrl: null }, state: 'published' as const, rating: 90, summary: `Summary ${id}`, containsSpoiler: false, visibility: 'public' as const, publishedAt: 1, updatedAt: 1 })
const page = (ids: string[], cursor: string | null, hasMore: boolean): ReviewDiscoveryPage => ({ items: ids.map(review), cursor, hasMore })
const input: Omit<ReviewDiscoveryInput, 'cursor'> = { query: null, sort: 'newest', ratingBand: null, visibility: 'public' }
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (cause: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }

beforeEach(() => query.mockReset())

describe('useReviewDiscoveryPages', () => {
  it('does not query before auth-ready normalization', () => {
    renderHook(() => useReviewDiscoveryPages(input, 'signed-out', false))
    expect(query).not.toHaveBeenCalled()
  })

  it('isolates stale scopes and deduplicates page IDs', async () => {
    const first = deferred<unknown>()
    query.mockReturnValueOnce(first.promise).mockResolvedValueOnce(page(['fresh', 'fresh'], null, false))
    const { result, rerender } = renderHook(({ scopeInput, authKey }: { scopeInput: Omit<ReviewDiscoveryInput, 'cursor'>; authKey: string }) => useReviewDiscoveryPages(scopeInput, authKey, true), { initialProps: { scopeInput: input, authKey: 'signed-out' } })
    rerender({ scopeInput: { ...input, ratingBand: '90-100' }, authKey: 'profile-1' })
    expect(result.current.items).toEqual([])
    await act(async () => { first.resolve(page(['stale'], null, false)); await first.promise })
    await waitFor(() => expect(result.current.items.map((item) => item.id)).toEqual(['fresh']))
  })

  it('guards same-cursor requests and retries failed cursor without removing cards', async () => {
    const next = deferred<unknown>()
    query.mockResolvedValueOnce(page(['one'], 'cursor-1', true)).mockReturnValueOnce(next.promise).mockResolvedValueOnce(page(['one', 'two'], null, false))
    const { result } = renderHook(() => useReviewDiscoveryPages(input, 'signed-out', true))
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    act(() => { void result.current.loadMore(); void result.current.loadMore() })
    expect(query).toHaveBeenCalledTimes(2)
    await act(async () => { next.reject(new Error('offline')); try { await next.promise } catch {} })
    await waitFor(() => expect(result.current.error).toBe('offline'))
    expect(result.current.items.map((item) => item.id)).toEqual(['one'])
    await act(async () => { await result.current.retry() })
    expect(result.current.items.map((item) => item.id)).toEqual(['one', 'two'])
  })
})
