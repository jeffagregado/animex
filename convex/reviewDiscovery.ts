import { ConvexError } from 'convex/values'

import { REVIEW_DISCOVERY_PAGE_SIZE, type ReviewDiscoverySort, type ReviewDiscoveryVisibility, type ReviewRatingBand } from '../src/features/reviews/shared/review-discovery-contracts'
import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { makeOrderKey } from './feedPolicy'
import {
  buildReviewSearchText,
  encodeReviewDiscoveryCursor,
  getStoredReviewRatingBand,
  mergeOrderedReviewLanes,
  type ReviewDiscoveryCursorScope,
  type ReviewDiscoveryCursorState,
  type ReviewDiscoveryLane,
} from './reviewDiscoveryPolicy'

type DiscoveryOrderKey = 'newestOrderKey' | 'highRatingOrderKey' | 'lowRatingOrderKey'
type DiscoveryPublicIndex =
  | 'by_discovery_public_newest' | 'by_discovery_public_newest_band'
  | 'by_discovery_public_high' | 'by_discovery_public_high_band'
  | 'by_discovery_public_low' | 'by_discovery_public_low_band'
type DiscoveryOwnerIndex =
  | 'by_discovery_owner_newest' | 'by_discovery_owner_newest_band'
  | 'by_discovery_owner_high' | 'by_discovery_owner_high_band'
  | 'by_discovery_owner_low' | 'by_discovery_owner_low_band'
type DiscoverySortConfig = {
  key: DiscoveryOrderKey
  publicIndex: DiscoveryPublicIndex
  publicBandIndex: DiscoveryPublicIndex
  ownerIndex: DiscoveryOwnerIndex
  ownerBandIndex: DiscoveryOwnerIndex
}

const fail = (code: string, message: string): never => { throw new ConvexError({ code, message }) }

const ratingOrder = (rating: number, descending: boolean): string => String(descending ? 1000 - Math.round(rating * 10) : Math.round(rating * 10)).padStart(4, '0')

/** Builds stable Review order keys for every discovery sort. */
export const reviewOrderFields = (publishedAt: number, rating: number, reviewId: string) => ({
  newestOrderKey: makeOrderKey(publishedAt, reviewId),
  highRatingOrderKey: `${ratingOrder(rating, true)}:${makeOrderKey(publishedAt, reviewId)}`,
  lowRatingOrderKey: `${ratingOrder(rating, false)}:${makeOrderKey(publishedAt, reviewId)}`,
})

/** Builds every Review discovery projection from authoritative source fields. */
export const buildReviewDiscoveryFields = (
  sourceId: string,
  state: Doc<'reviews'>['state'],
  rating: number | null,
  publishedAt: number | undefined,
  updatedAt: number,
  author: Doc<'users'>,
  anime: Doc<'animeSummaries'>,
) => {
  if (state === 'published' && rating === null) return fail('REVIEW_DISCOVERY_RATING_MISSING', 'Published Review requires a Rating before discovery projection.')
  return {
    searchText: buildReviewSearchText(anime.titles.display, author.name, author.username),
    ratingBand: getStoredReviewRatingBand(rating),
    ...reviewOrderFields(publishedAt ?? updatedAt, rating ?? 0, sourceId),
  }
}

/** Checks stored discovery fields against rebuilt source truth. */
export const reviewDiscoveryFieldsMatch = (
  review: Doc<'reviews'>,
  expected: ReturnType<typeof buildReviewDiscoveryFields>,
): boolean => review.searchText === expected.searchText
  && review.ratingBand === expected.ratingBand
  && review.newestOrderKey === expected.newestOrderKey
  && review.highRatingOrderKey === expected.highRatingOrderKey
  && review.lowRatingOrderKey === expected.lowRatingOrderKey

