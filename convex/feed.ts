import { paginationOptsValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'

import { FEED_PAGE_SIZE, type FeedCard as SocialFeedCard } from '../src/features/social/shared/social-contracts'
import { mergeFeedCards } from '../src/features/social/shared/feed-ranking'
import type { Doc, Id } from './_generated/dataModel'
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { resolveProviderByCatalogPublicId } from './catalogIdentityModel'
import { decodeFeedCursor, encodeFeedCursor, makeOrderKey, type FeedView } from './feedPolicy'
import { postMediaValidator } from './postValidators'
import { resolveProfileAccess } from './profiles'
import { canReadSocialRecord } from './socialPolicy'
import { getOptionalProfile, requireProfile } from './users'

const visibilityValidator = v.union(v.literal('private'), v.literal('followers'), v.literal('public'))
const authorValidator = v.object({ id: v.string(), username: v.string(), displayName: v.string(), avatarUrl: v.union(v.string(), v.null()) })
const animeValidator = v.object({ publicId: v.id('catalogEntities'), slug: v.string(), title: v.string(), coverImageUrl: v.union(v.string(), v.null()) })
const animeFormatValidator = v.union(
  v.literal('TV'), v.literal('TV_SHORT'), v.literal('MOVIE'), v.literal('SPECIAL'),
  v.literal('OVA'), v.literal('ONA'), v.literal('MUSIC'), v.null(),
)
const activityAnimeValidator = v.object({
  publicId: v.id('catalogEntities'), slug: v.string(), title: v.string(), coverImageUrl: v.union(v.string(), v.null()),
  seasonYear: v.union(v.number(), v.null()), format: animeFormatValidator,
})
const feedCardValidator = v.union(
  v.object({ id: v.string(), postId: v.string(), kind: v.literal('post'), author: authorValidator, text: v.string(), media: v.union(postMediaValidator, v.null()), hasSpoiler: v.boolean(), visibility: visibilityValidator, createdAt: v.number(), updatedAt: v.number() }),
  v.object({ id: v.string(), reviewId: v.string(), kind: v.literal('review'), author: authorValidator, anime: animeValidator, rating: v.number(), summary: v.string(), containsSpoiler: v.boolean(), visibility: visibilityValidator, publishedAt: v.number(), updatedAt: v.number() }),
  v.object({ id: v.string(), kind: v.literal('completed'), author: authorValidator, anime: activityAnimeValidator, settledAt: v.number(), visibility: visibilityValidator }),
  v.object({ id: v.string(), kind: v.literal('rewatched'), author: authorValidator, anime: activityAnimeValidator, settledAt: v.number(), visibility: visibilityValidator }),
)
const feedPageValidator = v.object({ items: v.array(feedCardValidator), cursor: v.union(v.string(), v.null()), hasMore: v.boolean() })
const fail = (code: string, message: string): never => { throw new ConvexError({ code, message }) }
type WithCatalogEntityId<T> = T extends { anime: infer Anime extends { publicId: string } }
  ? Omit<T, 'anime'> & { anime: Omit<Anime, 'publicId'> & { publicId: Id<'catalogEntities'> } }
  : T
type FeedCard = WithCatalogEntityId<SocialFeedCard>

const getAuthor = async (ctx: QueryCtx, userId: Id<'users'>) => {
  const author = await ctx.db.get('users', userId)
  if (!author) return fail('FEED_AUTHOR_MISSING', 'Feed author profile is missing.')
  return { id: author._id, username: author.username, displayName: author.name, avatarUrl: author.avatarStorageId ? await ctx.storage.getUrl(author.avatarStorageId) : null }
}

const resolveAnimeProviderId = async (
  ctx: QueryCtx | MutationCtx,
  animeId: Id<'catalogEntities'>,
  anilistId: number,
  label: string,
): Promise<number> => {
  const providerRef = await resolveProviderByCatalogPublicId(ctx, animeId, 'anime')
  if (providerRef.providerId !== anilistId) {
    return fail('CATALOG_PROVIDER_REF_CONFLICT', `${label} conflicts with its Anime provider reference.`)
  }
  return providerRef.providerId
}

const getAnime = async (ctx: QueryCtx, animeId: Id<'catalogEntities'>, anilistId: number) => {
  const providerId = await resolveAnimeProviderId(ctx, animeId, anilistId, 'Feed Review')
  const anime = await ctx.db.query('animeSummaries').withIndex('by_anilist_id', (q) => q.eq('anilistId', providerId)).unique()
  if (!anime) return fail('FEED_ANIME_MISSING', 'Feed anime summary is missing.')
  return { publicId: animeId, slug: anime.slug, title: anime.titles.display, coverImageUrl: anime.coverImageUrl }
}

type FeedRead = { mode: 'direct' | 'owner'; viewerId: Id<'users'> | null } | { mode: 'public' }
type ProfileFeedCursor = {
  lane: 'activity'
  usernameKey: string
  viewerId: string
  anchor: string
}

/** Identifies milestone projections. */
const isMilestoneCard = (card: Doc<'feedCards'>): boolean => card.kind === 'completed' || card.kind === 'rewatched'

/** Applies lane-specific source visibility. */
const canReadSource = (visibility: Doc<'feedCards'>['visibility'], ownerId: Id<'users'>, read: FeedRead): boolean => {
  if (read.mode === 'public') return visibility === 'public'
  return canReadSocialRecord(visibility, read.viewerId, ownerId)
}

const getActivityAnime = async (ctx: QueryCtx, animeId: Id<'catalogEntities'>, anilistId: number) => {
  const providerId = await resolveAnimeProviderId(ctx, animeId, anilistId, 'Anime milestone')
  const anime = await ctx.db.query('animeSummaries').withIndex('by_anilist_id', (q) => q.eq('anilistId', providerId)).unique()
  if (!anime) return fail('FEED_ANIME_MISSING', 'Feed anime summary is missing.')
  return {
    publicId: animeId, slug: anime.slug, title: anime.titles.display, coverImageUrl: anime.coverImageUrl,
    seasonYear: anime.seasonYear, format: anime.format,
  }
}

/** Applies lane-specific source visibility. */
const canReadMilestone = (milestone: Doc<'animeMilestones'>, read: FeedRead): boolean => {
  if (read.mode === 'public') return milestone.visibility === 'public'
  return canReadSocialRecord(milestone.visibility, read.viewerId, milestone.userId)
}

const matchesPostProjection = (card: Doc<'feedCards'>, post: Doc<'posts'>): boolean => [
  card.sourceKey === `post:${post._id}`,
  card.sourceId === post._id,
  card.userId === post.userId,
  card.visibility === post.visibility,
].every(Boolean)

const resolvePostCard = async (ctx: QueryCtx, card: Doc<'feedCards'>, read: FeedRead): Promise<FeedCard | null> => {
  const postId = card.sourceId ? ctx.db.normalizeId('posts', card.sourceId) : null
  const post = postId ? await ctx.db.get('posts', postId) : null
  if (!post || !matchesPostProjection(card, post)) return null
  if (!canReadSource(post.visibility, post.userId, read)) return null
  return { id: card._id, postId: post._id, kind: 'post', author: await getAuthor(ctx, post.userId), text: post.text, media: post.media, hasSpoiler: post.hasSpoiler, visibility: post.visibility, createdAt: post.createdAt, updatedAt: post.updatedAt }
}

type ActiveReviewSource = {
  publishedAt: number
  rating: number
  review: Doc<'reviews'>
}

/** Narrows one Review source to a feed-visible lifecycle. */
const getActiveReviewSource = (review: Doc<'reviews'>): ActiveReviewSource | null => {
  if (review.state !== 'published') return null
  if (review.activityState !== 'active') return null
  if (review.rating === null) return null
  if (review.publishedAt === undefined) return null
  return { publishedAt: review.publishedAt, rating: review.rating, review }
}

/** Rejects stale or corrupt Review projections before access checks. */
const matchesReviewProjection = (card: Doc<'feedCards'>, review: Doc<'reviews'>): boolean => [
  card.sourceKey === `review:${review._id}`,
  card.sourceId === review._id,
  card.userId === review.userId,
  card.anilistId === review.anilistId,
  card.animeId === review.animeId,
  card.visibility === review.visibility,
].every(Boolean)

const resolveReviewCard = async (ctx: QueryCtx, card: Doc<'feedCards'>, read: FeedRead): Promise<FeedCard | null> => {
  const reviewId = card.sourceId ? ctx.db.normalizeId('reviews', card.sourceId) : null
  const review = reviewId ? await ctx.db.get('reviews', reviewId) : null
  if (!review) return null
  const source = getActiveReviewSource(review)
  if (!source || !matchesReviewProjection(card, source.review)) return null
  if (!canReadSource(source.review.visibility, source.review.userId, read)) return null
  if (!source.review.animeId) return fail('CATALOG_PROVIDER_REF_MISSING', `Feed Review ${source.review._id} is missing its Anime entity.`)
  return { id: card._id, reviewId: source.review._id, kind: 'review', author: await getAuthor(ctx, source.review.userId), anime: await getAnime(ctx, source.review.animeId, source.review.anilistId), rating: source.rating, summary: source.review.summary, containsSpoiler: source.review.containsSpoiler, visibility: source.review.visibility, publishedAt: source.publishedAt, updatedAt: source.review.updatedAt }
}

type MilestoneFeedCard = Doc<'feedCards'> & {
  animeId: Id<'catalogEntities'>
  anilistId: number
  kind: 'completed' | 'rewatched'
}

/** Requires one feed card to contain its durable milestone identity. */
const requireMilestoneFeedCard = (card: Doc<'feedCards'>): MilestoneFeedCard => {
  if (card.anilistId === undefined || (card.kind !== 'completed' && card.kind !== 'rewatched')) {
    return fail('FEED_SOURCE_MISSING', 'Feed milestone source is missing.')
  }
  if (!card.animeId) {
    return fail('CATALOG_PROVIDER_REF_MISSING', `Milestone feed card ${card._id} is missing its Anime entity.`)
  }
  return card as MilestoneFeedCard
}

/** Requires milestone and projection provider identities to agree. */
const requireMilestoneAnimeId = (
  card: MilestoneFeedCard,
  milestone: Doc<'animeMilestones'>,
): Id<'catalogEntities'> => {
  if (!milestone.animeId) {
    return fail('CATALOG_PROVIDER_REF_MISSING', `Anime milestone ${milestone._id} is missing its Anime entity.`)
  }
  if (card.anilistId !== milestone.anilistId) {
    return fail('CATALOG_PROVIDER_REF_CONFLICT', `Milestone feed card ${card._id} conflicts with milestone ${milestone._id}.`)
  }
  return milestone.animeId
}

const resolveMilestoneCard = async (ctx: QueryCtx, card: Doc<'feedCards'>, read: FeedRead): Promise<FeedCard | null> => {
  const source = requireMilestoneFeedCard(card)
  const entityKey = `${source.kind}:${source.userId}:${source.animeId}`
  if (source.sourceKey !== entityKey) return null
  const milestone = await ctx.db.query('animeMilestones')
    .withIndex('by_user_anime_entity_kind', (q) => q.eq('userId', source.userId).eq('animeId', source.animeId).eq('kind', source.kind))
    .unique()
  if (!milestone || source.visibility !== milestone.visibility || !canReadMilestone(milestone, read)) return null
  const animeId = requireMilestoneAnimeId(source, milestone)
  return { id: source._id, kind: milestone.kind, author: await getAuthor(ctx, milestone.userId), anime: await getActivityAnime(ctx, animeId, milestone.anilistId), settledAt: milestone.occurredAt, visibility: milestone.visibility }
}

const resolveCard = async (ctx: QueryCtx, card: Doc<'feedCards'>, read: FeedRead): Promise<FeedCard | null> => {
  if (isMilestoneCard(card)) return await resolveMilestoneCard(ctx, card, read)
  if (card.kind === 'post') return await resolvePostCard(ctx, card, read)
  return await resolveReviewCard(ctx, card, read)
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

const encodeProfileFeedCursor = (cursor: ProfileFeedCursor): string => btoa(JSON.stringify(cursor))

const invalidProfileFeedCursor = (message: string): never => {
  throw new TypeError(`Invalid Profile Activity cursor: ${message}`)
}

/** Decodes one Profile Activity cursor envelope. */
const parseProfileFeedCursor = (cursor: string): Partial<ProfileFeedCursor> => {
  let value: unknown
  try {
    value = JSON.parse(atob(cursor)) as unknown
  } catch (error) {
    return invalidProfileFeedCursor(error instanceof Error ? error.message : 'unknown error')
  }
  if (!value || typeof value !== 'object') return invalidProfileFeedCursor('Cursor state is invalid.')
  return value as Partial<ProfileFeedCursor>
}

const decodeProfileFeedCursor = (
  cursor: string | null,
  usernameKey: string,
  viewerId: Id<'users'>,
): string | null => {
  if (cursor === null) return null
  const value = parseProfileFeedCursor(cursor)
  if (value.lane !== 'activity') throw new TypeError('Profile Activity cursor belongs to another lane.')
  if (value.usernameKey !== usernameKey) throw new TypeError('Profile Activity cursor belongs to another profile.')
  if (value.viewerId !== viewerId) throw new TypeError('Profile Activity cursor belongs to another viewer.')
  if (typeof value.anchor !== 'string') return invalidProfileFeedCursor('Profile Activity cursor anchor is invalid.')
  return value.anchor
}

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
const resolveFeedPage = async (ctx: QueryCtx, page: HomeGlobalPage, read: FeedRead): Promise<ResolvedFeedPage> => {
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

/** Reads enough indexed source-backed cards to fill one Profile Activity page. */
const listProfilePage = async (
  ctx: QueryCtx,
  userId: Id<'users'>,
  viewerId: Id<'users'>,
  anchor: string | null,
) => {
  const raw = await readOwn(ctx, userId, anchor)
  const page = await resolveFeedPage(
    ctx,
    createRawPage(raw, anchor),
    { mode: 'direct', viewerId },
  )
  const items = page.items.slice(0, FEED_PAGE_SIZE)
  if (page.terminal) return { items, anchor: null }
  if (page.items.length > FEED_PAGE_SIZE) {
    return {
      items,
      anchor: page.resumeAnchors[FEED_PAGE_SIZE] ?? page.scannedAnchor,
    }
  }
  return {
    items,
    anchor: page.scannedAnchor,
  }
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
    resolveFeedPage(ctx, createRawPage(own, anchors.prioritizedAnchor), { mode: 'owner', viewerId }),
    resolveFeedPage(ctx, global, { mode: 'public' }),
  ])
  const merged = mergeFeedCards(ownPage.items, globalPage.items, FEED_PAGE_SIZE, anchors.cycleIndex)
  const prioritizedAnchor = getPageAnchor(ownPage, merged.prioritizedConsumed, anchors.prioritizedAnchor)
  const globalAnchor = getPageAnchor(globalPage, merged.globalConsumed, anchors.globalAnchor)
  const hasMore = hasHomeItems(ownPage, merged.prioritizedConsumed, globalPage, merged.globalConsumed)
  return { items: merged.items as FeedCard[], cursor: hasMore ? encodeFeedCursor({ view: 'home', viewerId, prioritizedAnchor, globalAnchor, cycleIndex: merged.nextCycleIndex }) : null, hasMore }
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

/** Lists newest accessible source-backed Activity for one profile. */
export const listForProfile = query({
  args: { username: v.string(), cursor: v.union(v.string(), v.null()) },
  returns: feedPageValidator,
  handler: async (ctx, args) => {
    const access = await resolveProfileAccess(ctx, args.username)
    if (access.access === 'header') return fail('PROFILE_PRIVATE', 'Profile content is private.')
    const anchor = decodeProfileFeedCursor(
      args.cursor,
      access.usernameKey,
      access.viewerId,
    )
    const page = await listProfilePage(
      ctx,
      access.targetId,
      access.viewerId,
      anchor,
    )
    return {
      items: page.items,
      cursor: page.anchor === null
        ? null
        : encodeProfileFeedCursor({
            lane: 'activity',
            usernameKey: access.usernameKey,
            viewerId: access.viewerId,
            anchor: page.anchor,
          }),
      hasMore: page.anchor !== null,
    }
  },
})

/** Resolves a card using authoritative direct-read access. */
const resolveDirectCard = async (ctx: QueryCtx, card: Doc<'feedCards'>, viewerId: Id<'users'> | null): Promise<FeedCard | null> => {
  if (isMilestoneCard(card)) return await resolveMilestoneCard(ctx, card, { mode: 'direct', viewerId })
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

/** Reads entity-key projection while rejecting any legacy-key drift. */
const readMilestoneProjectionCard = async (
  ctx: MutationCtx,
  userId: Id<'users'>,
  anilistId: number,
  animeId: Id<'catalogEntities'>,
  kind: 'completed' | 'rewatched',
) => {
  const sourceKey = `${kind}:${userId}:${animeId}`
  const legacyKey = `${kind}:${userId}:${anilistId}`
  const [card, legacyCard] = await Promise.all([
    ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', sourceKey)).unique(),
    ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', legacyKey)).unique(),
  ])
  if (legacyCard) {
    return fail(
      'MILESTONE_SOURCE_CONFLICT',
      `Milestone projection ${sourceKey} conflicts with legacy feed card ${legacyCard._id}.`,
    )
  }
  return { sourceKey, card }
}

export const upsertMilestoneCard = async (ctx: MutationCtx, milestone: Doc<'animeMilestones'>, activate: boolean): Promise<void> => {
  if (!milestone.animeId) return fail('CATALOG_PROVIDER_REF_MISSING', `Anime milestone ${milestone._id} is missing its Anime entity.`)
  await resolveAnimeProviderId(ctx, milestone.animeId, milestone.anilistId, `Anime milestone ${milestone._id}`)
  const { sourceKey, card: existing } = await readMilestoneProjectionCard(
    ctx,
    milestone.userId,
    milestone.anilistId,
    milestone.animeId,
    milestone.kind,
  )
  if (existing && (!existing.animeId || existing.animeId !== milestone.animeId || existing.anilistId !== milestone.anilistId)) {
    return fail('CATALOG_PROVIDER_REF_CONFLICT', `Milestone feed card ${existing._id} conflicts with milestone ${milestone._id}.`)
  }
  const orderKey = existing && existing.occurredAt === milestone.occurredAt
    ? existing.orderKey
    : makeOrderKey(milestone.occurredAt, sourceKey)
  const fields = { visibility: milestone.visibility, active: activate || !existing ? true : existing.active, orderKey, occurredAt: milestone.occurredAt, updatedAt: milestone.updatedAt }
  if (existing) await ctx.db.patch('feedCards', existing._id, fields)
  else await ctx.db.insert('feedCards', { sourceKey, kind: milestone.kind, userId: milestone.userId, anilistId: milestone.anilistId, animeId: milestone.animeId, ...fields })
}

export const removeMilestoneCard = async (
  ctx: MutationCtx,
  userId: Id<'users'>,
  animeId: Id<'catalogEntities'>,
  anilistId: number,
  kind: 'completed' | 'rewatched',
): Promise<void> => {
  await resolveAnimeProviderId(ctx, animeId, anilistId, 'Anime milestone')
  const { card } = await readMilestoneProjectionCard(ctx, userId, anilistId, animeId, kind)
  if (card && (!card.animeId || card.animeId !== animeId || card.anilistId !== anilistId)) {
    return fail('CATALOG_PROVIDER_REF_CONFLICT', `Milestone feed card ${card._id} conflicts with provider mapping ${animeId}.`)
  }
  if (card) await ctx.db.patch('feedCards', card._id, { active: false, updatedAt: Date.now() })
}

const readOwnedMilestoneCard = async (ctx: MutationCtx, cardId: Id<'feedCards'>, userId: Id<'users'>) => {
  const card = await ctx.db.get('feedCards', cardId)
  if (!card || (card.kind !== 'completed' && card.kind !== 'rewatched')) return fail('ACTIVITY_NOT_FOUND', 'Milestone activity not found.')
  if (card.userId !== userId) return fail('ACTIVITY_FORBIDDEN', 'Only the activity owner can change it.')
  return card
}

/** Reads one durable milestone/card pair before domain updates. */
const requireMilestoneCardSource = async (ctx: MutationCtx, card: Doc<'feedCards'>) => {
  if (card.anilistId === undefined) return fail('ACTIVITY_SOURCE_MISSING', 'Milestone activity source is missing.')
  if (!card.animeId) return fail('CATALOG_PROVIDER_REF_MISSING', `Milestone feed card ${card._id} is missing its Anime entity.`)
  await resolveAnimeProviderId(ctx, card.animeId, card.anilistId, `Milestone feed card ${card._id}`)
  const milestone = await ctx.db.query('animeMilestones')
    .withIndex('by_user_anime_entity_kind', (q) => q.eq('userId', card.userId).eq('animeId', card.animeId).eq('kind', card.kind as 'completed' | 'rewatched'))
    .unique()
  if (!milestone) return fail('ACTIVITY_SOURCE_MISSING', 'Milestone activity source is missing.')
  if (!milestone.animeId) return fail('CATALOG_PROVIDER_REF_MISSING', `Anime milestone ${milestone._id} is missing its Anime entity.`)
  if (milestone.anilistId !== card.anilistId) return fail('CATALOG_PROVIDER_REF_CONFLICT', `Anime milestone ${milestone._id} conflicts with feed card ${card._id}.`)
  return { milestone, card }
}

export const setActivityVisibility = mutation({
  args: { cardId: v.id('feedCards'), visibility: visibilityValidator }, returns: v.null(),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    const card = await readOwnedMilestoneCard(ctx, args.cardId, profile._id)
    const { milestone } = await requireMilestoneCardSource(ctx, card)
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
    await requireMilestoneCardSource(ctx, card)
    await ctx.db.patch('feedCards', card._id, { active: false, updatedAt: Date.now() })
    return null
  },
})

/** Checks projection fields against milestone truth. */
const matchesMilestoneProjection = (card: Doc<'feedCards'> | null, milestone: Doc<'animeMilestones'>, sourceKey: string): boolean => {
  if (!card) return false
  const fields = [
    [card.kind, milestone.kind], [card.userId, milestone.userId], [card.anilistId, milestone.anilistId], [card.animeId, milestone.animeId],
    [card.visibility, milestone.visibility], [card.occurredAt, milestone.occurredAt], [card.updatedAt, milestone.updatedAt],
    [card.sourceKey, sourceKey],
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
      if (!milestone.animeId) return fail('CATALOG_PROVIDER_REF_MISSING', `Anime milestone ${milestone._id} is missing its Anime entity.`)
      await resolveAnimeProviderId(ctx, milestone.animeId, milestone.anilistId, `Anime milestone ${milestone._id}`)
      await upsertMilestoneCard(ctx, milestone, false)
      const { sourceKey, card } = await readMilestoneProjectionCard(
        ctx,
        milestone.userId,
        milestone.anilistId,
        milestone.animeId,
        milestone.kind,
      )
      if (!matchesMilestoneProjection(card, milestone, sourceKey)) return fail('MILESTONE_PROJECTION_INVALID', `Milestone projection validation failed for ${sourceKey}.`)
      verifiedCount += 1
    }
    return { continueCursor: page.continueCursor, isDone: page.isDone, processedCount: page.page.length, verifiedCount }
  },
})
