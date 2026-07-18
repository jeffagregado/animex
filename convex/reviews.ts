import { paginationOptsValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'

import type { ReviewDiscoveryVisibility } from '../src/features/reviews/shared/review-discovery-contracts'
import { ANIME_REVIEWS_PAGE_SIZE, reviewDraftInputSchema, reviewPublishInputSchema, reviewStatsSchema, type ReviewSort } from '../src/features/social/shared/social-contracts'
import { createReviewStats, parseReviewDocument, REVIEW_DOCUMENT_MAX_BYTES, validateDraftReview, validatePublishedReview } from '../src/features/social/shared/review-document'
import type { Doc, Id } from './_generated/dataModel'
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { resolveProviderRef } from './catalogIdentityModel'
import { makeOrderKey } from './feedPolicy'
import { buildReviewDiscoveryFields, createDiscoveryCursorState, getActiveDiscoveryLanes, readLatestPublicReviews, readOrderedDiscoveryPage, readSearchDiscoveryPage, reviewDiscoveryFieldsMatch } from './reviewDiscovery'
import { decodeReviewDiscoveryCursor, normalizeReviewDiscoveryQuery, type ReviewDiscoveryCursorScope, type ReviewDiscoveryCursorState, type ReviewDiscoveryLane } from './reviewDiscoveryPolicy'
import { resolveProfileAccess } from './profiles'
import { readProfileReviewPage } from './profileReviewPolicy'
import { assertRequestId, canReadSocialRecord, decodeReviewCursor, encodeReviewCursor, mergeReviewPage, transitionReviewAggregate } from './socialPolicy'
import { getOptionalProfile, requireProfile } from './users'

const visibilityValidator = v.union(v.literal('private'), v.literal('followers'), v.literal('public'))
const reviewSortValidator = v.union(v.literal('newest'), v.literal('rating-high'), v.literal('rating-low'))
const discoveryVisibilityValidator = v.union(v.literal('all'), v.literal('public'), v.literal('followers'), v.literal('private'))
const ratingBandValidator = v.union(v.literal('90-100'), v.literal('80-89'), v.literal('70-79'), v.literal('60-69'), v.literal('50-59'), v.literal('40-49'), v.literal('30-39'), v.literal('20-29'), v.literal('10-19'), v.literal('0-9'))
const reviewFields = {
  anilistId: v.number(), requestId: v.string(), rating: v.union(v.number(), v.null()), summary: v.string(),
  containsSpoiler: v.boolean(), bodyJson: v.string(), visibility: visibilityValidator,
}
const authorValidator = v.object({ id: v.string(), username: v.string(), displayName: v.string(), avatarUrl: v.union(v.string(), v.null()) })
const animeValidator = v.object({ anilistId: v.number(), slug: v.string(), title: v.string(), coverImageUrl: v.union(v.string(), v.null()) })
const reviewListFields = {
  id: v.string(), author: authorValidator, anime: animeValidator,
  state: v.union(v.literal('draft'), v.literal('published')), rating: v.union(v.number(), v.null()),
  summary: v.string(), containsSpoiler: v.boolean(), visibility: visibilityValidator,
  publishedAt: v.union(v.number(), v.null()), updatedAt: v.number(),
}
const reviewListValidator = v.object(reviewListFields)
const reviewDetailValidator = v.object({ ...reviewListFields, bodyJson: v.string() })
const reviewPageValidator = v.object({ items: v.array(reviewListValidator), cursor: v.union(v.string(), v.null()), hasMore: v.boolean() })
const discoveryPageValidator = v.object({ items: v.array(reviewListValidator), cursor: v.union(v.string(), v.null()), hasMore: v.boolean() })
const statsValidator = v.object({ count: v.number(), average: v.union(v.number(), v.null()), bands: v.array(v.number()) })
const fail = (code: string, message: string): never => { throw new ConvexError({ code, message }) }
type PublishIntent = { anilistId: number; rating: number; summary: string; containsSpoiler: boolean; visibility: Doc<'reviews'>['visibility'] }
const readMatchingPublishRequest = (review: Doc<'reviews'> | null, intent: PublishIntent, bodyJson: string): Id<'reviews'> | null => {
  if (!review) return null
  if (review.anilistId !== intent.anilistId || review.state !== 'published') return fail('REVIEW_REQUEST_COLLISION', 'Review request collision with another Anime or Draft.')
  const differs = review.rating !== intent.rating
    || review.summary !== intent.summary
    || review.containsSpoiler !== intent.containsSpoiler
    || review.visibility !== intent.visibility
    || review.bodyJson !== bodyJson
  if (differs) return fail('REVIEW_REQUEST_COLLISION', 'Review request collision with a different publish request.')
  return review._id
}

const parseBodyJson = (bodyJson: string) => {
  try {
    const body = parseReviewDocument(JSON.parse(bodyJson))
    const canonicalBodyJson = JSON.stringify(body)
    if (new TextEncoder().encode(canonicalBodyJson).byteLength > REVIEW_DOCUMENT_MAX_BYTES) {
      return fail('INVALID_REVIEW_BODY', `Review body must not exceed ${REVIEW_DOCUMENT_MAX_BYTES} UTF-8 bytes.`)
    }
    return { body, bodyJson: canonicalBodyJson }
  } catch (error) {
    return fail('INVALID_REVIEW_BODY', `Review body JSON is invalid: ${error instanceof Error ? error.message : 'unknown error'}`)
  }
}

const requireCachedAnime = async (ctx: QueryCtx | MutationCtx, anilistId: number) => {
  if (!Number.isSafeInteger(anilistId) || anilistId < 1) return fail('INVALID_ANIME_ID', 'Anime ID must be a positive safe integer.')
  const anime = await ctx.db.query('animeSummaries').withIndex('by_anilist_id', (q) => q.eq('anilistId', anilistId)).unique()
  if (!anime) return fail('ANIME_NOT_CACHED', 'Anime must be loaded before writing a Review.')
  const animeId = await resolveProviderRef(ctx, { provider: 'anilist', kind: 'anime', providerId: anilistId })
  if (!animeId) return fail('CATALOG_PROVIDER_REF_MISSING', `Anime provider mapping anilist:anime:${anilistId} is missing.`)
  return { ...anime, animeId }
}

const readMine = async (ctx: QueryCtx | MutationCtx, userId: Id<'users'>, anilistId: number) => await ctx.db
  .query('reviews').withIndex('by_user_anime', (q) => q.eq('userId', userId).eq('anilistId', anilistId)).unique()

const readOwnedReview = async (ctx: MutationCtx, reviewId: Id<'reviews'>, userId: Id<'users'>) => {
  const review = await ctx.db.get('reviews', reviewId)
  if (!review) return fail('REVIEW_NOT_FOUND', 'Review not found.')
  if (review.userId !== userId) return fail('REVIEW_FORBIDDEN', 'Only the Review owner can change it.')
  return review
}

const publicRating = (review: Doc<'reviews'> | null) => review?.state === 'published' && review.visibility === 'public' && review.rating !== null
  ? { public: true, rating: review.rating }
  : null

const hasAggregateChange = (delta: ReturnType<typeof transitionReviewAggregate>): boolean => delta.count !== 0
  || delta.ratingSum !== 0
  || delta.bandDeltas.some((value) => value !== 0)

const nextAggregateFields = (current: Doc<'animeReviewStats'> | null, delta: ReturnType<typeof transitionReviewAggregate>) => {
  const currentBands = current?.bands ?? [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  const bands = currentBands.map((value, index) => value + (delta.bandDeltas[index] ?? 0))
  return { count: (current?.count ?? 0) + delta.count, ratingSum: (current?.ratingSum ?? 0) + delta.ratingSum, bands, updatedAt: Date.now() }
}

const applyAggregate = async (ctx: MutationCtx, anilistId: number, animeId: Id<'catalogEntities'>, previous: Doc<'reviews'> | null, next: Doc<'reviews'> | null): Promise<void> => {
  const delta = transitionReviewAggregate(publicRating(previous), publicRating(next))
  const current = await ctx.db.query('animeReviewStats').withIndex('by_anilist_id', (q) => q.eq('anilistId', anilistId)).unique()
  if (current?.animeId && current.animeId !== animeId) return fail('CATALOG_PROVIDER_REF_CONFLICT', `Review aggregate ${current._id} conflicts with provider mapping ${animeId}.`)
  if (current && !current.animeId) await ctx.db.patch('animeReviewStats', current._id, { animeId })
  if (!hasAggregateChange(delta)) return
  const fields = nextAggregateFields(current, delta)
  if (fields.count < 0 || fields.bands.some((value) => value < 0)) return fail('REVIEW_STATS_CORRUPT', 'Review aggregate transition would become negative.')
  if (current) await ctx.db.patch('animeReviewStats', current._id, { animeId, ...fields })
  else await ctx.db.insert('animeReviewStats', { anilistId, animeId, ...fields })
}

const upsertReviewCard = async (ctx: MutationCtx, review: Doc<'reviews'>): Promise<void> => {
  if (!review.animeId) return fail('CATALOG_PROVIDER_REF_MISSING', `Review ${review._id} is missing its Anime entity.`)
  const sourceKey = `review:${review._id}`
  const existing = await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', sourceKey)).unique()
  const active = review.state === 'published' && review.activityState === 'active'
  if (existing) {
    if (existing.animeId && existing.animeId !== review.animeId) return fail('CATALOG_PROVIDER_REF_CONFLICT', `Review feed card ${existing._id} conflicts with Review ${review._id}.`)
    await ctx.db.patch('feedCards', existing._id, { animeId: review.animeId, visibility: review.visibility, active, updatedAt: review.updatedAt })
    return
  }
  if (!active || review.publishedAt === undefined) return
  await ctx.db.insert('feedCards', {
    sourceKey, kind: 'review', userId: review.userId, sourceId: review._id, anilistId: review.anilistId, animeId: review.animeId,
    visibility: review.visibility, active: true, orderKey: makeOrderKey(review.publishedAt, sourceKey),
    occurredAt: review.publishedAt, updatedAt: review.updatedAt,
  })
}

const removeReviewCard = async (ctx: MutationCtx, reviewId: Id<'reviews'>): Promise<void> => {
  const card = await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', `review:${reviewId}`)).unique()
  if (card) await ctx.db.delete('feedCards', card._id)
}

const toReviewList = async (ctx: QueryCtx, review: Doc<'reviews'>) => {
  const [author, anime] = await Promise.all([ctx.db.get('users', review.userId), requireCachedAnime(ctx, review.anilistId)])
  if (!author) return fail('REVIEW_AUTHOR_MISSING', 'Review author profile is missing.')
  const avatarUrl = author.avatarStorageId ? await ctx.storage.getUrl(author.avatarStorageId) : null
  return {
    id: review._id, author: { id: author._id, username: author.username, displayName: author.name, avatarUrl },
    anime: { anilistId: anime.anilistId, slug: anime.slug, title: anime.titles.display, coverImageUrl: anime.coverImageUrl },
    state: review.state, rating: review.rating, summary: review.summary, containsSpoiler: review.containsSpoiler,
    visibility: review.visibility, publishedAt: review.publishedAt ?? null, updatedAt: review.updatedAt,
  }
}

const toReviewDetail = async (ctx: QueryCtx, review: Doc<'reviews'>) => {
  parseReviewDocument(JSON.parse(review.bodyJson))
  return { ...await toReviewList(ctx, review), bodyJson: review.bodyJson }
}

type DiscoveryPage = { reviews: Doc<'reviews'>[]; cursor: string | null; hasMore: boolean }

/** Restricts anonymous discovery reads to Public Reviews. */
const resolveDiscoveryAccess = (
  viewer: Doc<'users'> | null,
  requestedVisibility: ReviewDiscoveryVisibility,
): { viewerId: Id<'users'> | null; visibility: ReviewDiscoveryVisibility } => {
  if (!viewer) return { viewerId: null, visibility: 'public' }
  return { viewerId: viewer._id, visibility: requestedVisibility }
}

/** Normalizes an optional discovery query. */
const normalizeOptionalDiscoveryQuery = (queryText: string | null): string | null => queryText === null
  ? null
  : normalizeReviewDiscoveryQuery(queryText)

/** Restores cursor state or creates its first-page state. */
const resolveDiscoveryState = (
  cursor: string | null,
  scope: ReviewDiscoveryCursorScope,
  active: ReviewDiscoveryLane[],
): ReviewDiscoveryCursorState => cursor === null
  ? createDiscoveryCursorState(scope.query, active)
  : decodeReviewDiscoveryCursor(cursor, scope).state

/** Reads ordered or search discovery from its matching cursor state. */
const readDiscoveryPage = async (
  ctx: QueryCtx,
  scope: ReviewDiscoveryCursorScope,
  active: ReviewDiscoveryLane[],
  state: ReviewDiscoveryCursorState,
): Promise<DiscoveryPage> => {
  if (scope.query === null) {
    if (state.mode !== 'ordered') return fail('INVALID_REVIEW_CURSOR', 'Search cursor cannot continue ordered Review discovery.')
    return await readOrderedDiscoveryPage(ctx, scope, active, state)
  }
  if (state.mode !== 'search') return fail('INVALID_REVIEW_CURSOR', 'Ordered cursor cannot continue Review search.')
  return await readSearchDiscoveryPage(ctx, { ...scope, query: scope.query }, active, state)
}

/** Hydrates indexed discovery rows into API Review cards. */
const hydrateDiscoveryPage = async (ctx: QueryCtx, page: DiscoveryPage) => ({
  items: await Promise.all(page.reviews.map((review) => toReviewList(ctx, review))),
  cursor: page.cursor,
  hasMore: page.hasMore,
})

/** Lists newest accessible Reviews for one profile. */
export const listForProfile = query({
  args: { username: v.string(), cursor: v.union(v.string(), v.null()) }, returns: reviewPageValidator,
  handler: async (ctx, args) => {
    const access = await resolveProfileAccess(ctx, args.username)
    if (access.access === 'header') return fail('PROFILE_PRIVATE', 'Profile content is private.')
    const page = await readProfileReviewPage(ctx, access, args.cursor)
    return {
      items: await Promise.all(page.reviews.map((review) => toReviewList(ctx, review))),
      cursor: page.cursor, hasMore: page.hasMore,
    }
  },
})

export const getMineForAnime = query({
  args: { anilistId: v.number() }, returns: v.union(reviewDetailValidator, v.null()),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    await requireCachedAnime(ctx, args.anilistId)
    const review = await readMine(ctx, profile._id, args.anilistId)
    return review ? await toReviewDetail(ctx, review) : null
  },
})

export const saveDraft = mutation({
  args: reviewFields, returns: v.id('reviews'),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    const anime = await requireCachedAnime(ctx, args.anilistId)
    const body = parseBodyJson(args.bodyJson)
    const { anilistId, bodyJson: _bodyJson, ...contractInput } = args
    reviewDraftInputSchema.parse({ ...contractInput, body: body.body, animeId: String(anilistId) })
    const parsed = validateDraftReview(body.body, args.rating, args.summary)
    const requestId = assertRequestId(args.requestId)
    const existing = await readMine(ctx, profile._id, args.anilistId)
    const requestMatches = await ctx.db.query('reviews').withIndex('by_user_request', (q) => q.eq('userId', profile._id).eq('requestId', requestId)).take(2)
    if (requestMatches.length > 1 || (requestMatches[0] && requestMatches[0]._id !== existing?._id)) return fail('REVIEW_REQUEST_COLLISION', 'Review request collision with another Anime or Review.')
    if (existing?.state === 'published') return fail('REVIEW_ALREADY_PUBLISHED', 'Published Review must be edited, not saved as Draft.')
    const now = Date.now()
    if (existing) {
      const discovery = buildReviewDiscoveryFields(existing._id, 'draft', parsed.rating, undefined, now, profile, anime)
      if (existing.animeId && existing.animeId !== anime.animeId) return fail('CATALOG_PROVIDER_REF_CONFLICT', `Review ${existing._id} conflicts with provider mapping ${anime.animeId}.`)
      await ctx.db.patch('reviews', existing._id, { animeId: anime.animeId, requestId, rating: parsed.rating, summary: parsed.summary, containsSpoiler: args.containsSpoiler, bodyJson: body.bodyJson, visibility: args.visibility, updatedAt: now, ...discovery })
      return existing._id
    }
    const discovery = buildReviewDiscoveryFields(`${profile._id}:${args.anilistId}`, 'draft', parsed.rating, undefined, now, profile, anime)
    const reviewId = await ctx.db.insert('reviews', { userId: profile._id, anilistId: args.anilistId, animeId: anime.animeId, requestId, state: 'draft', rating: parsed.rating, summary: parsed.summary, containsSpoiler: args.containsSpoiler, bodyJson: body.bodyJson, visibility: args.visibility, updatedAt: now, activityState: 'active', ...discovery })
    await ctx.db.patch('reviews', reviewId, buildReviewDiscoveryFields(reviewId, 'draft', parsed.rating, undefined, now, profile, anime))
    return reviewId
  },
})

