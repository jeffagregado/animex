// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { FeedCard as FeedCardData } from '../social/shared/social-contracts'
import { FeedCard } from './feed-card'

vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }))

const author = { id: 'owner', username: 'mika', displayName: 'Mika', avatarUrl: null }
const anime = { anilistId: 154587, slug: 'frieren', title: 'Frieren', coverImageUrl: null }
const common = { id: 'card', author }

afterEach(cleanup)

describe('FeedCard', () => {
  it('reveals whole Post spoilers and shows no fake social counts', () => {
    const card: FeedCardData = { ...common, kind: 'post', postId: 'post', text: 'Secret', imageIds: [], imageUrls: [], hasSpoiler: true, visibility: 'public', createdAt: Date.now(), updatedAt: Date.now() }
    render(<FeedCard card={card} onChanged={() => undefined} onEdit={() => undefined} owner={false} signedIn />)
    expect(screen.queryByText('Secret')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reveal Post spoiler' }))
    expect(screen.getByText('Secret')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Like · Coming in Phase 6' }).hasAttribute('disabled')).toBe(true)
    expect(screen.queryByText(/\b\d+\b/)).toBeNull()
  })

  it('routes Review cards with reviewId and reveals only Summary', () => {
    const card: FeedCardData = { ...common, kind: 'review', anime, reviewId: 'review-source', rating: 91, summary: 'Summary', summaryHasSpoiler: true, visibility: 'public', publishedAt: 1, updatedAt: 1 }
    render(<FeedCard card={card} onChanged={() => undefined} onEdit={() => undefined} owner signedIn={false} />)
    expect(screen.queryByRole('button', { name: 'Owner actions' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reveal Summary spoiler' }))
    expect(screen.getByText('Summary')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Read Review' }).getAttribute('href')).toBe('/reviews/review-source')
    expect(screen.queryByRole('button', { name: /Coming in Phase 6/ })).toBeNull()
  })

  it.each(['completed', 'rewatched'] as const)('renders compact %s Anime Detail activity', (kind) => {
    const card: FeedCardData = { ...common, kind, anime, settledAt: 1 }
    render(<FeedCard card={card} onChanged={() => undefined} onEdit={() => undefined} owner={false} signedIn={false} />)
    expect(screen.getByRole('link', { name: /View Anime Detail/ }).getAttribute('href')).toBe('/anime/154587/frieren')
    expect(screen.getByText(kind === 'completed' ? 'Completed' : 'Rewatched')).toBeTruthy()
  })
})
