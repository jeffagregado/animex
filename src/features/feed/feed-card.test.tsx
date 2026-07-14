// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FeedCard as FeedCardData } from '../social/shared/social-contracts'
import { FeedCard } from './feed-card'

vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }))
const common = { id: 'card', author: { id: 'owner', username: 'mika', displayName: 'Mika', avatarUrl: null } }

beforeEach(() => vi.setSystemTime(new Date('2026-07-14T04:00:00.000Z')))
afterEach(cleanup)

describe('FeedCard Post media', () => {
  it('covers text and media with one local whole-Post spoiler', () => {
    const card: FeedCardData = { ...common, kind: 'post', postId: 'post', text: 'Secret', media: { type: 'image', url: 'https://media.example/image', description: null }, hasSpoiler: true, visibility: 'public', createdAt: Date.now(), updatedAt: Date.now() }
    render(<FeedCard card={card} onChanged={() => undefined} onEdit={() => undefined} owner={false} signedIn />)
    expect(screen.queryByText('Secret')).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reveal Post spoiler' }))
    expect(screen.getByText('Secret')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Image attached to post by mika' })).toBeTruthy()
  })

  it('renders media-only linked video Posts', () => {
    const card: FeedCardData = { ...common, kind: 'post', postId: 'post', text: '', media: { type: 'video', url: 'https://vimeo.com/123', provider: 'vimeo', label: 'Trailer' }, hasSpoiler: false, visibility: 'public', createdAt: Date.now(), updatedAt: Date.now() }
    render(<FeedCard card={card} onChanged={() => undefined} onEdit={() => undefined} owner={false} signedIn={false} />)
    expect(screen.getByRole('link', { name: 'Trailer' }).getAttribute('href')).toBe('https://vimeo.com/123')
  })

  it('routes Review cards and reveals only their Summary', () => {
    const card: FeedCardData = { ...common, kind: 'review', anime: { anilistId: 1, slug: 'anime', title: 'Anime', coverImageUrl: null }, reviewId: 'review', rating: 91, summary: 'Summary', summaryHasSpoiler: true, visibility: 'public', publishedAt: 1, updatedAt: 1 }
    render(<FeedCard card={card} onChanged={() => undefined} onEdit={() => undefined} owner={false} signedIn={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reveal Summary spoiler' }))
    expect(screen.getByText('Summary')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Read Review' }).getAttribute('href')).toBe('/reviews/review')
  })

  it.each(['completed', 'rewatched'] as const)('renders %s activity metadata', (kind) => {
    const card: FeedCardData = { ...common, kind, anime: { anilistId: 1, slug: 'anime', title: 'Anime', coverImageUrl: null, format: null, seasonYear: null }, settledAt: 1, visibility: 'public' }
    render(<FeedCard card={card} onChanged={() => undefined} onEdit={() => undefined} owner={false} signedIn={false} />)
    expect(screen.getByText(kind === 'completed' ? 'Completed' : 'Rewatched')).toBeTruthy()
  })
})