export const publish = mutation({
  args: { ...reviewFields, rating: v.number() }, returns: v.id('reviews'),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    const anime = await requireCachedAnime(ctx, args.anilistId)
    const body = parseBodyJson(args.bodyJson)
    const { anilistId, bodyJson: _bodyJson, ...contractInput } = args
    reviewPublishInputSchema.parse({ ...contractInput, body: body.body, animeId: String(anilistId) })
    const parsed = validatePublishedReview(body.body, args.rating, args.summary)
    const requestId = assertRequestId(args.requestId)
    const byRequest = await ctx.db.query('reviews').withIndex('by_user_request', (q) => q.eq('userId', profile._id).eq('requestId', requestId)).unique()
    const repeatedId = readMatchingPublishRequest(byRequest, { ...args, rating: parsed.rating, summary: parsed.summary }, body.bodyJson)
    if (repeatedId && byRequest) {
      if (byRequest.animeId && byRequest.animeId !== anime.animeId) return fail('CATALOG_PROVIDER_REF_CONFLICT', `Review ${byRequest._id} conflicts with provider mapping ${anime.animeId}.`)
      await ctx.db.patch('reviews', repeatedId, { animeId: anime.animeId, ...buildReviewDiscoveryFields(byRequest._id, byRequest.state, byRequest.rating, byRequest.publishedAt, byRequest.updatedAt, profile, anime) })
      const repeated = await ctx.db.get('reviews', repeatedId)
      if (repeated) await upsertReviewCard(ctx, repeated)
      return repeatedId
    }
    const existing = await readMine(ctx, profile._id, args.anilistId)
    if (existing?.animeId && existing.animeId !== anime.animeId) return fail('CATALOG_PROVIDER_REF_CONFLICT', `Review ${existing._id} conflicts with provider mapping ${anime.animeId}.`)
    const now = Date.now()
    const publishedAt = existing?.publishedAt ?? now
    let reviewId: Id<'reviews'>
    if (existing) {
      const discovery = buildReviewDiscoveryFields(existing._id, 'published', parsed.rating, publishedAt, now, profile, anime)
      await ctx.db.patch('reviews', existing._id, { animeId: anime.animeId, requestId, state: 'published', rating: parsed.rating, summary: parsed.summary, containsSpoiler: args.containsSpoiler, bodyJson: body.bodyJson, visibility: args.visibility, publishedAt, updatedAt: now, ...discovery })
      reviewId = existing._id
    } else {
      const source = `${profile._id}:${args.anilistId}`
      const discovery = buildReviewDiscoveryFields(source, 'published', parsed.rating, publishedAt, now, profile, anime)
      reviewId = await ctx.db.insert('reviews', { userId: profile._id, anilistId: args.anilistId, animeId: anime.animeId, requestId, state: 'published', rating: parsed.rating, summary: parsed.summary, containsSpoiler: args.containsSpoiler, bodyJson: body.bodyJson, visibility: args.visibility, publishedAt, updatedAt: now, activityState: 'active', ...discovery })
      await ctx.db.patch('reviews', reviewId, buildReviewDiscoveryFields(reviewId, 'published', parsed.rating, publishedAt, now, profile, anime))
    }
    const next = await ctx.db.get('reviews', reviewId)
    if (!next) return fail('REVIEW_WRITE_FAILED', 'Review was not saved.')
    await applyAggregate(ctx, args.anilistId, anime.animeId, existing, next)
    await upsertReviewCard(ctx, next)
    return reviewId
  },
})

