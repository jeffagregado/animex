import { ConvexError, v } from 'convex/values'

import { ANIME_REVIEWS_PAGE_SIZE, reviewDraftInputSchema, reviewPublishInputSchema } from '../src/features/social/shared/social-contracts'
import { createReviewStats, parseReviewDocument, validateDraftReview, validatePublishedReview } from '../src/features/social/shared/review-document'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { makeOrderKey } from './feedPolicy'
import { assertRequestId, canReadSocialRecord, transitionReviewAggregate } from './socialPolicy'
import { getOptionalProfile, requireProfile } from './users'

const visibilityValidator = v.union(v.literal('private'), v.literal('followers'), v.literal('public'))
const reviewSortValidator = v.union(v.literal('newest'), v.literal('rating-high'), v.literal('rating-low'))
const bodyValidator = v.any()
const reviewFields = {
  anilistId: v.number(), requestId: v.string(), rating: v.union(v.number(), v.null()), summary: v.string(),
  summaryHasSpoiler: v.boolean(), body: bodyValidator, visibility: visibilityValidator,
}
const reviewValidator = v.any()
const reviewPageValidator = v.object({ items: v.array(reviewValidator), cursor: v.union(v.string(), v.null()), hasMore: v.boolean() })
const statsValidator = v.object({ count: v.number(), average: v.union(v.number(), v.null()), bands: v.array(v.number()) })

const fail = (code: string, message: string): never => { throw new ConvexError({ code, message }) }

const requireCachedAnime = async (ctx: QueryCtx | MutationCtx, anilistId: number) => {
  if (!Number.isSafeInteger(anilistId) || anilistId < 1) return fail('INVALID_ANIME_ID', 'Anime ID must be a positive safe integer.')
  const anime = await ctx.db.query('animeSummaries').withIndex('by_anilist_id', (q) => q.eq('anilistId', anilistId)).unique()
  if (!anime) return fail('ANIME_NOT_CACHED', 'Anime must be loaded before writing a Review.')
  return anime
}

const readMine = async (ctx: QueryCtx | MutationCtx, userId: Id<'users'>, anilistId: number) => await ctx.db
  .query('reviews').withIndex('by_user_anime', (q) => q.eq('userId', userId).eq('anilistId', anilistId)).unique()

const readOwnedReview = async (ctx: MutationCtx, reviewId: Id<'reviews'>, userId: Id<'users'>) => {
  const review = await ctx.db.get('reviews', reviewId)
  if (!review) return fail('REVIEW_NOT_FOUND', 'Review not found.')
  if (review.userId !== userId) return fail('REVIEW_FORBIDDEN', 'Only the Review owner can change it.')
  return review
}

const ratingOrder = (rating: number, descending: boolean): string => String(descending ? 1000 - Math.round(rating * 10) : Math.round(rating * 10)).padStart(4, '0')
const reviewOrderFields = (publishedAt: number, rating: number, reviewId: string) => ({
  newestOrderKey: makeOrderKey(publishedAt, reviewId),
  highRatingOrderKey: `${ratingOrder(rating, true)}:${makeOrderKey(publishedAt, reviewId)}`,
  lowRatingOrderKey: `${ratingOrder(rating, false)}:${makeOrderKey(publishedAt, reviewId)}`,
})

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

const applyAggregate = async (ctx: MutationCtx, anilistId: number, previous: Doc<'reviews'> | null, next: Doc<'reviews'> | null): Promise<void> => {
  const delta = transitionReviewAggregate(publicRating(previous), publicRating(next))
  if (!hasAggregateChange(delta)) return
  const current = await ctx.db.query('animeReviewStats').withIndex('by_anilist_id', (q) => q.eq('anilistId', anilistId)).unique()
  const fields = nextAggregateFields(current, delta)
  if (fields.count < 0 || fields.bands.some((value) => value < 0)) return fail('REVIEW_STATS_CORRUPT', 'Review aggregate transition would become negative.')
  if (current) await ctx.db.patch('animeReviewStats', current._id, fields)
  else await ctx.db.insert('animeReviewStats', { anilistId, ...fields })
}

