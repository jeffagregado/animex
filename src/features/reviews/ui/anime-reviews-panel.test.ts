import { describe, expect, it } from 'vitest'

import type { ReviewListItem } from '#/features/social/shared/social-contracts'
import { getRatingBandLabel, getReviewWriteHref, reconcileReviewItems } from './anime-reviews-panel'

const item = (id: string): ReviewListItem => ({
  id,
  author: { id: `author-${id}`, username: `user-${id}`, displayName: `User ${id}`, avatarUrl: null },
  anime: { anilistId: 1, slug: 'frieren', title: 'Frieren', coverImageUrl: null },
  state: 'published', rating: 90, summary: 'Summary', containsSpoiler: false,
  visibility: 'public', publishedAt: 1, updatedAt: 1,
})

describe('Anime Reviews panel helpers', () => {
  it('replaces first page and appends unique later pages', () => {
    expect(reconcileReviewItems([item('old')], [item('new')], null).map((review) => review.id)).toEqual(['new'])
    expect(reconcileReviewItems([item('a')], [item('a'), item('b')], 'cursor').map((review) => review.id)).toEqual(['a', 'b'])
  })

  it('resumes Drafts and opens published Review Detail', () => {
    expect(getReviewWriteHref(null, 1, 'frieren')).toBe('/anime/1/frieren/reviews/new')
    expect(getReviewWriteHref(item('review-1'), 1, 'frieren')).toBe('/reviews/review-1')
    expect(getReviewWriteHref({ ...item('draft-1'), state: 'draft', rating: null, summary: '', publishedAt: null }, 1, 'frieren')).toBe('/anime/1/frieren/reviews/new')
  })

  it('labels rating bands as exact non-overlapping intervals', () => {
    expect(Array.from({ length: 10 }, (_, index) => getRatingBandLabel(index))).toEqual([
      '90–100', '80–<90', '70–<80', '60–<70', '50–<60',
      '40–<50', '30–<40', '20–<30', '10–<20', '0–<10',
    ])
  })
})
