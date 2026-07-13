import { paginationOptsValidator, paginationResultValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'

import { type Doc, type Id } from './_generated/dataModel'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { requireProfile } from './users'
import { applyFavorite, decideStatusChange, normalizeScore, rollbackRewatch, type AnimeStatus } from './userAnimePolicy'

const statusValidator = v.union(v.literal('watching'), v.literal('planned'), v.literal('dropped'), v.literal('completed'), v.literal('rewatched'))
const nullableStatusValidator = v.union(statusValidator, v.null())
const entryValidator = v.object({
  anilistId: v.number(), status: nullableStatusValidator, score: v.union(v.number(), v.null()), isFavorite: v.boolean(),
  favoriteChangedAt: v.union(v.number(), v.null()), rewatchCount: v.number(), createdAt: v.number(), updatedAt: v.number(),
})
const rewatchValidator = v.object({ id: v.string(), anilistId: v.number(), completedAt: v.number() })
type UserCtx = QueryCtx | MutationCtx
type Profile = Doc<'users'>

const toPublicEntry = (entry: Doc<'userAnimeEntries'>) => ({
  anilistId: entry.anilistId,
  status: entry.status,
  score: entry.score,
  isFavorite: entry.favoriteAt !== null,
  favoriteChangedAt: entry.favoriteAt,
  rewatchCount: entry.rewatchCount,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
})

const assertAnilistId = (anilistId: number): void => {
  if (!Number.isSafeInteger(anilistId) || anilistId <= 0) throw new ConvexError({ code: 'INVALID_ANILIST_ID', message: 'AniList ID must be a positive safe integer.' })
}

/** Requires the anime to exist in the normalized summary cache. */
const requireCachedAnime = async (ctx: UserCtx, anilistId: number): Promise<void> => {
  assertAnilistId(anilistId)
  const anime = await ctx.db.query('animeSummaries').withIndex('by_anilist_id', (q) => q.eq('anilistId', anilistId)).unique()
  if (!anime) throw new ConvexError({ code: 'ANIME_NOT_CACHED', message: 'Anime must be loaded before saving user state.' })
}

const readEntry = async (ctx: UserCtx, userId: Id<'users'>, anilistId: number) => await ctx.db
  .query('userAnimeEntries').withIndex('by_user_anime', (q) => q.eq('userId', userId).eq('anilistId', anilistId)).unique()

const getOrCreateEntry = async (ctx: MutationCtx, userId: Id<'users'>, anilistId: number, now: number): Promise<Doc<'userAnimeEntries'>> => {
  const current = await readEntry(ctx, userId, anilistId)
  if (current) return current
  const id = await ctx.db.insert('userAnimeEntries', { userId, anilistId, status: null, score: null, favoriteAt: null, rewatchCount: 0, createdAt: now, updatedAt: now })
  const created = await ctx.db.get('userAnimeEntries', id)
  if (!created) throw new ConvexError({ code: 'ENTRY_CREATE_FAILED', message: 'User anime entry was not created.' })
  return created
}

const readMilestone = async (ctx: UserCtx, userId: Id<'users'>, anilistId: number, kind: 'completed' | 'rewatched') => await ctx.db
  .query('animeMilestones').withIndex('by_user_anime_kind', (q) => q.eq('userId', userId).eq('anilistId', anilistId).eq('kind', kind)).unique()

/** Creates a milestone once, copying current profile visibility only at creation. */
const createMilestoneOnce = async (ctx: MutationCtx, profile: Profile, anilistId: number, kind: 'completed' | 'rewatched', now: number) => {
  const existing = await readMilestone(ctx, profile._id, anilistId, kind)
  if (existing) return existing
  const id = await ctx.db.insert('animeMilestones', { userId: profile._id, anilistId, kind, visibility: profile.visibility, occurredAt: now, updatedAt: now })
  return await ctx.db.get('animeMilestones', id)
}

/** Records one rewatch and creates or bumps its single milestone. */
const addRewatch = async (ctx: MutationCtx, profile: Profile, entry: Doc<'userAnimeEntries'>, now: number): Promise<void> => {
  await ctx.db.insert('animeRewatchEntries', { entryId: entry._id, userId: profile._id, anilistId: entry.anilistId, completedAt: now })
  const milestone = await readMilestone(ctx, profile._id, entry.anilistId, 'rewatched')
  if (milestone) await ctx.db.patch(milestone._id, { occurredAt: now, updatedAt: now })
  else await createMilestoneOnce(ctx, profile, entry.anilistId, 'rewatched', now)
  await ctx.db.patch(entry._id, { rewatchCount: entry.rewatchCount + 1, updatedAt: now })
}

/** Returns the authenticated user's state for one cached anime. */
export const getMine = query({
  args: { anilistId: v.number() }, returns: v.union(entryValidator, v.null()),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx); await requireCachedAnime(ctx, args.anilistId)
    const entry = await readEntry(ctx, profile._id, args.anilistId)
    return entry ? toPublicEntry(entry) : null
  },
})

/** Lists only the authenticated owner's rewatch history, fixed at 20 per page. */
export const listMyRewatches = query({
  args: { anilistId: v.number(), paginationOpts: paginationOptsValidator }, returns: paginationResultValidator(rewatchValidator),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx); await requireCachedAnime(ctx, args.anilistId)
    if (args.paginationOpts.numItems !== 20) throw new ConvexError({ code: 'INVALID_PAGE_SIZE', message: 'Rewatch history page size must be 20.' })
    const result = await ctx.db.query('animeRewatchEntries').withIndex('by_user_anime_completed_at', (q) => q.eq('userId', profile._id).eq('anilistId', args.anilistId)).order('desc').paginate(args.paginationOpts)
    return { ...result, page: result.page.map((item) => ({ id: item._id, anilistId: item.anilistId, completedAt: item.completedAt })) }
  },
})