const upsertReviewCard = async (ctx: MutationCtx, review: Doc<'reviews'>): Promise<void> => {
  const sourceKey = `review:${review._id}`
  const existing = await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', sourceKey)).unique()
  const active = review.state === 'published' && review.activityState === 'active'
  if (existing) {
    await ctx.db.patch('feedCards', existing._id, { visibility: review.visibility, active, updatedAt: review.updatedAt })
    return
  }
  if (!active || review.publishedAt === undefined) return
  await ctx.db.insert('feedCards', {
    sourceKey, kind: 'review', userId: review.userId, sourceId: review._id, anilistId: review.anilistId,
    visibility: review.visibility, active: true, orderKey: makeOrderKey(review.publishedAt, sourceKey),
    occurredAt: review.publishedAt, updatedAt: review.updatedAt,
  })
}

const removeReviewCard = async (ctx: MutationCtx, reviewId: Id<'reviews'>): Promise<void> => {
  const card = await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', `review:${reviewId}`)).unique()
  if (card) await ctx.db.delete('feedCards', card._id)
}

const toReview = async (ctx: QueryCtx, review: Doc<'reviews'>) => {
  const [author, anime] = await Promise.all([ctx.db.get('users', review.userId), requireCachedAnime(ctx, review.anilistId)])
  if (!author) return fail('REVIEW_AUTHOR_MISSING', 'Review author profile is missing.')
  const avatarUrl = author.avatarStorageId ? await ctx.storage.getUrl(author.avatarStorageId) : null
  return {
    id: review._id, author: { id: author._id, username: author.username, displayName: author.name, avatarUrl },
    anime: { id: String(anime.anilistId), anilistId: anime.anilistId, slug: anime.slug, title: anime.titles.display, coverImageUrl: anime.coverImageUrl },
    state: review.state, rating: review.rating, summary: review.summary, summaryHasSpoiler: review.summaryHasSpoiler,
    visibility: review.visibility, publishedAt: review.publishedAt ?? null, updatedAt: review.updatedAt,
    body: parseReviewDocument(JSON.parse(review.bodyJson)),
  }
}

export const getMineForAnime = query({
  args: { anilistId: v.number() }, returns: v.union(reviewValidator, v.null()),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    await requireCachedAnime(ctx, args.anilistId)
    const review = await readMine(ctx, profile._id, args.anilistId)
    return review ? await toReview(ctx, review) : null
  },
})

export const saveDraft = mutation({
  args: reviewFields, returns: v.id('reviews'),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    await requireCachedAnime(ctx, args.anilistId)
    const { anilistId, ...contractInput } = args
    reviewDraftInputSchema.parse({ ...contractInput, animeId: String(anilistId) })
    const parsed = validateDraftReview(args.body, args.rating, args.summary)
    const requestId = assertRequestId(args.requestId)
    const existing = await readMine(ctx, profile._id, args.anilistId)
    if (existing?.state === 'published') return fail('REVIEW_ALREADY_PUBLISHED', 'Published Review must be edited, not saved as Draft.')
    const now = Date.now()
    if (existing) {
      await ctx.db.patch('reviews', existing._id, { requestId, rating: parsed.rating, summary: parsed.summary, summaryHasSpoiler: args.summaryHasSpoiler, bodyJson: JSON.stringify(parsed.body), visibility: args.visibility, updatedAt: now })
      return existing._id
    }
    const placeholder = reviewOrderFields(now, parsed.rating ?? 0, `${profile._id}:${args.anilistId}`)
    return await ctx.db.insert('reviews', { userId: profile._id, anilistId: args.anilistId, requestId, state: 'draft', rating: parsed.rating, summary: parsed.summary, summaryHasSpoiler: args.summaryHasSpoiler, bodyJson: JSON.stringify(parsed.body), visibility: args.visibility, updatedAt: now, activityState: 'active', ...placeholder })
  },
})