const getDiscoverySortConfig = (sort: ReviewDiscoverySort): DiscoverySortConfig => {
  if (sort === 'newest') return {
    key: 'newestOrderKey', publicIndex: 'by_discovery_public_newest', publicBandIndex: 'by_discovery_public_newest_band',
    ownerIndex: 'by_discovery_owner_newest', ownerBandIndex: 'by_discovery_owner_newest_band',
  }
  if (sort === 'rating-high') return {
    key: 'highRatingOrderKey', publicIndex: 'by_discovery_public_high', publicBandIndex: 'by_discovery_public_high_band',
    ownerIndex: 'by_discovery_owner_high', ownerBandIndex: 'by_discovery_owner_high_band',
  }
  return {
    key: 'lowRatingOrderKey', publicIndex: 'by_discovery_public_low', publicBandIndex: 'by_discovery_public_low_band',
    ownerIndex: 'by_discovery_owner_low', ownerBandIndex: 'by_discovery_owner_low_band',
  }
}

/** Resolves safe visibility lanes for one viewer. */
export const getActiveDiscoveryLanes = (visibility: ReviewDiscoveryVisibility, viewerId: Id<'users'> | null): ReviewDiscoveryLane[] => {
  if (viewerId === null || visibility === 'public') return ['public']
  if (visibility === 'followers') return ['followers']
  if (visibility === 'private') return ['private']
  return ['followers', 'private', 'public']
}

/** Creates cursor state with inactive lanes already complete. */
export const createDiscoveryCursorState = (
  query: string | null,
  active: readonly ReviewDiscoveryLane[],
): ReviewDiscoveryCursorState => query === null ? {
  mode: 'ordered',
  lanes: {
    followers: { anchor: null, done: !active.includes('followers') },
    private: { anchor: null, done: !active.includes('private') },
    public: { anchor: null, done: !active.includes('public') },
  },
} : {
  mode: 'search',
  phase: active[0] ?? 'public',
  cursors: { followers: null, private: null, public: null },
  done: {
    followers: !active.includes('followers'),
    private: !active.includes('private'),
    public: !active.includes('public'),
  },
}

const readOrderedLane = async (
  ctx: QueryCtx,
  lane: ReviewDiscoveryLane,
  viewerId: Id<'users'> | null,
  ratingBand: ReviewRatingBand | null,
  anchor: string | null,
  config: DiscoverySortConfig,
) => {
  if (lane === 'public') {
    if (ratingBand !== null) return await ctx.db.query('reviews').withIndex(config.publicBandIndex, (q) => {
      const base = q.eq('state', 'published').eq('visibility', 'public').eq('ratingBand', ratingBand)
      return anchor === null ? base : base.gt(config.key, anchor)
    }).take(REVIEW_DISCOVERY_PAGE_SIZE + 1)
    return await ctx.db.query('reviews').withIndex(config.publicIndex, (q) => {
      const base = q.eq('state', 'published').eq('visibility', 'public')
      return anchor === null ? base : base.gt(config.key, anchor)
    }).take(REVIEW_DISCOVERY_PAGE_SIZE + 1)
  }
  if (viewerId === null) return fail('REVIEW_DISCOVERY_FORBIDDEN', 'Private Review discovery requires a signed-in viewer.')
  if (ratingBand !== null) return await ctx.db.query('reviews').withIndex(config.ownerBandIndex, (q) => {
    const base = q.eq('userId', viewerId).eq('state', 'published').eq('visibility', lane).eq('ratingBand', ratingBand)
    return anchor === null ? base : base.gt(config.key, anchor)
  }).take(REVIEW_DISCOVERY_PAGE_SIZE + 1)
  return await ctx.db.query('reviews').withIndex(config.ownerIndex, (q) => {
    const base = q.eq('userId', viewerId).eq('state', 'published').eq('visibility', lane)
    return anchor === null ? base : base.gt(config.key, anchor)
  }).take(REVIEW_DISCOVERY_PAGE_SIZE + 1)
}