/** Sets status and applies settled completion/rewatch rules. */
export const setStatus = mutation({
  args: { anilistId: v.number(), status: statusValidator }, returns: entryValidator,
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx); await requireCachedAnime(ctx, args.anilistId); const now = Date.now()
    const entry = await getOrCreateEntry(ctx, profile._id, args.anilistId, now)
    const completion = await readMilestone(ctx, profile._id, args.anilistId, 'completed')
    const effects = decideStatusChange(entry.status as AnimeStatus | null, args.status, Boolean(completion))
    if (effects.createCompletion) await createMilestoneOnce(ctx, profile, args.anilistId, 'completed', now)
    if (effects.recordRewatch) await addRewatch(ctx, profile, entry, now)
    await ctx.db.patch(entry._id, { status: args.status, updatedAt: now })
    const saved = await ctx.db.get('userAnimeEntries', entry._id)
    if (!saved) throw new ConvexError({ code: 'ENTRY_NOT_FOUND', message: 'User anime entry no longer exists.' })
    return toPublicEntry(saved)
  },
})

/** Saves or clears a validated score without creating milestones. */
export const setScore = mutation({
  args: { anilistId: v.number(), score: v.union(v.number(), v.null()) }, returns: entryValidator,
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx); await requireCachedAnime(ctx, args.anilistId); const now = Date.now(); let score
    try { score = normalizeScore(args.score) } catch (error) { throw new ConvexError({ code: 'INVALID_SCORE', message: error instanceof Error ? error.message : 'Score is invalid.' }) }
    const entry = await getOrCreateEntry(ctx, profile._id, args.anilistId, now); await ctx.db.patch(entry._id, { score, updatedAt: now })
    const saved = await ctx.db.get('userAnimeEntries', entry._id); if (!saved) throw new ConvexError({ code: 'ENTRY_NOT_FOUND', message: 'User anime entry no longer exists.' }); return toPublicEntry(saved)
  },
})

/** Sets explicit favorite state with idempotent timestamps. */
export const setFavorite = mutation({
  args: { anilistId: v.number(), isFavorite: v.boolean() }, returns: entryValidator,
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx); await requireCachedAnime(ctx, args.anilistId); const now = Date.now(); const entry = await getOrCreateEntry(ctx, profile._id, args.anilistId, now)
    await ctx.db.patch(entry._id, { favoriteAt: applyFavorite(entry.favoriteAt, args.isFavorite, now), updatedAt: now })
    const saved = await ctx.db.get('userAnimeEntries', entry._id); if (!saved) throw new ConvexError({ code: 'ENTRY_NOT_FOUND', message: 'User anime entry no longer exists.' }); return toPublicEntry(saved)
  },
})

/** Explicitly records another completed rewatch. */
export const recordRewatch = mutation({
  args: { anilistId: v.number() }, returns: entryValidator,
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx); await requireCachedAnime(ctx, args.anilistId); const now = Date.now(); const entry = await getOrCreateEntry(ctx, profile._id, args.anilistId, now)
    await addRewatch(ctx, profile, entry, now); await ctx.db.patch(entry._id, { status: 'rewatched', updatedAt: now })
    const saved = await ctx.db.get('userAnimeEntries', entry._id); if (!saved) throw new ConvexError({ code: 'ENTRY_NOT_FOUND', message: 'User anime entry no longer exists.' }); return toPublicEntry(saved)
  },
})

/** Removes the latest owned rewatch and rolls milestone/status state back. */
export const removeLatestRewatch = mutation({
  args: { anilistId: v.number() }, returns: entryValidator,
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx); await requireCachedAnime(ctx, args.anilistId); const entry = await readEntry(ctx, profile._id, args.anilistId)
    if (!entry) throw new ConvexError({ code: 'REWATCH_NOT_FOUND', message: 'No rewatch exists to remove.' })
    const history = await ctx.db.query('animeRewatchEntries').withIndex('by_user_anime_completed_at', (q) => q.eq('userId', profile._id).eq('anilistId', args.anilistId)).order('desc').take(2)
    if (!history[0]) throw new ConvexError({ code: 'REWATCH_NOT_FOUND', message: 'No rewatch exists to remove.' })
    const now = Date.now(); const rollback = rollbackRewatch(history.map((item) => item.completedAt), entry.status as AnimeStatus | null); await ctx.db.delete(history[0]._id)
    const milestone = await readMilestone(ctx, profile._id, args.anilistId, 'rewatched')
    if (milestone && rollback.milestoneAt === null) await ctx.db.delete(milestone._id)
    else if (milestone && rollback.milestoneAt !== null) await ctx.db.patch(milestone._id, { occurredAt: rollback.milestoneAt, updatedAt: now })
    await ctx.db.patch(entry._id, { rewatchCount: Math.max(0, entry.rewatchCount - 1), status: rollback.nextStatus, updatedAt: now })
    const saved = await ctx.db.get('userAnimeEntries', entry._id); if (!saved) throw new ConvexError({ code: 'ENTRY_NOT_FOUND', message: 'User anime entry no longer exists.' }); return toPublicEntry(saved)
  },
})
