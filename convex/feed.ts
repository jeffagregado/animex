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
  v.object({ id: v.string(), kind: v.literal('completed'), author: authorValidator, anime: animeValidator, settledAt: v.number() }),
  v.object({ id: v.string(), kind: v.literal('rewatched'), author: authorValidator, anime: animeValidator, settledAt: v.number() }),
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

const resolveMilestoneCard = async (ctx: QueryCtx, card: Doc<'feedCards'>, author: FeedAuthor): Promise<FeedCard> => {
  if (card.anilistId === undefined || (card.kind !== 'completed' && card.kind !== 'rewatched')) return fail('FEED_SOURCE_MISSING', 'Feed milestone source is missing.')
  return { id: card._id, kind: card.kind, author, anime: await getAnime(ctx, card.anilistId), settledAt: card.occurredAt }
}

const resolveCard = async (ctx: QueryCtx, card: Doc<'feedCards'>): Promise<FeedCard> => {
  const author = await getAuthor(ctx, card.userId)
  if (card.kind === 'post') return await resolvePostCard(ctx, card, author)
  if (card.kind === 'review') return await resolveReviewCard(ctx, card, author)
  return await resolveMilestoneCard(ctx, card, author)
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
  const page = candidates.slice(0, FEED_PAGE_SIZE)
  return {
    items: await Promise.all(page.map((card) => resolveCard(ctx, card))),
    cursor: candidates.length > FEED_PAGE_SIZE ? encodeFeedCursor({ view, viewerId, prioritizedAnchor: null, globalAnchor: page.at(-1)?.orderKey ?? null, cycleIndex: 0 }) : null,
    hasMore: candidates.length > FEED_PAGE_SIZE,
  }
}

const getHomeGlobalAnchor = (page: HomeGlobalPage, consumed: number, current: string | null): string | null => {
  if (consumed < page.cards.length) return page.resumeAnchors[consumed] ?? current
  return page.scannedAnchor
}

const hasHomeItems = (ownCount: number, ownConsumed: number, globalPage: HomeGlobalPage, globalConsumed: number): boolean => {
  if (ownCount > ownConsumed) return true
  if (globalPage.cards.length > globalConsumed) return true
  return !globalPage.terminal
}

const listHomePage = async (ctx: QueryCtx, cursor: string | null, viewerId: Id<'users'>) => {
  const anchors = decodeFeedCursor(cursor, 'home', viewerId)
  const [own, globalPage] = await Promise.all([readOwn(ctx, viewerId, anchors.prioritizedAnchor), readHomeGlobal(ctx, viewerId, anchors.globalAnchor)])
  const global = globalPage.cards
  const [ownDtos, globalDtos] = await Promise.all([
    Promise.all(own.slice(0, FEED_PAGE_SIZE).map((card) => resolveCard(ctx, card))),
    Promise.all(global.slice(0, FEED_PAGE_SIZE).map((card) => resolveCard(ctx, card))),
  ])
  const merged = mergeFeedCards(ownDtos, globalDtos, FEED_PAGE_SIZE, anchors.cycleIndex)
  const prioritizedAnchor = merged.prioritizedConsumed > 0 ? own[merged.prioritizedConsumed - 1]?.orderKey ?? anchors.prioritizedAnchor : anchors.prioritizedAnchor
  const globalAnchor = getHomeGlobalAnchor(globalPage, merged.globalConsumed, anchors.globalAnchor)
  const hasMore = hasHomeItems(own.length, merged.prioritizedConsumed, globalPage, merged.globalConsumed)
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

export const getById = query({
  args: { cardId: v.id('feedCards') }, returns: v.union(feedCardValidator, v.null()),
  handler: async (ctx, args) => {
    const [card, viewer] = await Promise.all([ctx.db.get('feedCards', args.cardId), getOptionalProfile(ctx)])
    if (!card || !card.active || !canReadSocialRecord(card.visibility, viewer?._id ?? null, card.userId)) return null
    return await resolveCard(ctx, card)
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

export const projectMilestones = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({ continueCursor: v.string(), isDone: v.boolean() }),
  handler: async (ctx, args) => {
    const page = await ctx.db.query('animeMilestones').paginate(args.paginationOpts)
    for (const milestone of page.page) {
      await requireCachedAnime(ctx, milestone.anilistId)
      await upsertMilestoneCard(ctx, milestone, false)
    }
    return { continueCursor: page.continueCursor, isDone: page.isDone }
  },
})
