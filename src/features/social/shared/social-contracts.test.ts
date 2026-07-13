import { describe, expect, test } from 'vitest'

import {
  ANIME_REVIEWS_PAGE_SIZE,
  FEED_PAGE_SIZE,
  POST_IMAGE_LIMIT,
  POST_IMAGE_MAX_BYTES,
  POST_TEXT_LIMIT,
  REVIEW_RATING_DEFAULT,
  createPostInputSchema,
  feedPageSchema,
  reviewDetailSchema,
  reviewListItemSchema,
  reviewPublishInputSchema,
  reviewRatingSchema,
  reviewStatsSchema,
  updatePostInputSchema,
} from './social-contracts'

const author = {
  id: 'user-1',
  username: 'frieren',
  displayName: 'Frieren',
  avatarUrl: null,
}

const anime = {
  anilistId: 52991,
  slug: 'frieren-beyond-journeys-end',
  title: "Frieren: Beyond Journey's End",
  coverImageUrl: null,
}

describe('social contracts', () => {
  test('locks Phase 5 collection, post, and rating constants', () => {
    expect(FEED_PAGE_SIZE).toBe(20)
    expect(ANIME_REVIEWS_PAGE_SIZE).toBe(12)
    expect(POST_TEXT_LIMIT).toBe(280)
    expect(POST_IMAGE_LIMIT).toBe(4)
    expect(POST_IMAGE_MAX_BYTES).toBe(5 * 1024 * 1024)
    expect(REVIEW_RATING_DEFAULT).toBe(50)
  })

  test('accepts nullable one-decimal ratings from 0 through 100', () => {
    expect(reviewRatingSchema.parse(null)).toBeNull()
    expect(reviewRatingSchema.parse(0)).toBe(0)
    expect(reviewRatingSchema.parse(49.9)).toBe(49.9)
    expect(reviewRatingSchema.parse(100)).toBe(100)
    expect(() => reviewRatingSchema.parse(-0.1)).toThrow()
    expect(() => reviewRatingSchema.parse(100.1)).toThrow()
    expect(() => reviewRatingSchema.parse(8.25)).toThrow()
  })

  test('validates strict discriminated feed pages', () => {
    const page = {
      items: [
        { id: 'post-1', kind: 'post', author, text: 'Magic.', imageUrls: [], hasSpoiler: false, visibility: 'public', createdAt: 10, updatedAt: 10 },
        { id: 'review-1', kind: 'review', author, anime, rating: 90, summary: 'Excellent.', summaryHasSpoiler: false, visibility: 'public', publishedAt: 9, updatedAt: 9 },
        { id: 'completed-1', kind: 'completed', author, anime, settledAt: 8 },
        { id: 'rewatched-1', kind: 'rewatched', author, anime, settledAt: 7 },
      ],
      continueCursor: 'next',
      isDone: false,
      perPage: 20,
    }

    expect(feedPageSchema.parse(page)).toEqual(page)
    expect(() => feedPageSchema.parse({ ...page, items: [{ ...page.items[0], unknown: true }] })).toThrow()
    expect(() => feedPageSchema.parse({ ...page, perPage: 21 })).toThrow()
  })

  test('validates review list, detail, and ten-band stats DTOs', () => {
    const listItem = {
      id: 'review-1', author, anime, state: 'published', rating: 91.5,
      summary: 'Excellent.', summaryHasSpoiler: false, visibility: 'public',
      publishedAt: 10, updatedAt: 10,
    }
    const detail = { ...listItem, body: { version: 1, editorState: { root: { children: [], direction: null, format: '', indent: 0, type: 'root', version: 1 } } } }
    const stats = { count: 2, average: 90.8, bands: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0] }

    expect(reviewListItemSchema.parse(listItem)).toEqual(listItem)
    expect(reviewDetailSchema.parse(detail)).toEqual(detail)
    expect(reviewStatsSchema.parse(stats)).toEqual(stats)
    expect(() => reviewStatsSchema.parse({ ...stats, bands: stats.bands.slice(1) })).toThrow()
  })

  test('requires publish rating, trimmed summary, and strict bounded IDs', () => {
    const input = {
      requestId: 'request-1', animeId: 'anime-1', rating: 50, summary: 'Good.',
      summaryHasSpoiler: false, visibility: 'followers',
      body: { version: 1, editorState: { root: { children: [], direction: null, format: '', indent: 0, type: 'root', version: 1 } } },
    }

    expect(reviewPublishInputSchema.safeParse(input).success).toBe(false)
    expect(() => reviewPublishInputSchema.parse({ ...input, rating: null })).toThrow()
    expect(() => reviewPublishInputSchema.parse({ ...input, summary: '   ' })).toThrow()
    expect(() => reviewPublishInputSchema.parse({ ...input, requestId: 'x'.repeat(129) })).toThrow()
  })

  test('accepts post text or registered images and rejects empty, duplicate, or excessive inputs', () => {
    const textPost = { requestId: 'request-1', text: '  Magic.  ', imageIds: [], hasSpoiler: false, visibility: 'public' }
    const imagePost = { ...textPost, text: '', imageIds: ['storage-1'] }

    expect(createPostInputSchema.parse(textPost).text).toBe('Magic.')
    expect(createPostInputSchema.parse(imagePost)).toEqual(imagePost)
    expect(updatePostInputSchema.parse({ ...textPost, postId: 'post-1' }).postId).toBe('post-1')
    expect(() => createPostInputSchema.parse({ ...textPost, text: '', imageIds: [] })).toThrow()
    expect(() => createPostInputSchema.parse({ ...textPost, text: 'x'.repeat(281) })).toThrow()
    expect(() => createPostInputSchema.parse({ ...textPost, imageIds: ['a', 'a'] })).toThrow()
    expect(() => createPostInputSchema.parse({ ...textPost, imageIds: ['a', 'b', 'c', 'd', 'e'] })).toThrow()
  })
})