export const publish = mutation({
  args: { ...reviewFields, rating: v.number() }, returns: v.id('reviews'),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    await requireCachedAnime(ctx, args.anilistId)
    const { anilistId, ...contractInput } = args
    reviewPublishInputSchema.parse({ ...contractInput, animeId: String(anilistId) })
    const parsed = validatePublishedReview(args.body, args.rating, args.summary)
    const requestId = assertRequestId(args.requestId)
    const byRequest = await ctx.db.query('reviews').withIndex('by_user_request', (q) => q.eq('userId', profile._id).eq('requestId', requestId)).unique()
    if (byRequest?.state === 'published') return byRequest._id
    const existing = await readMine(ctx, profile._id, args.anilistId)
    const now = Date.now()
    const publishedAt = existing?.publishedAt ?? now
    let reviewId: Id<'reviews'>
    if (existing) {
      const order = reviewOrderFields(publishedAt, parsed.rating, existing._id)
      await ctx.db.patch('reviews', existing._id, { requestId, state: 'published', rating: parsed.rating, summary: parsed.summary, summaryHasSpoiler: args.summaryHasSpoiler, bodyJson: JSON.stringify(parsed.body), visibility: args.visibility, publishedAt, updatedAt: now, ...order })
      reviewId = existing._id
    } else {
      const source = `${profile._id}:${args.anilistId}`
      reviewId = await ctx.db.insert('reviews', { userId: profile._id, anilistId: args.anilistId, requestId, state: 'published', rating: parsed.rating, summary: parsed.summary, summaryHasSpoiler: args.summaryHasSpoiler, bodyJson: JSON.stringify(parsed.body), visibility: args.visibility, publishedAt, updatedAt: now, activityState: 'active', ...reviewOrderFields(publishedAt, parsed.rating, source) })
    }
    const next = await ctx.db.get('reviews', reviewId)
    if (!next) return fail('REVIEW_WRITE_FAILED', 'Review was not saved.')
    await applyAggregate(ctx, args.anilistId, existing, next)
    await upsertReviewCard(ctx, next)
    return reviewId
  },
})

export const update = mutation({
  args: { reviewId: v.id('reviews'), rating: v.number(), summary: v.string(), summaryHasSpoiler: v.boolean(), body: bodyValidator, visibility: visibilityValidator },
  returns: v.id('reviews'),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    const review = await readOwnedReview(ctx, args.reviewId, profile._id)
    if (review.state !== 'published' || review.publishedAt === undefined) return fail('REVIEW_NOT_PUBLISHED', 'Only published Reviews can be updated.')
    const parsed = validatePublishedReview(args.body, args.rating, args.summary)
    const now = Date.now()
    await ctx.db.patch('reviews', review._id, { rating: parsed.rating, summary: parsed.summary, summaryHasSpoiler: args.summaryHasSpoiler, bodyJson: JSON.stringify(parsed.body), visibility: args.visibility, updatedAt: now, ...reviewOrderFields(review.publishedAt, parsed.rating, review._id) })
    const next = await ctx.db.get('reviews', review._id)
    if (!next) return fail('REVIEW_WRITE_FAILED', 'Review update failed.')
    await applyAggregate(ctx, review.anilistId, review, next)
    await upsertReviewCard(ctx, next)
    return review._id
  },
})

export const getById = query({
  args: { reviewId: v.id('reviews') }, returns: v.union(reviewValidator, v.null()),
  handler: async (ctx, args) => {
    const [review, viewer] = await Promise.all([ctx.db.get('reviews', args.reviewId), getOptionalProfile(ctx)])
    if (!review || review.state !== 'published' || !canReadSocialRecord(review.visibility, viewer?._id ?? null, review.userId)) return null
    return await toReview(ctx, review)
  },
})