export const update = mutation({
  args: { reviewId: v.id('reviews'), rating: v.number(), summary: v.string(), containsSpoiler: v.boolean(), bodyJson: v.string(), visibility: visibilityValidator },
  returns: v.id('reviews'),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    const review = await readOwnedReview(ctx, args.reviewId, profile._id)
    const anime = await requireCachedAnime(ctx, review.anilistId)
    if (review.state !== 'published' || review.publishedAt === undefined) return fail('REVIEW_NOT_PUBLISHED', 'Only published Reviews can be updated.')
    const body = parseBodyJson(args.bodyJson)
    const parsed = validatePublishedReview(body.body, args.rating, args.summary)
    const now = Date.now()
    const discovery = buildReviewDiscoveryFields(review._id, 'published', parsed.rating, review.publishedAt, now, profile, anime)
    if (review.animeId && review.animeId !== anime.animeId) return fail('CATALOG_PROVIDER_REF_CONFLICT', `Review ${review._id} conflicts with provider mapping ${anime.animeId}.`)
    await ctx.db.patch('reviews', review._id, { animeId: anime.animeId, rating: parsed.rating, summary: parsed.summary, containsSpoiler: args.containsSpoiler, bodyJson: body.bodyJson, visibility: args.visibility, updatedAt: now, ...discovery })
    const next = await ctx.db.get('reviews', review._id)
    if (!next) return fail('REVIEW_WRITE_FAILED', 'Review update failed.')
    await applyAggregate(ctx, review.anilistId, anime.animeId, review, next)
    await upsertReviewCard(ctx, next)
    return review._id
  },
})

