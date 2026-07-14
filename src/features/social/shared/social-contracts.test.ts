import { describe, expect, expectTypeOf, test } from 'vitest'

import {
  ANIME_REVIEWS_PAGE_SIZE,
  FEED_PAGE_SIZE,
  POST_TEXT_LIMIT,
  REVIEW_RATING_DEFAULT,
  createPostInputSchema,
  feedPageSchema,
  reviewDetailSchema,
  reviewListItemSchema,
  reviewPublishInputSchema,
  reviewRatingSchema,
  reviewSortSchema,
  reviewStatsSchema,
  socialAnimeSchema,
  socialAuthorSchema,
  updatePostInputSchema,
  type FeedPage,
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

  test('accepts every exact Review sort and rejects unsupported values', () => {
    expect(['newest', 'rating-high', 'rating-low'].map((sort) => reviewSortSchema.parse(sort))).toEqual(['newest', 'rating-high', 'rating-low'])
    expect(() => reviewSortSchema.parse('highest-rating')).toThrow()
    expect(() => reviewSortSchema.parse('oldest')).toThrow()
  })

  test('validates exact generic cursor feed pages', () => {
    const page = {
      items: [
        { id: 'post-1', postId: 'source-post-1', kind: 'post', author, text: 'Magic.', media: null, hasSpoiler: false, visibility: 'public', createdAt: 10, updatedAt: 10 },
        { id: 'review-1', reviewId: 'source-review-1', kind: 'review', author, anime, rating: 90, summary: 'Excellent.', summaryHasSpoiler: false, visibility: 'public', publishedAt: 9, updatedAt: 9 },
        { id: 'completed-1', kind: 'completed', author, anime: { ...anime, seasonYear: 2023, format: 'TV' }, settledAt: 8, visibility: 'public' },
        { id: 'rewatched-1', kind: 'rewatched', author, anime: { ...anime, seasonYear: null, format: null }, settledAt: 7, visibility: 'private' },
      ],
      cursor: 'next',
      hasMore: true,
    }

    const genericPage: FeedPage<string> = { items: ['one'], cursor: null, hasMore: false }

    expect(feedPageSchema.parse(page)).toEqual(page)
    expect(feedPageSchema.parse({ ...page, cursor: null })).toEqual({ ...page, cursor: null })
    expect(() => feedPageSchema.parse({ ...page, items: [{ ...page.items[0], unknown: true }] })).toThrow()
    expect(() => feedPageSchema.parse({ ...page, isDone: false })).toThrow()
    expectTypeOf(genericPage.items).toEqualTypeOf<string[]>()
  })

  test('exports strict author and anime DTO schemas', () => {
    expect(socialAuthorSchema.parse(author)).toEqual(author)
    expect(socialAnimeSchema.parse(anime)).toEqual(anime)
    expect(() => socialAuthorSchema.parse({ ...author, role: 'admin' })).toThrow()
    expect(() => socialAnimeSchema.parse({ ...anime, internalId: 'secret' })).toThrow()
    expect(() => socialAuthorSchema.parse({ ...author, avatarUrl: 'http://example.com/avatar.jpg' })).toThrow()
  })

  test('adds nullable activity metadata without widening Review anime DTOs', () => {
    const reviewAnime = { ...anime, seasonYear: 2023, format: 'TV' }
    const activityPage = {
      items: [{ id: 'completed-1', kind: 'completed', author, anime: reviewAnime, settledAt: 8, visibility: 'public' }],
      cursor: null,
      hasMore: false,
    }

    expect(feedPageSchema.parse(activityPage)).toEqual(activityPage)
    expect(() => socialAnimeSchema.parse(reviewAnime)).toThrow()
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

  test('accepts text-only, media-only, or text-and-media Posts with at most one media item', () => {
    const textPost = { requestId: 'request-1', text: '  Magic.  ', media: null, hasSpoiler: false, visibility: 'public' }
    const imagePost = { ...textPost, text: '', media: { type: 'image', url: 'https://images.example/frieren.jpg', description: null } }

    expect(createPostInputSchema.parse(textPost).text).toBe('Magic.')
    expect(createPostInputSchema.parse(imagePost)).toEqual(imagePost)
    expect(updatePostInputSchema.parse({ ...textPost, postId: 'post-1' }).postId).toBe('post-1')
    expect(() => createPostInputSchema.parse({ ...textPost, text: '', media: null })).toThrow()
    expect(() => createPostInputSchema.parse({ ...textPost, text: 'x'.repeat(281) })).toThrow()
    expect(() => createPostInputSchema.parse({ ...textPost, imageIds: [] })).toThrow()
    expect(() => createPostInputSchema.parse({ ...textPost, media: [imagePost.media] })).toThrow()
    expect(() => createPostInputSchema.parse({ ...textPost, media: { type: 'image', url: 'https://images.example/a.jpg', description: null, label: null } })).toThrow()
  })
})