type ReviewOrderKey = 'newestOrderKey' | 'highRatingOrderKey' | 'lowRatingOrderKey'
type ReviewIndex = 'by_anime_state_visibility_newest' | 'by_anime_state_visibility_high_rating' | 'by_anime_state_visibility_low_rating'

const getReviewSortConfig = (sort: 'newest' | 'rating-high' | 'rating-low'): { index: ReviewIndex; key: ReviewOrderKey } => {
  if (sort === 'newest') return { index: 'by_anime_state_visibility_newest', key: 'newestOrderKey' }
  if (sort === 'rating-high') return { index: 'by_anime_state_visibility_high_rating', key: 'highRatingOrderKey' }
  return { index: 'by_anime_state_visibility_low_rating', key: 'lowRatingOrderKey' }
}

const readPublicReviewPage = async (ctx: QueryCtx, anilistId: number, cursor: string | null, config: { index: ReviewIndex; key: ReviewOrderKey }) => await ctx.db
  .query('reviews').withIndex(config.index, (q) => {
    const base = q.eq('anilistId', anilistId).eq('state', 'published').eq('visibility', 'public')
    return cursor === null ? base : base.gt(config.key, cursor)
  }).take(ANIME_REVIEWS_PAGE_SIZE + 1)

const includeOwnNonpublicReview = (publicReviews: Doc<'reviews'>[], own: Doc<'reviews'> | null): Doc<'reviews'>[] => own?.state === 'published' && own.visibility !== 'public'
  ? [...publicReviews, own]
  : publicReviews

const getPersonalReviewStats = (own: Doc<'reviews'> | null) => {
  if (own?.state !== 'published') return null
  if (own.visibility === 'public' || own.rating === null) return null
  return { rating: own.rating, bands: createReviewStats([own.rating]).bands }
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
  return { count, average: count === 0 ? null : Math.round((sum / count) * 10) / 10, bands }
}

export const listForAnime = query({
  args: { anilistId: v.number(), sort: reviewSortValidator, cursor: v.union(v.string(), v.null()) }, returns: reviewPageValidator,
  handler: async (ctx, args) => {
    await requireCachedAnime(ctx, args.anilistId)
    const viewer = await getOptionalProfile(ctx)
    const { index, key } = getReviewSortConfig(args.sort)
    const publicReviews = await readPublicReviewPage(ctx, args.anilistId, args.cursor, { index, key })
    const own = viewer ? await readMine(ctx, viewer._id, args.anilistId) : null
    const candidates = includeOwnNonpublicReview(publicReviews, own)
    candidates.sort((left, right) => left[key].localeCompare(right[key]))
    const page = candidates.slice(0, ANIME_REVIEWS_PAGE_SIZE)
    return { items: await Promise.all(page.map((review) => toReview(ctx, review))), cursor: page.length === ANIME_REVIEWS_PAGE_SIZE ? page.at(-1)?.[key] ?? null : null, hasMore: candidates.length > ANIME_REVIEWS_PAGE_SIZE || publicReviews.length > ANIME_REVIEWS_PAGE_SIZE }
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
    await ctx.db.patch('reviews', review._id, { visibility: args.visibility, updatedAt: Date.now() })
    const next = await ctx.db.get('reviews', review._id)
    if (next) { await applyAggregate(ctx, review.anilistId, review, next); await upsertReviewCard(ctx, next) }
    return null
  },
})

export const removeActivity = mutation({
  args: { reviewId: v.id('reviews') }, returns: v.null(),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    const review = await readOwnedReview(ctx, args.reviewId, profile._id)
    await ctx.db.patch('reviews', review._id, { activityState: 'deleted', updatedAt: Date.now() })
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
    await applyAggregate(ctx, review.anilistId, review, null)
    await removeReviewCard(ctx, review._id)
    await ctx.db.delete('reviews', review._id)
    return null
  },
})
