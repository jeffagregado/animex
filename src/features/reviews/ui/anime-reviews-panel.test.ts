import { describe, expect, it } from 'vitest'

import type { ReviewListItem } from '#/features/social/shared/social-contracts'
import { getReviewWriteHref, reconcileReviewItems } from './anime-reviews-panel'

const item = (id: string): ReviewListItem => ({
  id,
  author: { id: `author-${id}`, username: `user-${id}`, displayName: `User ${id}`, avatarUrl: null },
  anime: { anilistId: 1, slug: 'frieren', title: 'Frieren', coverImageUrl: null },
  state: 'published', rating: 90, summary: 'Summary', summaryHasSpoiler: false,
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
})
