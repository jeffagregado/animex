// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ReviewDiscoveryPageState } from './use-review-discovery-pages'
import { ReviewDiscoveryPage } from './review-discovery-page'

const mocks = vi.hoisted(() => ({ pages: vi.fn(), auth: vi.fn(), change: vi.fn() }))
vi.mock('./use-review-discovery-pages', () => ({ useReviewDiscoveryPages: mocks.pages }))
vi.mock('#/features/shell/public-auth-context', () => ({ usePublicAuthState: mocks.auth }))

const review = { id: 'review-1', author: { id: 'author', username: 'author', displayName: 'Author', avatarUrl: null }, anime: { anilistId: 1, slug: 'frieren', title: 'Frieren', coverImageUrl: null }, state: 'published' as const, rating: 90, summary: 'Compact summary', summaryHasSpoiler: false, visibility: 'public' as const, publishedAt: 1, updatedAt: 1 }
const loadMore = vi.fn<() => Promise<void>>()
const readyPages: ReviewDiscoveryPageState = { items: [review], cursor: null, hasMore: false, error: null, initialLoading: false, loadingMore: false, loadMore, retry: vi.fn() }
const state = { query: null, sort: 'newest' as const, ratingBand: null, visibility: 'public' as const }

beforeEach(() => {
  vi.useFakeTimers()
  mocks.auth.mockReturnValue({ status: 'ready', authState: { status: 'signedOut' } })
  mocks.pages.mockReturnValue(readyPages)
  mocks.change.mockReset()
  loadMore.mockReset()
  loadMore.mockResolvedValue(undefined)
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('ReviewDiscoveryPage', () => {
  it('debounces valid search for 300 ms and keeps short search out of query state', () => {
    const view = render(<ReviewDiscoveryPage searchState={state} onSearchStateChange={mocks.change} />)
    const search = screen.getByRole('searchbox', { name: 'Search reviews' })
    fireEvent.change(search, { target: { value: 'f' } })
    vi.advanceTimersByTime(300)
    expect(mocks.change).not.toHaveBeenCalled()
    fireEvent.change(search, { target: { value: 'frieren' } })
    vi.advanceTimersByTime(299)
    expect(mocks.change).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(mocks.change).toHaveBeenCalledWith({ ...state, query: 'frieren' })
    view.rerender(<ReviewDiscoveryPage searchState={{ ...state, query: 'frieren', sort: 'rating-high' }} onSearchStateChange={mocks.change} />)
    expect((screen.getByRole('combobox', { name: 'Sort reviews' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Relevance')).toBeTruthy()
    expect((screen.getByRole('combobox', { name: 'Rating filter' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('shows signed-in visibility options and truthful compact card fields', () => {
    mocks.auth.mockReturnValue({ status: 'ready', authState: { status: 'complete', email: 'fan@example.com', profile: { id: 'author', username: 'author', name: 'Author', avatarUrl: null, visibility: 'public' } } })
    render(<ReviewDiscoveryPage searchState={{ ...state, visibility: 'all' }} onSearchStateChange={mocks.change} />)
    expect(screen.getByRole('combobox', { name: 'Visibility filter' })).toBeTruthy()
    expect(screen.getByText('Frieren')).toBeTruthy()
    expect(screen.getByLabelText('Rating: 90 out of 100')).toBeTruthy()
    expect(screen.getByText('Compact summary')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Review Detail' }).getAttribute('href')).toBe('/reviews/review-1')
    expect(screen.queryByText(/body/i)).toBeNull()
  })

  it('loads from intersection once and preserves geometry states without horizontal overflow classes', async () => {
    vi.useRealTimers()
    const observerCallbacks: IntersectionObserverCallback[] = []
    class Observer {
      constructor(callback: IntersectionObserverCallback) { observerCallbacks.push(callback) }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', Observer)
    mocks.pages.mockReturnValue({ ...readyPages, hasMore: true })
    const { container, rerender } = render(<ReviewDiscoveryPage searchState={state} onSearchStateChange={mocks.change} />)
    await waitFor(() => expect(observerCallbacks).toHaveLength(1))
    const intersect = observerCallbacks[0]
    if (intersect === undefined) throw new Error('Expected Review discovery observer.')
    intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    expect(loadMore).toHaveBeenCalledTimes(1)
    expect(container.firstElementChild?.className).toContain('min-w-0')
    expect(container.firstElementChild?.className).toContain('overflow-x-hidden')
    expect(container.firstElementChild?.className).toContain('pb-28')
    mocks.pages.mockReturnValue({ ...readyPages, items: [], error: 'offline', retry: vi.fn() })
    rerender(<ReviewDiscoveryPage searchState={state} onSearchStateChange={mocks.change} />)
    expect(screen.getByRole('alert').textContent).toContain('offline')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })
})