export const getById = query({
  args: { reviewId: v.id('reviews') }, returns: v.union(reviewDetailValidator, v.null()),
  handler: async (ctx, args) => {
    const [review, viewer] = await Promise.all([ctx.db.get('reviews', args.reviewId), getOptionalProfile(ctx)])
    if (!review) return null
    if (review.state === 'draft' && viewer?._id !== review.userId) return null
    if (review.state === 'published' && !canReadSocialRecord(review.visibility, viewer?._id ?? null, review.userId)) return null
    return await toReviewDetail(ctx, review)
  },
})

type ReviewOrderKey = 'newestOrderKey' | 'highRatingOrderKey' | 'lowRatingOrderKey'
type ReviewIndex = 'by_anime_state_visibility_newest' | 'by_anime_state_visibility_high_rating' | 'by_anime_state_visibility_low_rating'

const getReviewSortConfig = (sort: ReviewSort): { index: ReviewIndex; key: ReviewOrderKey } => {
  if (sort === 'newest') return { index: 'by_anime_state_visibility_newest', key: 'newestOrderKey' }
  if (sort === 'rating-high') return { index: 'by_anime_state_visibility_high_rating', key: 'highRatingOrderKey' }
  return { index: 'by_anime_state_visibility_low_rating', key: 'lowRatingOrderKey' }
}

