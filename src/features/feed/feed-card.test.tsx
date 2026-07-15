// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FeedCard as FeedCardData } from '../social/shared/social-contracts'
import { FeedCard } from './feed-card'

vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }))
const author = { id: 'owner', username: 'mika', displayName: 'Mika', avatarUrl: null }
const anime = { anilistId: 154587, slug: 'frieren', title: 'Frieren', coverImageUrl: null, format: null, seasonYear: null }
const common = { id: 'card', author }

beforeEach(() => vi.setSystemTime(new Date('2026-07-14T04:00:00.000Z')))
afterEach(cleanup)

describe('FeedCard Post media', () => {
  it.each([
    { kind: 'post', card: { ...common, kind: 'post', postId: 'post', text: 'Post', media: null, hasSpoiler: false, visibility: 'public', createdAt: 1, updatedAt: 1 } },
    { kind: 'review', card: { ...common, kind: 'review', anime, reviewId: 'review', rating: 91, summary: 'Summary', containsSpoiler: false, visibility: 'public', publishedAt: 1, updatedAt: 1 } },
    { kind: 'completed', card: { ...common, kind: 'completed', anime, settledAt: 1, visibility: 'public' } },
    { kind: 'rewatched', card: { ...common, kind: 'rewatched', anime, settledAt: 1, visibility: 'public' } },
  ] satisfies { kind: FeedCardData['kind']; card: FeedCardData }[])('renders author avatar instead of a $kind activity icon', ({ card }) => {
    render(<FeedCard card={card} onChanged={() => undefined} onEdit={() => undefined} owner={false} signedIn={false} />)
    const header = screen.getByRole('article').querySelector('header')
    expect(screen.getByRole('img', { name: 'Mika avatar' })).toBeTruthy()
    expect(header?.querySelector('[class*="lucide-"]')).toBeNull()
  })

  it('covers text and media with one local whole-Post spoiler', () => {
    const card: FeedCardData = { ...common, kind: 'post', postId: 'post', text: 'Secret', media: { type: 'image', url: 'https://media.example/image', description: null }, hasSpoiler: true, visibility: 'public', createdAt: Date.now() - 120_000, updatedAt: Date.now() - 120_000 }
    render(<FeedCard card={card} onChanged={() => undefined} onEdit={() => undefined} owner={false} signedIn />)
    expect(screen.getByRole('article').className).toContain('border-l-coral-400')
    expect(screen.getByText('Mika posted')).toBeTruthy()
    expect(screen.getByText('2m ago')).toBeTruthy()
    expect(screen.queryByText('Secret')).toBeNull()
    expect(screen.queryByRole('img', { name: 'Image attached to post by mika' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reveal Post spoiler' }))
    expect(screen.getByText('Secret')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Image attached to post by mika' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Like · Coming in Phase 6' }).hasAttribute('disabled')).toBe(true)
    expect(screen.queryByText('142')).toBeNull()
    expect(screen.queryByText(/bookmark/i)).toBeNull()
  })

  it('renders media-only linked video Posts', () => {
    const card: FeedCardData = { ...common, kind: 'post', postId: 'post', text: '', media: { type: 'video', url: 'https://vimeo.com/123', provider: 'vimeo', label: 'Trailer' }, hasSpoiler: false, visibility: 'public', createdAt: Date.now(), updatedAt: Date.now() }
    render(<FeedCard card={card} onChanged={() => undefined} onEdit={() => undefined} owner={false} signedIn={false} />)
    expect(screen.getByRole('link', { name: 'Trailer' }).getAttribute('href')).toBe('https://vimeo.com/123')
    expect(screen.getByRole('article').className).toContain('hover:border-y-white/15')
    expect(screen.getByRole('link', { name: 'now' }).className).toContain('focus-visible:ring-2')
    expect(screen.queryByRole('link', { name: /Anime Detail/ })).toBeNull()
  })

  it('routes the whole Review body while keeping owner controls outside it', () => {
    const card: FeedCardData = { ...common, kind: 'review', anime: { ...anime, coverImageUrl: 'https://example.test/cover.jpg' }, reviewId: 'review', rating: 91, summary: 'Summary', containsSpoiler: true, visibility: 'public', publishedAt: Date.now() - 3_600_000, updatedAt: Date.now() - 3_600_000 }
    render(<FeedCard card={card} onChanged={() => undefined} onEdit={() => undefined} owner signedIn={false} />)
    expect(screen.getByRole('article').className).toContain('border-l-cyan-300')
    expect(screen.getByText('Mika reviewed Frieren')).toBeTruthy()
    expect(screen.getByText('1h ago')).toBeTruthy()
    const reviewLink = screen.getByRole('link', { name: 'Read Frieren review by Mika' })
    expect(reviewLink.getAttribute('href')).toBe('/reviews/review')
    expect(reviewLink.textContent).toContain('Frieren')
    expect(reviewLink.textContent).toContain('Summary')
    expect(reviewLink.textContent).toContain('Spoiler')
    expect(screen.getByText('91')).toBeTruthy()
    expect(reviewLink.querySelector('a, button')).toBeNull()
    expect(reviewLink.contains(screen.getByRole('button', { name: 'Owner actions' }))).toBe(false)
    expect(reviewLink.contains(screen.getByRole('link', { name: '1h ago' }))).toBe(false)
    expect(screen.getByText('Summary')).toBeTruthy()
    expect(screen.queryByText('Read Review')).toBeNull()
    expect(screen.queryByRole('img', { name: 'Frieren cover' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Coming in Phase 6/ })).toBeNull()
  })

  it.each(['completed', 'rewatched'] as const)('renders %s year and format in the whole-row detail link', (kind) => {
    const card: FeedCardData = { ...common, kind, anime: { ...anime, format: 'TV', seasonYear: 2024 }, settledAt: 1, visibility: 'public' }
    render(<FeedCard card={card} onChanged={() => undefined} onEdit={() => undefined} owner={false} signedIn={false} />)
    expect(screen.getByRole('article').className).toContain('border-l-cyan-300')
    expect(screen.getByText(kind === 'completed' ? 'Mika completed Frieren' : 'Mika rewatched Frieren')).toBeTruthy()
    const detailLink = screen.getByRole('link', { name: /Frieren/ })
    expect(detailLink.getAttribute('href')).toBe('/anime/154587/frieren')
    expect(detailLink.textContent).toContain('2024 · TV')
    expect(screen.getByText(kind === 'completed' ? 'Completed' : 'Rewatched')).toBeTruthy()
    expect(screen.queryByText(/score/i)).toBeNull()
    expect(screen.queryByText(/description/i)).toBeNull()
  })

  it.each(['completed', 'rewatched'] as const)('renders %s fallback metadata', (kind) => {
    const card: FeedCardData = { ...common, kind, anime: { ...anime, format: null, seasonYear: null }, settledAt: 1, visibility: 'public' }
    render(<FeedCard card={card} onChanged={() => undefined} onEdit={() => undefined} owner={false} signedIn={false} />)
    expect(screen.getByRole('link', { name: /Frieren/ }).textContent).toContain('TBA · Anime')
  })
})
