import { paginationOptsValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'

import { FEED_PAGE_SIZE, type FeedCard } from '../src/features/social/shared/social-contracts'
import { mergeFeedCards } from '../src/features/social/shared/feed-ranking'
import type { Doc, Id } from './_generated/dataModel'
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { decodeFeedCursor, encodeFeedCursor, makeOrderKey, type FeedView } from './feedPolicy'
import { canReadSocialRecord } from './socialPolicy'
import { getOptionalProfile, requireProfile } from './users'

const visibilityValidator = v.union(v.literal('private'), v.literal('followers'), v.literal('public'))
const authorValidator = v.object({ id: v.string(), username: v.string(), displayName: v.string(), avatarUrl: v.union(v.string(), v.null()) })
const animeValidator = v.object({ anilistId: v.number(), slug: v.string(), title: v.string(), coverImageUrl: v.union(v.string(), v.null()) })
const feedCardValidator = v.union(
  v.object({ id: v.string(), postId: v.string(), kind: v.literal('post'), author: authorValidator, text: v.string(), imageIds: v.array(v.string()), imageUrls: v.array(v.string()), hasSpoiler: v.boolean(), visibility: visibilityValidator, createdAt: v.number(), updatedAt: v.number() }),
  v.object({ id: v.string(), reviewId: v.string(), kind: v.literal('review'), author: authorValidator, anime: animeValidator, rating: v.number(), summary: v.string(), summaryHasSpoiler: v.boolean(), visibility: visibilityValidator, publishedAt: v.number(), updatedAt: v.number() }),
  v.object({ id: v.string(), kind: v.literal('completed'), author: authorValidator, anime: animeValidator, settledAt: v.number(), visibility: visibilityValidator }),
  v.object({ id: v.string(), kind: v.literal('rewatched'), author: authorValidator, anime: animeValidator, settledAt: v.number(), visibility: visibilityValidator }),
)
const feedPageValidator = v.object({ items: v.array(feedCardValidator), cursor: v.union(v.string(), v.null()), hasMore: v.boolean() })
const fail = (code: string, message: string): never => { throw new ConvexError({ code, message }) }

const getAuthor = async (ctx: QueryCtx, userId: Id<'users'>) => {
  const author = await ctx.db.get('users', userId)
  if (!author) return fail('FEED_AUTHOR_MISSING', 'Feed author profile is missing.')
  return { id: author._id, username: author.username, displayName: author.name, avatarUrl: author.avatarStorageId ? await ctx.storage.getUrl(author.avatarStorageId) : null }
}

const getAnime = async (ctx: QueryCtx, anilistId: number) => {
  const anime = await ctx.db.query('animeSummaries').withIndex('by_anilist_id', (q) => q.eq('anilistId', anilistId)).unique()
  if (!anime) return fail('FEED_ANIME_MISSING', 'Feed anime summary is missing.')
  return { anilistId, slug: anime.slug, title: anime.titles.display, coverImageUrl: anime.coverImageUrl }
}

const requireCachedAnime = async (ctx: QueryCtx | MutationCtx, anilistId: number): Promise<void> => {
  const anime = await ctx.db.query('animeSummaries').withIndex('by_anilist_id', (q) => q.eq('anilistId', anilistId)).unique()
  if (!anime) return fail('ANIME_NOT_CACHED', 'Anime must be loaded before writing milestone activity.')
}

type FeedAuthor = Awaited<ReturnType<typeof getAuthor>>
type MilestoneRead = { mode: 'direct'; viewerId: Id<'users'> | null } | { mode: 'owner' } | { mode: 'public' }

/** Identifies milestone projections. */
const isMilestoneCard = (card: Doc<'feedCards'>): boolean => card.kind === 'completed' || card.kind === 'rewatched'

/** Applies lane-specific source visibility. */
const canReadMilestone = (milestone: Doc<'animeMilestones'>, read: MilestoneRead): boolean => {
  if (read.mode === 'public') return milestone.visibility === 'public'
  if (read.mode === 'direct') return canReadSocialRecord(milestone.visibility, read.viewerId, milestone.userId)
  return true
}

const resolvePostCard = async (ctx: QueryCtx, card: Doc<'feedCards'>, author: FeedAuthor): Promise<FeedCard> => {
  const postId = card.sourceId ? ctx.db.normalizeId('posts', card.sourceId) : null
  const post = postId ? await ctx.db.get('posts', postId) : null
  if (!post) return fail('FEED_SOURCE_MISSING', 'Feed Post source is missing.')
  const images = await Promise.all(post.imageIds.map((id) => ctx.db.get('postImages', id)))
  const imageUrls = await Promise.all(images.map(async (image) => image?.storageId ? await ctx.storage.getUrl(image.storageId) : null))
  const resolvedImages = post.imageIds.flatMap((imageId, index) => {
    const url = imageUrls[index]
    return url ? [{ imageId, url }] : []
  })
  return { id: card._id, postId: post._id, kind: 'post', author, text: post.text, imageIds: resolvedImages.map((image) => image.imageId), imageUrls: resolvedImages.map((image) => image.url), hasSpoiler: post.hasSpoiler, visibility: post.visibility, createdAt: post.createdAt, updatedAt: post.updatedAt }
}

const resolveReviewCard = async (ctx: QueryCtx, card: Doc<'feedCards'>, author: FeedAuthor): Promise<FeedCard> => {
  const reviewId = card.sourceId ? ctx.db.normalizeId('reviews', card.sourceId) : null
  const review = reviewId ? await ctx.db.get('reviews', reviewId) : null
  if (!review || review.rating === null || review.publishedAt === undefined) return fail('FEED_SOURCE_MISSING', 'Feed Review source is missing.')
  return { id: card._id, reviewId: review._id, kind: 'review', author, anime: await getAnime(ctx, review.anilistId), rating: review.rating, summary: review.summary, summaryHasSpoiler: review.summaryHasSpoiler, visibility: review.visibility, publishedAt: review.publishedAt, updatedAt: review.updatedAt }
}

const resolveMilestoneCard = async (ctx: QueryCtx, card: Doc<'feedCards'>, read: MilestoneRead): Promise<FeedCard | null> => {
  if (card.anilistId === undefined || (card.kind !== 'completed' && card.kind !== 'rewatched')) return fail('FEED_SOURCE_MISSING', 'Feed milestone source is missing.')
  if (card.sourceKey !== `${card.kind}:${card.userId}:${card.anilistId}`) return null
  const milestone = await ctx.db.query('animeMilestones').withIndex('by_user_anime_kind', (q) => q.eq('userId', card.userId).eq('anilistId', card.anilistId as number).eq('kind', card.kind as 'completed' | 'rewatched')).unique()
  if (!milestone || !canReadMilestone(milestone, read)) return null
  return { id: card._id, kind: milestone.kind, author: await getAuthor(ctx, milestone.userId), anime: await getAnime(ctx, milestone.anilistId), settledAt: milestone.occurredAt, visibility: milestone.visibility }
}

const resolveCard = async (ctx: QueryCtx, card: Doc<'feedCards'>, milestoneRead: MilestoneRead): Promise<FeedCard | null> => {
  if (isMilestoneCard(card)) return await resolveMilestoneCard(ctx, card, milestoneRead)
  const author = await getAuthor(ctx, card.userId)
  if (card.kind === 'post') return await resolvePostCard(ctx, card, author)
  return await resolveReviewCard(ctx, card, author)
}

const readGlobal = async (ctx: QueryCtx, anchor: string | null) => await ctx.db.query('feedCards')
  .withIndex('by_public_active_order', (q) => {
    const base = q.eq('visibility', 'public').eq('active', true)
    return anchor === null ? base : base.gt('orderKey', anchor)
  }).take(FEED_PAGE_SIZE + 1)

const readOwn = async (ctx: QueryCtx, userId: Id<'users'>, anchor: string | null) => await ctx.db.query('feedCards')
  .withIndex('by_user_active_order', (q) => {
    const base = q.eq('userId', userId).eq('active', true)
    return anchor === null ? base : base.gt('orderKey', anchor)
  }).take(FEED_PAGE_SIZE + 1)

type HomeGlobalPage = { cards: Doc<'feedCards'>[]; resumeAnchors: Array<string | null>; scannedAnchor: string | null; terminal: boolean }
type ResolvedFeedPage = { items: FeedCard[]; resumeAnchors: Array<string | null>; scannedAnchor: string | null; terminal: boolean }

/** Tracks raw anchors around one bounded batch. */
const createRawPage = (cards: Doc<'feedCards'>[], anchor: string | null): HomeGlobalPage => {
  const resumeAnchors: Array<string | null> = []
  let previousAnchor = anchor
  for (const card of cards) {
    resumeAnchors.push(previousAnchor)
    previousAnchor = card.orderKey
  }
  return { cards, resumeAnchors, scannedAnchor: previousAnchor, terminal: cards.length < FEED_PAGE_SIZE + 1 }
}

/** Resolves source-backed cards while preserving anchors. */
const resolveFeedPage = async (ctx: QueryCtx, page: HomeGlobalPage, read: MilestoneRead): Promise<ResolvedFeedPage> => {
  const items: FeedCard[] = []
  const resumeAnchors: Array<string | null> = []
  const resolved = await Promise.all(page.cards.map(async (card) => await resolveCard(ctx, card, read)))
  for (let index = 0; index < resolved.length; index += 1) {
    const item = resolved[index]
    if (item) {
      items.push(item)
      resumeAnchors.push(page.resumeAnchors[index] ?? null)
    }
  }
  return { items, resumeAnchors, scannedAnchor: page.scannedAnchor, terminal: page.terminal }
}

const readHomeGlobal = async (ctx: QueryCtx, viewerId: Id<'users'>, anchor: string | null): Promise<HomeGlobalPage> => {
  const raw = await readGlobal(ctx, anchor)
  const cards: Doc<'feedCards'>[] = []
  const resumeAnchors: Array<string | null> = []
  let previousAnchor = anchor
  for (const card of raw) {
    if (card.userId !== viewerId) {
      cards.push(card)
      resumeAnchors.push(previousAnchor)
    }
    previousAnchor = card.orderKey
  }
  return { cards, resumeAnchors, scannedAnchor: previousAnchor, terminal: raw.length < FEED_PAGE_SIZE + 1 }
}

const listGlobalPage = async (ctx: QueryCtx, cursor: string | null, viewerId: Id<'users'> | null, view: FeedView) => {
  const anchors = decodeFeedCursor(cursor, view, viewerId)
  const candidates = await readGlobal(ctx, anchors.globalAnchor)
  const page = await resolveFeedPage(ctx, createRawPage(candidates, anchors.globalAnchor), { mode: 'public' })
  const items = page.items.slice(0, FEED_PAGE_SIZE)
  const hasMore = page.items.length > FEED_PAGE_SIZE || !page.terminal
  const globalAnchor = getPageAnchor(page, items.length, anchors.globalAnchor)
  return {
    items,
    cursor: hasMore ? encodeFeedCursor({ view, viewerId, prioritizedAnchor: null, globalAnchor, cycleIndex: 0 }) : null,
    hasMore,
  }
}

/** Advances through consumed and suppressed projections. */
const getPageAnchor = (page: ResolvedFeedPage, consumed: number, current: string | null): string | null => {
  if (consumed < page.items.length) return page.resumeAnchors[consumed] ?? current
  return page.scannedAnchor
}

/** Detects remaining Home lane work. */
const hasHomeItems = (ownPage: ResolvedFeedPage, ownConsumed: number, globalPage: ResolvedFeedPage, globalConsumed: number): boolean => {
  if (ownPage.items.length > ownConsumed || !ownPage.terminal) return true
  return globalPage.items.length > globalConsumed || !globalPage.terminal
}

const listHomePage = async (ctx: QueryCtx, cursor: string | null, viewerId: Id<'users'>) => {
  const anchors = decodeFeedCursor(cursor, 'home', viewerId)
  const [own, global] = await Promise.all([readOwn(ctx, viewerId, anchors.prioritizedAnchor), readHomeGlobal(ctx, viewerId, anchors.globalAnchor)])
  const [ownPage, globalPage] = await Promise.all([
    resolveFeedPage(ctx, createRawPage(own, anchors.prioritizedAnchor), { mode: 'owner' }),
    resolveFeedPage(ctx, global, { mode: 'public' }),
  ])
  const merged = mergeFeedCards(ownPage.items, globalPage.items, FEED_PAGE_SIZE, anchors.cycleIndex)
  const prioritizedAnchor = getPageAnchor(ownPage, merged.prioritizedConsumed, anchors.prioritizedAnchor)
  const globalAnchor = getPageAnchor(globalPage, merged.globalConsumed, anchors.globalAnchor)
  const hasMore = hasHomeItems(ownPage, merged.prioritizedConsumed, globalPage, merged.globalConsumed)
  return { items: merged.items, cursor: hasMore ? encodeFeedCursor({ view: 'home', viewerId, prioritizedAnchor, globalAnchor, cycleIndex: merged.nextCycleIndex }) : null, hasMore }
}

export const listGlobal = query({
  args: { cursor: v.union(v.string(), v.null()) }, returns: feedPageValidator,
  handler: async (ctx, args) => {
    const viewer = await getOptionalProfile(ctx)
    return await listGlobalPage(ctx, args.cursor, viewer?._id ?? null, 'global')
  },
})

export const listHome = query({
  args: { cursor: v.union(v.string(), v.null()) }, returns: feedPageValidator,
  handler: async (ctx, args) => {
    const viewer = await getOptionalProfile(ctx)
    if (!viewer) return await listGlobalPage(ctx, args.cursor, null, 'home')
    return await listHomePage(ctx, args.cursor, viewer._id)
  },
})

export const listFollowing = query({
  args: { cursor: v.union(v.string(), v.null()) }, returns: feedPageValidator,
  handler: async (_ctx, args) => {
    if (args.cursor !== null) return fail('INVALID_CURSOR', 'Following feed has no Phase 5 cursor.')
    return { items: [], cursor: null, hasMore: false }
  },
})

/** Resolves a card using authoritative direct-read access. */
const resolveDirectCard = async (ctx: QueryCtx, card: Doc<'feedCards'>, viewerId: Id<'users'> | null): Promise<FeedCard | null> => {
  if (isMilestoneCard(card)) return await resolveMilestoneCard(ctx, card, { mode: 'direct', viewerId })
  if (!canReadSocialRecord(card.visibility, viewerId, card.userId)) return null
  return await resolveCard(ctx, card, { mode: 'direct', viewerId })
}

export const getById = query({
  args: { cardId: v.string() }, returns: v.union(feedCardValidator, v.null()),
  handler: async (ctx, args) => {
    const cardId = ctx.db.normalizeId('feedCards', args.cardId)
    if (!cardId) return null
    const [card, viewer] = await Promise.all([ctx.db.get('feedCards', cardId), getOptionalProfile(ctx)])
    if (!card || !card.active) return null
    return await resolveDirectCard(ctx, card, viewer?._id ?? null)
  },
})

export const upsertMilestoneCard = async (ctx: MutationCtx, milestone: Doc<'animeMilestones'>, activate: boolean): Promise<void> => {
  const sourceKey = `${milestone.kind}:${milestone.userId}:${milestone.anilistId}`
  const existing = await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', sourceKey)).unique()
  const fields = { visibility: milestone.visibility, active: activate || !existing ? true : existing.active, orderKey: makeOrderKey(milestone.occurredAt, sourceKey), occurredAt: milestone.occurredAt, updatedAt: milestone.updatedAt }
  if (existing) await ctx.db.patch('feedCards', existing._id, fields)
  else await ctx.db.insert('feedCards', { sourceKey, kind: milestone.kind, userId: milestone.userId, anilistId: milestone.anilistId, ...fields })
}

export const removeMilestoneCard = async (ctx: MutationCtx, userId: Id<'users'>, anilistId: number, kind: 'completed' | 'rewatched'): Promise<void> => {
  const sourceKey = `${kind}:${userId}:${anilistId}`
  const card = await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', sourceKey)).unique()
  if (card) await ctx.db.patch('feedCards', card._id, { active: false, updatedAt: Date.now() })
}

const readOwnedMilestoneCard = async (ctx: MutationCtx, cardId: Id<'feedCards'>, userId: Id<'users'>) => {
  const card = await ctx.db.get('feedCards', cardId)
  if (!card || (card.kind !== 'completed' && card.kind !== 'rewatched')) return fail('ACTIVITY_NOT_FOUND', 'Milestone activity not found.')
  if (card.userId !== userId) return fail('ACTIVITY_FORBIDDEN', 'Only the activity owner can change it.')
  return card
}

export const setActivityVisibility = mutation({
  args: { cardId: v.id('feedCards'), visibility: visibilityValidator }, returns: v.null(),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    const card = await readOwnedMilestoneCard(ctx, args.cardId, profile._id)
    if (card.anilistId === undefined) return fail('ACTIVITY_SOURCE_MISSING', 'Milestone activity source is missing.')
    await requireCachedAnime(ctx, card.anilistId)
    const milestone = await ctx.db.query('animeMilestones').withIndex('by_user_anime_kind', (q) => q.eq('userId', profile._id).eq('anilistId', card.anilistId as number).eq('kind', card.kind as 'completed' | 'rewatched')).unique()
    if (!milestone) return fail('ACTIVITY_SOURCE_MISSING', 'Milestone activity source is missing.')
    const now = Date.now()
    await ctx.db.patch('animeMilestones', milestone._id, { visibility: args.visibility, updatedAt: now })
    await ctx.db.patch('feedCards', card._id, { visibility: args.visibility, updatedAt: now })
    return null
  },
})