const readPublicReviewPage = async (ctx: QueryCtx, anilistId: number, anchor: string | null, config: { index: ReviewIndex; key: ReviewOrderKey }) => await ctx.db
  .query('reviews').withIndex(config.index, (q) => {
    const base = q.eq('anilistId', anilistId).eq('state', 'published').eq('visibility', 'public')
    return anchor === null ? base : base.gt(config.key, anchor)
  }).take(ANIME_REVIEWS_PAGE_SIZE + 1)

const getPersonalReviewStats = (own: Doc<'reviews'> | null) => {
  if (own?.state !== 'published') return null
  if (own.visibility === 'public' || own.rating === null) return null
  return { rating: own.rating, bands: createReviewStats([own.rating]).bands }
}

const parseBuiltReviewStats = (value: unknown) => {
  const parsed = reviewStatsSchema.safeParse(value)
  if (!parsed.success) return fail('REVIEW_STATS_CORRUPT', `Review stats are invalid: ${parsed.error.message}`)
  return parsed.data
}

const buildReviewStats = (aggregate: Doc<'animeReviewStats'> | null, own: Doc<'reviews'> | null) => {
  const bands = [...(aggregate?.bands ?? [0, 0, 0, 0, 0, 0, 0, 0, 0, 0])]
  let count = aggregate?.count ?? 0
  let sum = aggregate?.ratingSum ?? 0
  const personal = getPersonalReviewStats(own)
  if (personal) {
    count += 1
    sum += personal.rating
    personal.bands.forEach((value, index) => { bands[index] += value })
  }
  return parseBuiltReviewStats({ count, average: count === 0 ? null : Math.round((sum / count) * 10) / 10, bands })
}

