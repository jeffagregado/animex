// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FeedCard as FeedCardData } from '../social/shared/social-contracts'
import { FeedCard } from './feed-card'

vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }))

const author = { id: 'owner', username: 'mika', displayName: 'Mika', avatarUrl: null }
const anime = { anilistId: 154587, slug: 'frieren', title: 'Frieren', coverImageUrl: null }
const common = { id: 'card', author }

beforeEach(() => vi.setSystemTime(new Date('2026-07-14T04:00:00.000Z')))
afterEach(cleanup)

describe('FeedCard', () => {
  it('reveals whole Post spoilers and shows no fake social counts', () => {
    const card: FeedCardData = { ...common, kind: 'post', postId: 'post', text: 'Secret', imageIds: [], imageUrls: [], hasSpoiler: true, visibility: 'public', createdAt: Date.now() - 120_000, updatedAt: Date.now() - 120_000 }
    render(<FeedCard card={card} onChanged={() => undefined} onEdit={() => undefined} owner={false} signedIn />)
    expect(screen.getByRole('article').className).toContain('border-l-coral-400')
    expect(screen.getByText('Mika posted')).toBeTruthy()
    expect(screen.getByText('2m ago')).toBeTruthy()
    expect(screen.queryByText('Secret')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reveal Post spoiler' }))
    expect(screen.getByText('Secret')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Like · Coming in Phase 6' }).hasAttribute('disabled')).toBe(true)
    expect(screen.queryByText('142')).toBeNull()
    expect(screen.queryByText(/bookmark/i)).toBeNull()
  })

  it('frames Post images responsively and exposes hover and focus-visible states', () => {
    const card: FeedCardData = { ...common, kind: 'post', postId: 'post', text: 'Images', imageIds: ['one'], imageUrls: ['https://example.test/one.jpg'], hasSpoiler: false, visibility: 'public', createdAt: Date.now(), updatedAt: Date.now() }
    render(<FeedCard card={card} onChanged={() => undefined} onEdit={() => undefined} owner={false} signedIn={false} />)
    expect(screen.getByRole('img', { name: 'Post image 1' }).className).toContain('aspect-video')
    expect(screen.getByRole('article').className).toContain('hover:border-y-white/15')
    expect(screen.getByRole('link', { name: 'now' }).className).toContain('focus-visible:ring-2')
    expect(screen.queryByRole('link', { name: /Anime Detail/ })).toBeNull()
  })

  it('routes Review cards with reviewId and reveals only Summary', () => {
    const card: FeedCardData = { ...common, kind: 'review', anime: { ...anime, coverImageUrl: 'https://example.test/cover.jpg' }, reviewId: 'review-source', rating: 91, summary: 'Summary', summaryHasSpoiler: true, visibility: 'public', publishedAt: Date.now() - 3_600_000, updatedAt: Date.now() - 3_600_000 }
    render(<FeedCard card={card} onChanged={() => undefined} onEdit={() => undefined} owner signedIn={false} />)
    expect(screen.getByRole('article').className).toContain('border-l-cyan-300')
    expect(screen.getByText('Mika reviewed Frieren')).toBeTruthy()
    expect(screen.getByText('1h ago')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Frieren cover' }).parentElement?.className).toContain('aspect-[2/3]')
    expect(screen.getByText('91')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Owner actions' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reveal Summary spoiler' }))
    expect(screen.getByText('Summary')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Read Review' }).getAttribute('href')).toBe('/reviews/review-source')
    expect(screen.queryByRole('button', { name: /Coming in Phase 6/ })).toBeNull()
  })

  it('preserves Review cover geometry after image failure', () => {
    const card: FeedCardData = { ...common, kind: 'review', anime: { ...anime, coverImageUrl: 'https://example.test/broken.jpg' }, reviewId: 'review-source', rating: 91, summary: 'Summary', summaryHasSpoiler: false, visibility: 'public', publishedAt: 1, updatedAt: 1 }
    render(<FeedCard card={card} onChanged={() => undefined} onEdit={() => undefined} owner={false} signedIn={false} />)
    fireEvent.error(screen.getByRole('img', { name: 'Frieren cover' }))
    const unavailable = screen.getByText('Image unavailable')
    expect(unavailable.parentElement?.parentElement?.className).toContain('aspect-[2/3]')
  })

  it.each(['completed', 'rewatched'] as const)('renders compact %s Anime Detail activity', (kind) => {
    const card: FeedCardData = { ...common, kind, anime, settledAt: 1, visibility: 'private' }
    render(<FeedCard card={card} onChanged={() => undefined} onEdit={() => undefined} owner={false} signedIn={false} />)
    expect(screen.getByRole('article').className).toContain('border-l-cyan-300')
    expect(screen.getByText(kind === 'completed' ? 'Mika completed Frieren' : 'Mika rewatched Frieren')).toBeTruthy()
    expect(screen.getByRole('link', { name: /View Anime Detail/ }).getAttribute('href')).toBe('/anime/154587/frieren')
    expect(screen.getByText(kind === 'completed' ? 'Completed' : 'Rewatched')).toBeTruthy()
    expect(screen.queryByText(/score/i)).toBeNull()
    expect(screen.queryByText(/description/i)).toBeNull()
  })
})
