// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AnimeReviewsContent, AnimeReviewsPanel } from './anime-reviews-panel'

const mocks = vi.hoisted(() => ({ query: vi.fn(), auth: vi.fn(), publicAuth: vi.fn() }))

vi.mock('convex/react', () => ({ useQuery: mocks.query, useConvexAuth: mocks.auth }))
vi.mock('#/features/shell/public-auth-context', () => ({ usePublicAuthState: mocks.publicAuth }))
vi.mock('#/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: { children: React.ReactNode; onValueChange: (value: string) => void; value: string }) => <select aria-label="Sort reviews" onChange={(event) => onValueChange(event.target.value)} value={value}>{children}</select>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <option value={value}>{children}</option>,
}))
vi.mock('./review-card', () => ({ ReviewCard: ({ review }: { review: { id: string } }) => <div>Review {review.id}</div> }))

const item = (id: string) => ({ id, author: { id: `author-${id}`, username: `user-${id}`, displayName: `User ${id}`, avatarUrl: null }, anime: { anilistId: 1, slug: 'frieren', title: 'Frieren', coverImageUrl: null }, state: 'published', rating: 90, summary: `Summary ${id}`, summaryHasSpoiler: false, visibility: 'public', publishedAt: 1, updatedAt: 1 })
const stats = { count: 2, average: 90, bands: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0] }
const firstPage = { items: [item('a')], cursor: 'next', hasMore: true }
const nextPage = { items: [item('b')], cursor: null, hasMore: false }
const emptyPage = { items: [], cursor: null, hasMore: false }
const emptyStats = { count: 0, average: null, bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }

beforeEach(() => {
  mocks.auth.mockReturnValue({ isAuthenticated: false })
  mocks.publicAuth.mockReturnValue({ status: 'ready', authState: { status: 'signedOut' } })
  mocks.query.mockImplementation((_query, args: { cursor?: string | null; sort?: string }) => args.sort ? (args.cursor === null ? firstPage : nextPage) : stats)
})

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('AnimeReviewsPanel behavior', () => {
  it('sorts, paginates, and hides private write actions when signed out', async () => {
    render(<AnimeReviewsContent anilistId={1} slug="frieren" />)
    expect(await screen.findByText('Review a')).toBeTruthy()
    expect(screen.queryByText('Write a review')).toBeNull()
    fireEvent.change(screen.getByLabelText('Sort reviews'), { target: { value: 'rating-high' } })
    await waitFor(() => expect(mocks.query).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ sort: 'rating-high', cursor: null })))
    fireEvent.click(screen.getByRole('button', { name: 'Load more reviews' }))
    expect(await screen.findByText('Review b')).toBeTruthy()
  })

  it('shows an actionable Retry after query failure', async () => {
    mocks.query.mockImplementation(() => { throw new Error('Reviews offline') })
    render(<AnimeReviewsPanel anilistId={1} slug="frieren" />)
    expect((await screen.findByRole('alert')).textContent).toContain('Reviews offline')
    mocks.query.mockImplementation((_query, args: { sort?: string }) => args.sort ? emptyPage : emptyStats)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('No reviews yet')).toBeTruthy()
  })
})
