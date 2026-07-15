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
    expect(screen.getByLabelText('Rating: 90 out of 100')).toBeTruthy()
    expect(screen.getByText('Visible ending summary')).toBeTruthy()
    expect(screen.getByText('My Followers')).toBeTruthy()
    expect(screen.getByText('Spoiler')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Review Detail' }).getAttribute('href')).toBe('/reviews/review-1')
    expect(screen.queryByRole('img', { name: /avatar/i })).toBeNull()
    expect(screen.queryByText(/body/i)).toBeNull()
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