const getOwnReviewPageItem = (own: Doc<'reviews'> | null, key: ReviewOrderKey) => own?.state === 'published' && own.visibility !== 'public'
  ? { key: own[key], value: own }
  : null

const getNextPublicAnchor = (publicReviews: Doc<'reviews'>[], consumed: number, key: ReviewOrderKey, current: string | null) => {
  if (consumed === 0) return current
  return publicReviews[consumed - 1]?.[key] ?? current
}

export const listForAnime = query({
  args: { anilistId: v.number(), sort: reviewSortValidator, cursor: v.union(v.string(), v.null()) }, returns: reviewPageValidator,
  handler: async (ctx, args) => {
    await requireCachedAnime(ctx, args.anilistId)
    const viewer = await getOptionalProfile(ctx)
    const cursor = decodeReviewCursor(args.cursor, viewer?._id ?? null, args.anilistId, args.sort)
    const { index, key } = getReviewSortConfig(args.sort)
    const publicReviews = await readPublicReviewPage(ctx, args.anilistId, cursor.publicAnchor, { index, key })
    const own = viewer ? await readMine(ctx, viewer._id, args.anilistId) : null
    const ownItem = getOwnReviewPageItem(own, key)
    const merged = mergeReviewPage(publicReviews.map((review) => ({ key: review[key], value: review })), ownItem, ANIME_REVIEWS_PAGE_SIZE, cursor.ownPending)
    const publicAnchor = getNextPublicAnchor(publicReviews, merged.publicConsumed, key, cursor.publicAnchor)
    const hasMore = publicReviews.length > merged.publicConsumed || merged.ownPending
    return {
      items: await Promise.all(merged.items.map((review) => toReviewList(ctx, review))),
      cursor: hasMore ? encodeReviewCursor({ viewerId: viewer?._id ?? null, anilistId: args.anilistId, sort: args.sort, publicAnchor, ownPending: merged.ownPending }) : null,
      hasMore,
    }
  },
})