export const removeActivity = mutation({
  args: { cardId: v.id('feedCards') }, returns: v.null(),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    const card = await readOwnedMilestoneCard(ctx, args.cardId, profile._id)
    if (card.anilistId === undefined) return fail('ACTIVITY_SOURCE_MISSING', 'Milestone activity source is missing.')
    await requireCachedAnime(ctx, card.anilistId)
    await ctx.db.patch('feedCards', card._id, { active: false, updatedAt: Date.now() })
    return null
  },
})

/** Checks projection fields against milestone truth. */
const matchesMilestoneProjection = (card: Doc<'feedCards'> | null, milestone: Doc<'animeMilestones'>, sourceKey: string): boolean => {
  if (!card) return false
  const fields = [
    [card.kind, milestone.kind], [card.userId, milestone.userId], [card.anilistId, milestone.anilistId],
    [card.visibility, milestone.visibility], [card.occurredAt, milestone.occurredAt], [card.updatedAt, milestone.updatedAt],
    [card.orderKey, makeOrderKey(milestone.occurredAt, sourceKey)],
  ]
  return fields.every(([actual, expected]) => actual === expected)
}

export const projectMilestones = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({ continueCursor: v.string(), isDone: v.boolean(), processedCount: v.number(), verifiedCount: v.number() }),
  handler: async (ctx, args) => {
    const page = await ctx.db.query('animeMilestones').paginate(args.paginationOpts)
    let verifiedCount = 0
    for (const milestone of page.page) {
      await requireCachedAnime(ctx, milestone.anilistId)
      await upsertMilestoneCard(ctx, milestone, false)
      const sourceKey = `${milestone.kind}:${milestone.userId}:${milestone.anilistId}`
      const card = await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', sourceKey)).unique()
      if (!matchesMilestoneProjection(card, milestone, sourceKey)) return fail('MILESTONE_PROJECTION_INVALID', `Milestone projection validation failed for ${sourceKey}.`)
      verifiedCount += 1
    }
    return { continueCursor: page.continueCursor, isDone: page.isDone, processedCount: page.page.length, verifiedCount }
  },
})
