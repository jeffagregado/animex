import { z } from 'zod'

import {
  REVIEW_SUMMARY_LIMIT,
  reviewDocumentSchema,
  validatePublishedReview,
  type ReviewDocumentV1,
} from './review-document'

export const FEED_PAGE_SIZE = 20 as const
export const ANIME_REVIEWS_PAGE_SIZE = 12 as const
export const POST_TEXT_LIMIT = 280 as const
export const POST_IMAGE_LIMIT = 4 as const
export const POST_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const REVIEW_RATING_DEFAULT = 50 as const
export const REQUEST_ID_MAX_LENGTH = 128 as const

export const visibilitySchema = z.enum(['public', 'followers', 'private'])
export const feedCardKindSchema = z.enum(['post', 'review', 'completed', 'rewatched'])
export const reviewStateSchema = z.enum(['draft', 'published'])
export const reviewSortSchema = z.enum(['newest', 'rating-high', 'rating-low'])
export const reviewRatingSchema = z.number().min(0).max(100).multipleOf(0.1).nullable()

export type Visibility = z.infer<typeof visibilitySchema>
export type FeedCardKind = z.infer<typeof feedCardKindSchema>
export type ReviewState = z.infer<typeof reviewStateSchema>
export type ReviewSort = z.infer<typeof reviewSortSchema>

const idSchema = z.string().trim().min(1).max(REQUEST_ID_MAX_LENGTH)
const timestampSchema = z.number().finite().nonnegative()
const nullableHttpsUrlSchema = z.url({ protocol: /^https$/ }).nullable()

export interface SocialAuthor {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
}

export interface SocialAnime {
  anilistId: number
  slug: string
  title: string
  coverImageUrl: string | null
}

export const socialAuthorSchema: z.ZodType<SocialAuthor> = z.object({
  avatarUrl: nullableHttpsUrlSchema,
  displayName: z.string().trim().min(1).max(128),
  id: idSchema,
  username: z.string().trim().min(1).max(128),
}).strict()

export const socialAnimeSchema: z.ZodType<SocialAnime> = z.object({
  anilistId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  coverImageUrl: nullableHttpsUrlSchema,
  slug: z.string().trim().min(1).max(128),
  title: z.string().trim().min(1).max(256),
}).strict()

const postFeedCardSchema = z.object({
  author: socialAuthorSchema,
  createdAt: timestampSchema,
  hasSpoiler: z.boolean(),
  id: idSchema,
  imageIds: z.array(idSchema).max(POST_IMAGE_LIMIT),
  imageUrls: z.array(z.url({ protocol: /^https$/ })).max(POST_IMAGE_LIMIT),
  kind: z.literal('post'),
  postId: idSchema,
  text: z.string().max(POST_TEXT_LIMIT),
  updatedAt: timestampSchema,
  visibility: visibilitySchema,
}).strict()

const reviewFeedCardSchema = z.object({
  anime: socialAnimeSchema,
  author: socialAuthorSchema,
  id: idSchema,
  kind: z.literal('review'),
  publishedAt: timestampSchema,
  rating: reviewRatingSchema.unwrap(),
  reviewId: idSchema,
  summary: z.string().trim().min(1).max(REVIEW_SUMMARY_LIMIT),
  summaryHasSpoiler: z.boolean(),
  updatedAt: timestampSchema,
  visibility: visibilitySchema,
}).strict()

const milestoneFeedCardFields = {
  anime: socialAnimeSchema,
  author: socialAuthorSchema,
  id: idSchema,
  settledAt: timestampSchema,
}

const completedFeedCardSchema = z.object({ ...milestoneFeedCardFields, kind: z.literal('completed') }).strict()
const rewatchedFeedCardSchema = z.object({ ...milestoneFeedCardFields, kind: z.literal('rewatched') }).strict()

export const feedCardSchema = z.discriminatedUnion('kind', [
  postFeedCardSchema,
  reviewFeedCardSchema,
  completedFeedCardSchema,
  rewatchedFeedCardSchema,
])

export type FeedCard = z.infer<typeof feedCardSchema>

export interface FeedPage<T> {
  items: T[]
  cursor: string | null
  hasMore: boolean
}

export const feedPageSchema: z.ZodType<FeedPage<FeedCard>> = z.object({
  cursor: z.string().nullable(),
  hasMore: z.boolean(),
  items: z.array(feedCardSchema).max(FEED_PAGE_SIZE),
}).strict()

export interface ReviewListItem {
  id: string; author: SocialAuthor; anime: SocialAnime; state: ReviewState; rating: number | null
  summary: string; summaryHasSpoiler: boolean; visibility: Visibility; publishedAt: number | null; updatedAt: number
}

export interface ReviewDetail extends ReviewListItem { body: ReviewDocumentV1 }

