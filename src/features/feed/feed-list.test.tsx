// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FeedCard } from '../social/shared/social-contracts'
import { FeedList } from './feed-list'

vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }))

const card: FeedCard = { id: 'card', kind: 'post', postId: 'post', author: { id: 'author', username: 'author', displayName: 'Author', avatarUrl: null }, text: 'Post', media: null, hasSpoiler: false, visibility: 'public', createdAt: 1, updatedAt: 1 }
const props = { cards: [card], error: null, hasMore: true, initialLoading: false, loadingMore: false, ownerId: null, loadMore: vi.fn(), onChanged: vi.fn(), onEdit: vi.fn(), retry: vi.fn(), view: 'home' as const }

let intersect: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null

beforeEach(() => { Object.values(props).forEach((value) => { if (typeof value === 'function') value.mockClear() }); intersect = null })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('FeedList', () => {
  it('loads once for duplicate observer intersections', async () => {
    class Observer {
      constructor(callback: typeof intersect) { intersect = callback }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', Observer)
    render(<FeedList {...props} />)
    await waitFor(() => expect(intersect).not.toBeNull())
    intersect?.([{ isIntersecting: true }])
    intersect?.([{ isIntersecting: true }])
    expect(props.loadMore).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
  })

  it('shows accessible manual loading fallback only without observer support', async () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    render(<FeedList {...props} />)
    expect(await screen.findByRole('button', { name: 'Load more' })).toBeTruthy()
  })

  it('does not observe while initial cards are loading', async () => {
    const observe = vi.fn()
    class Observer {
      observe = observe
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', Observer)
    render(<FeedList {...props} cards={[]} initialLoading />)
    await waitFor(() => expect(screen.getByRole('region', { name: 'Loading feed' })).toBeTruthy())
    expect(observe).not.toHaveBeenCalled()
  })

  it('keeps loaded cards with scoped retry and terminal states', () => {
    const view = render(<FeedList {...props} error="offline" />)
    expect(screen.getByText('Post')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('offline')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    view.rerender(<FeedList {...props} hasMore={false} />)
    expect(screen.getByText('You’re all caught up.')).toBeTruthy()
  })
})
