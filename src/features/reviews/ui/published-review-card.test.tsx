// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ReviewListItem } from '#/features/social/shared/social-contracts'
import { PublishedReviewCard } from './published-review-card'

const publishedReview: ReviewListItem = {
  id: 'review-1',
  author: { id: 'author-1', username: 'author', displayName: 'Author', avatarUrl: null },
  anime: { anilistId: 1, slug: 'frieren', title: 'Frieren', coverImageUrl: 'https://example.test/frieren.jpg' },
  state: 'published',
  rating: 90,
  summary: 'Visible ending summary',
  containsSpoiler: true,
  visibility: 'followers',
  publishedAt: Date.now() - 2 * 60 * 60 * 1_000,
  updatedAt: Date.now(),
}

afterEach(cleanup)

describe('PublishedReviewCard', () => {
  it('renders approved listing metadata and spoiler warning without body or author avatar', () => {
    render(<PublishedReviewCard review={publishedReview} />)

    expect(screen.getByRole('img', { name: 'Frieren cover' })).toBeTruthy()
    expect(screen.getByText('Author')).toBeTruthy()
    expect(screen.getByText('2h ago')).toBeTruthy()
    const rating = screen.getByLabelText('Rating: 90 out of 100')
    expect(screen.getByText('Visible ending summary')).toBeTruthy()
    expect(screen.queryByText(/Followers/)).toBeNull()
    expect(screen.getByText('Spoiler')).toBeTruthy()
    const detailLink = screen.getByRole('link', { name: 'Review Detail' })
    expect(screen.getAllByLabelText('Rating: 90 out of 100')).toHaveLength(1)
    expect(rating.parentElement).toBe(detailLink.parentElement)
    expect(rating.className).toContain('sm:absolute')
    expect(detailLink.parentElement?.className).toContain('row-start-3')
    expect(detailLink.parentElement?.className).toContain('items-center')
    expect(detailLink.parentElement?.className).toContain('justify-between')
    expect(detailLink.getAttribute('href')).toBe('/reviews/review-1')
    expect(detailLink.className).toContain('hover:underline')
    expect(screen.queryByRole('img', { name: /avatar/i })).toBeNull()
    expect(screen.queryByText(/body/i)).toBeNull()
  })

  it('labels private owner-only Reviews without exposing Followers wording', () => {
    render(<PublishedReviewCard review={{ ...publishedReview, visibility: 'followers' }} />)
    expect(screen.queryByText(/Followers/)).toBeNull()
    cleanup()

    render(<PublishedReviewCard review={{ ...publishedReview, visibility: 'private' }} />)
    expect(screen.getByText('My Private')).toBeTruthy()
  })

  it('keeps long listing content separate from mobile rating and detail actions', () => {
    const longReview: ReviewListItem = {
      ...publishedReview,
      author: {
        ...publishedReview.author,
        displayName: 'A very long Review author display name that must wrap safely',
      },
      anime: {
        ...publishedReview.anime,
        title: 'Frieren Beyond Journey End With An Intentionally Long Anime Title',
      },
      summary: 'A long Summary that remains readable without overlapping the mobile Rating or Review Detail action row.',
    }
    render(<PublishedReviewCard review={longReview} />)

    const title = screen.getByRole('heading', { name: longReview.anime.title })
    const content = title.parentElement
    const rating = screen.getByLabelText('Rating: 90 out of 100')
    const detail = screen.getByRole('link', { name: 'Review Detail' })

    expect(title.className).toContain('truncate')
    expect(content?.className).toContain('min-w-0')
    expect(rating.parentElement).toBe(detail.parentElement)
    expect(detail.parentElement?.className).toContain('justify-between')
  })

  it('preserves cover geometry after image failure', () => {
    render(<PublishedReviewCard review={publishedReview} />)
    const image = screen.getByRole('img', { name: 'Frieren cover' })
    const cover = image.parentElement
    fireEvent.error(image)
    expect(screen.getByLabelText('Image unavailable')).toBeTruthy()
    expect(cover?.className).toContain('overflow-hidden')
  })

  it.each([
    { ...publishedReview, state: 'draft' as const },
    { ...publishedReview, rating: null },
    { ...publishedReview, publishedAt: null },
  ])('rejects non-published listing metadata', (review) => {
    expect(() => render(<PublishedReviewCard review={review} />)).toThrow('Published Review cards require published Review metadata.')
  })
})