export const listLatestPublic = query({
  args: { limit: v.number() }, returns: v.array(reviewListValidator),
  handler: async (ctx, args) => {
    const reviews = await readLatestPublicReviews(ctx, args.limit)
    return await Promise.all(reviews.map((review) => toReviewList(ctx, review)))
  },
})

export const listDiscovery = query({
  args: {
    query: v.union(v.string(), v.null()), sort: reviewSortValidator,
    ratingBand: v.union(ratingBandValidator, v.null()), visibility: discoveryVisibilityValidator,
    cursor: v.union(v.string(), v.null()),
  },
  returns: discoveryPageValidator,
  handler: async (ctx, args) => {
    const viewer = await getOptionalProfile(ctx)
    const access = resolveDiscoveryAccess(viewer, args.visibility)
    const scope: ReviewDiscoveryCursorScope = {
      ...access,
      query: normalizeOptionalDiscoveryQuery(args.query),
      sort: args.sort,
      ratingBand: args.ratingBand,
    }
    const active = getActiveDiscoveryLanes(scope.visibility, access.viewerId)
    const state = resolveDiscoveryState(args.cursor, scope, active)
    return await hydrateDiscoveryPage(ctx, await readDiscoveryPage(ctx, scope, active, state))
  },
})

export const getStats = query({
  args: { anilistId: v.number() }, returns: statsValidator,
  handler: async (ctx, args) => {
    await requireCachedAnime(ctx, args.anilistId)
    const [aggregate, viewer] = await Promise.all([
      ctx.db.query('animeReviewStats').withIndex('by_anilist_id', (q) => q.eq('anilistId', args.anilistId)).unique(),
      getOptionalProfile(ctx),
    ])
    const own = viewer ? await readMine(ctx, viewer._id, args.anilistId) : null
    return buildReviewStats(aggregate, own)
  },
})