export interface ReviewStatsDto {
  count: number
  average: number | null
  bands: [number, number, number, number, number, number, number, number, number, number]
}

const reviewListItemFields = {
  anime: socialAnimeSchema,
  author: socialAuthorSchema,
  id: idSchema,
  publishedAt: timestampSchema.nullable(),
  rating: reviewRatingSchema,
  state: reviewStateSchema,
  summary: z.string().trim().max(REVIEW_SUMMARY_LIMIT),
  summaryHasSpoiler: z.boolean(),
  updatedAt: timestampSchema,
  visibility: visibilitySchema,
}

export const reviewListItemSchema: z.ZodType<ReviewListItem> = z.object(reviewListItemFields).strict().superRefine((review, context) => {
  if (review.state === 'published' && (review.rating === null || review.publishedAt === null || review.summary.length === 0)) {
    context.addIssue({ code: 'custom', message: 'Published Review DTO requires Rating, Summary, and publish time.' })
  }
})

export const reviewDetailSchema: z.ZodType<ReviewDetail> = z.object({
  ...reviewListItemFields,
  body: reviewDocumentSchema,
}).strict().superRefine((review, context) => {
  if (review.state === 'published' && (review.rating === null || review.publishedAt === null || review.summary.length === 0)) {
    context.addIssue({ code: 'custom', message: 'Published Review DTO requires Rating, Summary, and publish time.' })
  }
})

const ratingBandSchema = z.number().int().nonnegative()
export const reviewStatsSchema: z.ZodType<ReviewStatsDto> = z.object({
  average: z.number().min(0).max(100).multipleOf(0.1).nullable(),
  bands: z.tuple([ratingBandSchema, ratingBandSchema, ratingBandSchema, ratingBandSchema, ratingBandSchema, ratingBandSchema, ratingBandSchema, ratingBandSchema, ratingBandSchema, ratingBandSchema]),
  count: z.number().int().nonnegative(),
}).strict().superRefine((stats, context) => {
  const bandCount = stats.bands.reduce((sum, count) => sum + count, 0)
  if (bandCount !== stats.count) context.addIssue({ code: 'custom', message: 'Review stats count must equal Rating band total.', path: ['count'] })
  if ((stats.count === 0) !== (stats.average === null)) context.addIssue({ code: 'custom', message: 'Review stats average must be null only when empty.', path: ['average'] })
})

export interface ReviewDraftInput {
  requestId: string; animeId: string; rating: number | null; summary: string
  summaryHasSpoiler: boolean; visibility: Visibility; body: ReviewDocumentV1
}
export interface ReviewPublishInput extends Omit<ReviewDraftInput, 'rating'> { rating: number }

const reviewDraftInputFields = {
  animeId: idSchema,
  body: reviewDocumentSchema,
  rating: reviewRatingSchema,
  requestId: idSchema,
  summary: z.string().trim().max(REVIEW_SUMMARY_LIMIT),
  summaryHasSpoiler: z.boolean(),
  visibility: visibilitySchema,
}

export const reviewDraftInputSchema: z.ZodType<ReviewDraftInput> = z.object(reviewDraftInputFields).strict()

export const reviewPublishInputSchema: z.ZodType<ReviewPublishInput> = z.object({
  ...reviewDraftInputFields,
  rating: reviewRatingSchema.unwrap(),
}).strict().superRefine((input, context) => {
  try {
    validatePublishedReview(input.body, input.rating, input.summary)
  } catch (error) {
    context.addIssue({ code: 'custom', message: error instanceof Error ? error.message : 'Invalid published Review.' })
  }
})

export interface CreatePostInput {
  requestId: string; text: string; imageIds: string[]; hasSpoiler: boolean; visibility: Visibility
}
export interface UpdatePostInput extends CreatePostInput { postId: string }

const postFields = {
  hasSpoiler: z.boolean(),
  imageIds: z.array(idSchema).max(POST_IMAGE_LIMIT).refine((ids) => new Set(ids).size === ids.length, { error: 'Post image IDs must be unique.' }),
  requestId: idSchema,
  text: z.string().trim().max(POST_TEXT_LIMIT),
  visibility: visibilitySchema,
}

const requirePostContent = (post: CreatePostInput, context: z.RefinementCtx): void => {
  if (post.text.length === 0 && post.imageIds.length === 0) context.addIssue({ code: 'custom', message: 'Post requires text or at least one image.' })
}

export const createPostInputSchema: z.ZodType<CreatePostInput> = z.object(postFields).strict().superRefine(requirePostContent)
export const updatePostInputSchema: z.ZodType<UpdatePostInput> = z.object({ ...postFields, postId: idSchema }).strict().superRefine(requirePostContent)
