import { z } from 'zod'

import {
  reviewListItemSchema,
  reviewSortSchema,
  visibilitySchema,
  type ReviewListItem,
} from '../../social/shared/social-contracts'

export const REVIEW_DISCOVERY_PAGE_SIZE = 12 as const
export const REVIEW_DISCOVERY_QUERY_MIN_LENGTH = 2 as const
export const REVIEW_DISCOVERY_QUERY_MAX_LENGTH = 100 as const

export const reviewDiscoveryQuerySchema = z.string().trim()
  .min(REVIEW_DISCOVERY_QUERY_MIN_LENGTH)
  .max(REVIEW_DISCOVERY_QUERY_MAX_LENGTH)
export const reviewDiscoverySortSchema = reviewSortSchema
export const reviewDiscoveryRatingBandSchema = z.enum([
  '90-100', '80-89', '70-79', '60-69', '50-59',
  '40-49', '30-39', '20-29', '10-19', '0-9',
])
export const storedReviewRatingBandSchema = z.enum([
  ...reviewDiscoveryRatingBandSchema.options,
  'none',
])
export const reviewDiscoveryVisibilitySchema = z.enum(['all', ...visibilitySchema.options])
export const reviewDiscoveryCursorSchema = z.string().trim().min(1).nullable()

export type ReviewDiscoverySort = z.infer<typeof reviewDiscoverySortSchema>
export type ReviewRatingBand = z.infer<typeof reviewDiscoveryRatingBandSchema>
export type StoredReviewRatingBand = z.infer<typeof storedReviewRatingBandSchema>
export type ReviewDiscoveryVisibility = z.infer<typeof reviewDiscoveryVisibilitySchema>

export interface ReviewDiscoveryInput {
  query: string | null
  sort: ReviewDiscoverySort
  ratingBand: ReviewRatingBand | null
  visibility: ReviewDiscoveryVisibility
  cursor: string | null
}

export interface ReviewDiscoveryPage {
  items: ReviewListItem[]
  cursor: string | null
  hasMore: boolean
}

export const reviewDiscoveryInputSchema: z.ZodType<ReviewDiscoveryInput> = z.object({
  cursor: reviewDiscoveryCursorSchema,
  query: reviewDiscoveryQuerySchema.nullable(),
  ratingBand: reviewDiscoveryRatingBandSchema.nullable(),
  sort: reviewDiscoverySortSchema,
  visibility: reviewDiscoveryVisibilitySchema,
}).strict()

export const reviewDiscoveryPageSchema: z.ZodType<ReviewDiscoveryPage> = z.object({
  cursor: reviewDiscoveryCursorSchema,
  hasMore: z.boolean(),
  items: z.array(reviewListItemSchema).max(REVIEW_DISCOVERY_PAGE_SIZE),
}).strict()

/** Restricts unsigned discovery reads to Public Reviews. */
export const normalizeReviewDiscoveryVisibility = (
  visibility: ReviewDiscoveryVisibility,
  isSignedIn: boolean,
): ReviewDiscoveryVisibility => isSignedIn ? visibility : 'public'
