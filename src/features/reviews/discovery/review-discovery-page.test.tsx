// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ReviewDiscoveryPageState } from './use-review-discovery-pages'
import { ReviewDiscoveryPage } from './review-discovery-page'

const mocks = vi.hoisted(() => ({ pages: vi.fn(), auth: vi.fn(), convexAuth: vi.fn(), change: vi.fn() }))
vi.mock('./use-review-discovery-pages', () => ({ useReviewDiscoveryPages: mocks.pages }))
vi.mock('#/features/shell/public-auth-context', () => ({ usePublicAuthState: mocks.auth }))
vi.mock('convex/react', () => ({ useConvexAuth: mocks.convexAuth }))

const review = { id: 'review-1', author: { id: 'author', username: 'author', displayName: 'Author', avatarUrl: null }, anime: { anilistId: 1, slug: 'frieren', title: 'Frieren', coverImageUrl: 'https://example.test/frieren.jpg' }, state: 'published' as const, rating: 90, summary: 'Compact summary', containsSpoiler: true, visibility: 'public' as const, publishedAt: 1, updatedAt: 1 }
const loadMore = vi.fn<() => Promise<void>>()
const readyPages: ReviewDiscoveryPageState = { items: [review], cursor: null, hasMore: false, error: null, initialLoading: false, loadingMore: false, loadMore, retry: vi.fn() }
const state = { query: null, sort: 'newest' as const, ratingBand: null, visibility: 'public' as const }

beforeEach(() => {
  vi.useFakeTimers()
  mocks.auth.mockReturnValue({ status: 'ready', authState: { status: 'signedOut' } })
  mocks.convexAuth.mockReturnValue({ isAuthenticated: false, isLoading: false })
  mocks.pages.mockReturnValue(readyPages)
  mocks.pages.mockClear()
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
    mocks.convexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false })
    render(<ReviewDiscoveryPage searchState={{ ...state, visibility: 'all' }} onSearchStateChange={mocks.change} />)
    fireEvent.click(screen.getByRole('combobox', { name: 'Visibility filter' }))
    expect(screen.getByRole('option', { name: 'All visibility' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Public' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'My Private' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'My Followers' })).toBeNull()
    expect(screen.getByText('Frieren')).toBeTruthy()
    expect(screen.getByLabelText('Rating: 90 out of 100')).toBeTruthy()
    expect(screen.getByText('Compact summary')).toBeTruthy()
    expect(screen.getByText('Spoiler')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Review Detail' }).getAttribute('href')).toBe('/reviews/review-1')
    expect(screen.queryByText(/body/i)).toBeNull()
  })

  it('waits for Convex auth before loading viewer-scoped visibility', () => {
    mocks.auth.mockReturnValue({ status: 'ready', authState: { status: 'complete', email: 'fan@example.com', profile: { id: 'author', username: 'author', name: 'Author', avatarUrl: null, visibility: 'public' } } })
    mocks.convexAuth.mockReturnValue({ isAuthenticated: false, isLoading: true })
    const searchState = { ...state, visibility: 'all' as const }
    const view = render(<ReviewDiscoveryPage searchState={searchState} onSearchStateChange={mocks.change} />)

    expect(mocks.pages).toHaveBeenLastCalledWith(searchState, 'auth-pending', false)
    expect(screen.getByLabelText('Loading review access')).toBeTruthy()

    mocks.convexAuth.mockReturnValue({ isAuthenticated: false, isLoading: false })
    view.rerender(<ReviewDiscoveryPage searchState={searchState} onSearchStateChange={mocks.change} />)
    expect(mocks.pages).toHaveBeenLastCalledWith(searchState, 'auth-pending', false)
    expect(screen.getByRole('alert').textContent).toContain('Refresh the page or sign in again.')

    mocks.convexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false })
    view.rerender(<ReviewDiscoveryPage searchState={searchState} onSearchStateChange={mocks.change} />)
    expect(mocks.pages).toHaveBeenLastCalledWith(searchState, 'author', true)
    expect(screen.getByText('Frieren')).toBeTruthy()
  })

  it('keeps two-column mobile/tablet filter geometry and one-column desktop visibility', () => {
    mocks.auth.mockReturnValue({ status: 'ready', authState: { status: 'complete', email: 'fan@example.com', profile: { id: 'author', username: 'author', name: 'Author', avatarUrl: null, visibility: 'public' } } })
    mocks.convexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false })
    render(<ReviewDiscoveryPage searchState={{ ...state, visibility: 'all' }} onSearchStateChange={mocks.change} />)
    const filters = screen.getByRole('region', { name: 'Review filters' })
    expect(filters.className).toContain('grid-cols-2')
    expect(filters.className).toContain('lg:grid-cols-3')
    expect(screen.getByRole('searchbox', { name: 'Search reviews' }).parentElement?.className).toContain('col-span-2')
    expect(screen.getByRole('searchbox', { name: 'Search reviews' }).parentElement?.className).toContain('lg:col-span-3')
    expect(screen.getByRole('combobox', { name: 'Visibility filter' }).parentElement?.className).toContain('col-span-2')
    expect(screen.getByRole('combobox', { name: 'Visibility filter' }).parentElement?.className).toContain('lg:col-span-1')
    for (const name of ['Sort reviews', 'Rating filter', 'Visibility filter']) {
      expect(screen.getByRole('combobox', { name }).className).toContain('min-h-11')
    }
  })

  it('keeps phased signed-in discovery loadable when the first lane is empty', () => {
    mocks.auth.mockReturnValue({ status: 'ready', authState: { status: 'complete', email: 'fan@example.com', profile: { id: 'author', username: 'author', name: 'Author', avatarUrl: null, visibility: 'public' } } })
    mocks.convexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false })
    mocks.pages.mockReturnValue({ ...readyPages, items: [], hasMore: true })
    render(<ReviewDiscoveryPage searchState={{ ...state, visibility: 'all' }} onSearchStateChange={mocks.change} />)

    expect(screen.queryByText('No reviews found')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(loadMore).toHaveBeenCalledTimes(1)
  })

  it('preserves cover geometry after image failure and renders relative publish time', () => {
    vi.setSystemTime(new Date('2026-07-14T12:00:00Z'))
    mocks.pages.mockReturnValue({ ...readyPages, items: [{ ...review, publishedAt: Date.now() - 2 * 60 * 60 * 1000 }] })
    render(<ReviewDiscoveryPage searchState={state} onSearchStateChange={mocks.change} />)
    const image = screen.getByRole('img', { name: 'Frieren cover' })
    const cover = image.parentElement
    fireEvent.error(image)
    expect(screen.getByLabelText('Image unavailable')).toBeTruthy()
    expect(cover?.className).toContain('overflow-hidden')
    expect(screen.getByText('2h ago')).toBeTruthy()
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
    expect(Array.from(container.querySelectorAll('[class]')).some((element) => element.getAttribute('class')?.includes('min-w-['))).toBe(false)
    expect(Array.from(container.querySelectorAll('[class]')).some((element) => element.getAttribute('class')?.includes('overflow-x-auto'))).toBe(false)
    mocks.pages.mockReturnValue({ ...readyPages, items: [], error: 'offline', retry: vi.fn() })
    rerender(<ReviewDiscoveryPage searchState={state} onSearchStateChange={mocks.change} />)
    expect(screen.getByRole('alert').textContent).toContain('offline')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })
})