export const setVisibility = mutation({
  args: { reviewId: v.id('reviews'), visibility: visibilityValidator }, returns: v.null(),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    const review = await readOwnedReview(ctx, args.reviewId, profile._id)
    const anime = await requireCachedAnime(ctx, review.anilistId)
    const updatedAt = Date.now()
    if (review.animeId && review.animeId !== anime.animeId) return fail('CATALOG_PROVIDER_REF_CONFLICT', `Review ${review._id} conflicts with provider mapping ${anime.animeId}.`)
    await ctx.db.patch('reviews', review._id, { animeId: anime.animeId, visibility: args.visibility, updatedAt, ...buildReviewDiscoveryFields(review._id, review.state, review.rating, review.publishedAt, updatedAt, profile, anime) })
    const next = await ctx.db.get('reviews', review._id)
    if (next) { await applyAggregate(ctx, review.anilistId, anime.animeId, review, next); await upsertReviewCard(ctx, next) }
    return null
  },
})

export const removeActivity = mutation({
  args: { reviewId: v.id('reviews') }, returns: v.null(),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    const review = await readOwnedReview(ctx, args.reviewId, profile._id)
    if (review.state !== 'published') return fail('REVIEW_NOT_PUBLISHED', 'Activity can be removed only from published Reviews.')
    const anime = await requireCachedAnime(ctx, review.anilistId)
    if (review.animeId && review.animeId !== anime.animeId) return fail('CATALOG_PROVIDER_REF_CONFLICT', `Review ${review._id} conflicts with provider mapping ${anime.animeId}.`)
    await ctx.db.patch('reviews', review._id, { animeId: anime.animeId, activityState: 'deleted', updatedAt: Date.now() })
    const next = await ctx.db.get('reviews', review._id)
    if (next) await upsertReviewCard(ctx, next)
    return null
  },
})

export const remove = mutation({
  args: { reviewId: v.id('reviews') }, returns: v.null(),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    const review = await readOwnedReview(ctx, args.reviewId, profile._id)
    const anime = await requireCachedAnime(ctx, review.anilistId)
    if (review.animeId && review.animeId !== anime.animeId) return fail('CATALOG_PROVIDER_REF_CONFLICT', `Review ${review._id} conflicts with provider mapping ${anime.animeId}.`)
    await applyAggregate(ctx, review.anilistId, anime.animeId, review, null)
    await removeReviewCard(ctx, review._id)
    await ctx.db.delete('reviews', review._id)
    return null
  },
})

export const backfillDiscoveryFields = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({ continueCursor: v.string(), isDone: v.boolean(), processedCount: v.number(), updatedCount: v.number() }),
  handler: async (ctx, args) => {
    const page = await ctx.db.query('reviews').paginate(args.paginationOpts)
    let updatedCount = 0
    for (const review of page.page) {
      const [author, anime] = await Promise.all([ctx.db.get('users', review.userId), requireCachedAnime(ctx, review.anilistId)])
      if (!author) return fail('REVIEW_AUTHOR_MISSING', `Review author profile is missing for ${review._id}.`)
      const expected = buildReviewDiscoveryFields(review._id, review.state, review.rating, review.publishedAt, review.updatedAt, author, anime)
      if (!reviewDiscoveryFieldsMatch(review, expected)) {
        await ctx.db.patch('reviews', review._id, expected)
        updatedCount += 1
      }
    }
    return { continueCursor: page.continueCursor, isDone: page.isDone, processedCount: page.page.length, updatedCount }
  },
})

export const verifyDiscoveryBackfill = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({ continueCursor: v.string(), isDone: v.boolean(), processedCount: v.number(), mismatchIds: v.array(v.id('reviews')) }),
  handler: async (ctx, args) => {
    const page = await ctx.db.query('reviews').paginate(args.paginationOpts)
    const mismatchIds: Id<'reviews'>[] = []
    for (const review of page.page) {
      const [author, anime] = await Promise.all([ctx.db.get('users', review.userId), requireCachedAnime(ctx, review.anilistId)])
      if (!author) return fail('REVIEW_AUTHOR_MISSING', `Review author profile is missing for ${review._id}.`)
      const expected = buildReviewDiscoveryFields(review._id, review.state, review.rating, review.publishedAt, review.updatedAt, author, anime)
      if (!reviewDiscoveryFieldsMatch(review, expected)) mismatchIds.push(review._id)
    }
    return { continueCursor: page.continueCursor, isDone: page.isDone, processedCount: page.page.length, mismatchIds }
  },
})