/** Reads and merges one indexed ordered Review discovery page. */
export const readOrderedDiscoveryPage = async (
  ctx: QueryCtx,
  scope: ReviewDiscoveryCursorScope,
  active: ReviewDiscoveryLane[],
  state: Extract<ReviewDiscoveryCursorState, { mode: 'ordered' }>,
) => {
  const config = getDiscoverySortConfig(scope.sort)
  const laneRows = { followers: [] as Doc<'reviews'>[], private: [] as Doc<'reviews'>[], public: [] as Doc<'reviews'>[] }
  for (const lane of active) {
    if (!state.lanes[lane].done) laneRows[lane] = await readOrderedLane(ctx, lane, scope.viewerId as Id<'users'> | null, scope.ratingBand, state.lanes[lane].anchor, config)
  }
  const merged = mergeOrderedReviewLanes({
    followers: laneRows.followers.map((review) => ({ id: review._id, key: review[config.key], review })),
    private: laneRows.private.map((review) => ({ id: review._id, key: review[config.key], review })),
    public: laneRows.public.map((review) => ({ id: review._id, key: review[config.key], review })),
  }, REVIEW_DISCOVERY_PAGE_SIZE)
  for (const lane of active) {
    const consumed = merged.consumed[lane]
    if (consumed > 0) state.lanes[lane].anchor = laneRows[lane][consumed - 1]?.[config.key] ?? state.lanes[lane].anchor
    state.lanes[lane].done = laneRows[lane].length <= consumed
  }
  const hasMore = active.some((lane) => !state.lanes[lane].done)
  return { reviews: merged.items.map((item) => item.review), cursor: hasMore ? encodeReviewDiscoveryCursor({ scope, state }) : null, hasMore }
}

const readSearchLane = async (
  ctx: QueryCtx,
  lane: ReviewDiscoveryLane,
  viewerId: Id<'users'> | null,
  queryText: string,
  ratingBand: ReviewRatingBand | null,
  cursor: string | null,
) => {
  const paginationOpts = { cursor, numItems: REVIEW_DISCOVERY_PAGE_SIZE }
  if (lane === 'public') {
    if (ratingBand !== null) return await ctx.db.query('reviews').withSearchIndex('search_discovery', (q) => q
      .search('searchText', queryText).eq('state', 'published').eq('visibility', 'public').eq('ratingBand', ratingBand)).paginate(paginationOpts)
    return await ctx.db.query('reviews').withSearchIndex('search_discovery', (q) => q
      .search('searchText', queryText).eq('state', 'published').eq('visibility', 'public')).paginate(paginationOpts)
  }
  if (viewerId === null) return fail('REVIEW_DISCOVERY_FORBIDDEN', 'Private Review discovery requires a signed-in viewer.')
  if (ratingBand !== null) return await ctx.db.query('reviews').withSearchIndex('search_discovery', (q) => q
    .search('searchText', queryText).eq('state', 'published').eq('visibility', lane).eq('userId', viewerId).eq('ratingBand', ratingBand)).paginate(paginationOpts)
  return await ctx.db.query('reviews').withSearchIndex('search_discovery', (q) => q
    .search('searchText', queryText).eq('state', 'published').eq('visibility', lane).eq('userId', viewerId)).paginate(paginationOpts)
}

/** Reads one fixed-phase search lane using Convex's single-paginate limit. */
export const readSearchDiscoveryPage = async (
  ctx: QueryCtx,
  scope: ReviewDiscoveryCursorScope & { query: string },
  active: ReviewDiscoveryLane[],
  state: Extract<ReviewDiscoveryCursorState, { mode: 'search' }>,
) => {
  const laneIndex = active.indexOf(state.phase)
  if (laneIndex < 0 || state.done[state.phase]) return fail('INVALID_REVIEW_CURSOR', 'Review discovery cursor has an inactive search phase.')
  const page = await readSearchLane(ctx, state.phase, scope.viewerId as Id<'users'> | null, scope.query, scope.ratingBand, state.cursors[state.phase])
  state.cursors[state.phase] = page.continueCursor
  state.done[state.phase] = page.isDone
  if (page.isDone) state.phase = active[laneIndex + 1] ?? state.phase
  const hasMore = active.some((lane) => !state.done[lane])
  return { reviews: page.page, cursor: hasMore ? encodeReviewDiscoveryCursor({ scope, state }) : null, hasMore }
}

/** Reads newest Public Reviews with a hard cap of five. */
export const readLatestPublicReviews = async (ctx: QueryCtx, requestedLimit: number): Promise<Doc<'reviews'>[]> => {
  if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1) return fail('INVALID_REVIEW_LIMIT', 'Latest Review limit must be a positive integer.')
  return await ctx.db.query('reviews').withIndex('by_discovery_public_newest', (q) => q
    .eq('state', 'published').eq('visibility', 'public')).take(Math.min(requestedLimit, 5))
}
