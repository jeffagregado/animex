import { ConvexError, v } from 'convex/values'

import { type Doc, type Id } from './_generated/dataModel'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { removeMilestoneCard, upsertMilestoneCard } from './feed'
import { requireProfile } from './users'
import {
  applyFavorite,
  createMilestoneInsert,
  createMilestoneTimestampPatch,
  decideStatusChange,
  normalizeScore,
  rollbackRewatch,
  toSavedResult,
  type AnimeStatus,
} from './userAnimePolicy'

const statusValidator = v.union(v.literal('watching'), v.literal('planned'), v.literal('dropped'), v.literal('completed'), v.literal('rewatched'))
const nullableStatusValidator = v.union(statusValidator, v.null())
const entryValidator = v.object({
  anilistId: v.number(), status: nullableStatusValidator, score: v.union(v.number(), v.null()), isFavorite: v.boolean(),
  favoriteChangedAt: v.union(v.number(), v.null()), rewatchCount: v.number(), createdAt: v.number(), updatedAt: v.number(),
})
const rewatchValidator = v.object({ id: v.string(), anilistId: v.number(), completedAt: v.number() })
const rewatchPaginationValidator = v.object({ numItems: v.literal(20), cursor: v.union(v.string(), v.null()) })
const savedResultValidator = v.object({ status: v.literal('saved'), entry: entryValidator })
const rewatchPageValidator = v.object({
  items: v.array(rewatchValidator), continueCursor: v.string(), isDone: v.boolean(), perPage: v.literal(20),
})
type UserCtx = QueryCtx | MutationCtx
type Profile = Doc<'users'>

export const toPublicEntry = (entry: Doc<'userAnimeEntries'>) => ({
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
export const requireCachedAnimeWith = async (
  anilistId: number,
  findAnime: (id: number) => Promise<unknown | null>,
): Promise<void> => {
  assertAnilistId(anilistId)
  const anime = await findAnime(anilistId)
  if (!anime) throw new ConvexError({ code: 'ANIME_NOT_CACHED', message: 'Anime must be loaded before saving user state.' })
}

const requireCachedAnime = async (ctx: UserCtx, anilistId: number): Promise<void> => await requireCachedAnimeWith(
  anilistId,
  async (id) => await ctx.db.query('animeSummaries').withIndex('by_anilist_id', (q) => q.eq('anilistId', id)).unique(),
)

const readEntry = async (ctx: UserCtx, userId: Id<'users'>, anilistId: number) => await ctx.db
  .query('userAnimeEntries').withIndex('by_user_anime', (q) => q.eq('userId', userId).eq('anilistId', anilistId)).unique()

const getOrCreateEntry = async (ctx: MutationCtx, userId: Id<'users'>, anilistId: number, now: number): Promise<Doc<'userAnimeEntries'>> => {
  const current = await readEntry(ctx, userId, anilistId)
  if (current) return current
  const id = await ctx.db.insert('userAnimeEntries', { userId, anilistId, status: null, score: null, favoriteAt: null, rewatchCount: 0, lastRewatchSequence: 0, createdAt: now, updatedAt: now })
  const created = await ctx.db.get('userAnimeEntries', id)
  if (!created) throw new ConvexError({ code: 'ENTRY_CREATE_FAILED', message: 'User anime entry was not created.' })
  return created
}

const readMilestone = async (ctx: UserCtx, userId: Id<'users'>, anilistId: number, kind: 'completed' | 'rewatched') => await ctx.db
  .query('animeMilestones').withIndex('by_user_anime_kind', (q) => q.eq('userId', userId).eq('anilistId', anilistId).eq('kind', kind)).unique()

/** Creates a milestone once, copying current profile visibility only at creation. */
const createMilestoneOnce = async (ctx: MutationCtx, profile: Profile, anilistId: number, kind: 'completed' | 'rewatched', now: number) => {
  const existing = await readMilestone(ctx, profile._id, anilistId, kind)
  if (existing) { await upsertMilestoneCard(ctx, existing, false); return existing }
  const id = await ctx.db.insert('animeMilestones', createMilestoneInsert(profile._id, anilistId, kind, profile.visibility, now))
  const milestone = await ctx.db.get('animeMilestones', id)
  if (milestone) await upsertMilestoneCard(ctx, milestone, true)
  return milestone
}

/** Records one rewatch and creates or bumps its single milestone. */
const addRewatch = async (ctx: MutationCtx, profile: Profile, entry: Doc<'userAnimeEntries'>, now: number): Promise<void> => {
  const sequence = entry.lastRewatchSequence + 1
  await ctx.db.insert('animeRewatchEntries', { entryId: entry._id, userId: profile._id, anilistId: entry.anilistId, completedAt: now, sequence })
  const milestone = await readMilestone(ctx, profile._id, entry.anilistId, 'rewatched')
  if (milestone) {
    await ctx.db.patch(milestone._id, createMilestoneTimestampPatch(now))
    const updated = await ctx.db.get('animeMilestones', milestone._id)
    if (updated) await upsertMilestoneCard(ctx, updated, true)
  } else await createMilestoneOnce(ctx, profile, entry.anilistId, 'rewatched', now)
  await ctx.db.patch(entry._id, { rewatchCount: entry.rewatchCount + 1, lastRewatchSequence: sequence, updatedAt: now })
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
  args: { anilistId: v.number(), paginationOpts: rewatchPaginationValidator }, returns: rewatchPageValidator,
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx); await requireCachedAnime(ctx, args.anilistId)
    let anchor: Doc<'animeRewatchEntries'> | null = null
    if (args.paginationOpts.cursor !== null) {
      const cursorId = ctx.db.normalizeId('animeRewatchEntries', args.paginationOpts.cursor)
      if (!cursorId) throw new ConvexError({ code: 'INVALID_CURSOR', message: 'Rewatch history cursor is invalid.' })
      anchor = await ctx.db.get('animeRewatchEntries', cursorId)
      if (!anchor || anchor.userId !== profile._id || anchor.anilistId !== args.anilistId) {
        throw new ConvexError({ code: 'INVALID_CURSOR', message: 'Rewatch history cursor is invalid for this owner and anime.' })
      }
    }
    const records = await ctx.db.query('animeRewatchEntries').withIndex('by_user_anime_sequence', (q) => {
      const ownerAnime = q.eq('userId', profile._id).eq('anilistId', args.anilistId)
      return anchor ? ownerAnime.lt('sequence', anchor.sequence) : ownerAnime
    }).order('desc').take(21)
    const page = records.slice(0, 20)
    const isDone = records.length <= 20
    return {
      items: page.map((item) => ({ id: item._id, anilistId: item.anilistId, completedAt: item.completedAt })),
      continueCursor: isDone ? '' : page[19]._id,
      isDone,
      perPage: 20 as const,
    }
  },
})

/** Sets status and applies settled completion/rewatch rules. */
export const setStatus = mutation({
  args: { anilistId: v.number(), status: statusValidator }, returns: savedResultValidator,
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
    return toSavedResult(toPublicEntry(saved))
  },
})

/** Saves a validated score and starts watching only for an unset first score. */
export const setScore = mutation({
  args: { anilistId: v.number(), score: v.union(v.number(), v.null()) }, returns: savedResultValidator,
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx); await requireCachedAnime(ctx, args.anilistId); const now = Date.now(); let score
    try { score = normalizeScore(args.score) } catch (error) { throw new ConvexError({ code: 'INVALID_SCORE', message: error instanceof Error ? error.message : 'Score is invalid.' }) }
    const entry = await getOrCreateEntry(ctx, profile._id, args.anilistId, now)
    const status = entry.score === null && score !== null && entry.status === null ? 'watching' : entry.status
    await ctx.db.patch(entry._id, { score, status, updatedAt: now })
    const completion = await readMilestone(ctx, profile._id, args.anilistId, 'completed'); if (completion) await upsertMilestoneCard(ctx, completion, false)
    const saved = await ctx.db.get('userAnimeEntries', entry._id); if (!saved) throw new ConvexError({ code: 'ENTRY_NOT_FOUND', message: 'User anime entry no longer exists.' }); return toSavedResult(toPublicEntry(saved))
  },
})

/** Sets explicit favorite state with idempotent timestamps. */
export const setFavorite = mutation({
  args: { anilistId: v.number(), isFavorite: v.boolean() }, returns: savedResultValidator,
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx); await requireCachedAnime(ctx, args.anilistId); const now = Date.now(); const entry = await getOrCreateEntry(ctx, profile._id, args.anilistId, now)
    await ctx.db.patch(entry._id, { favoriteAt: applyFavorite(entry.favoriteAt, args.isFavorite, now), updatedAt: now })
    const saved = await ctx.db.get('userAnimeEntries', entry._id); if (!saved) throw new ConvexError({ code: 'ENTRY_NOT_FOUND', message: 'User anime entry no longer exists.' }); return toSavedResult(toPublicEntry(saved))
  },
})

/** Explicitly records another completed rewatch. */
export const recordRewatch = mutation({
  args: { anilistId: v.number() }, returns: savedResultValidator,
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx); await requireCachedAnime(ctx, args.anilistId); const now = Date.now(); const entry = await getOrCreateEntry(ctx, profile._id, args.anilistId, now)
    await addRewatch(ctx, profile, entry, now); await ctx.db.patch(entry._id, { status: 'rewatched', updatedAt: now })
    const saved = await ctx.db.get('userAnimeEntries', entry._id); if (!saved) throw new ConvexError({ code: 'ENTRY_NOT_FOUND', message: 'User anime entry no longer exists.' }); return toSavedResult(toPublicEntry(saved))
  },
})

/** Removes the latest owned rewatch and rolls milestone/status state back. */
export const removeLatestRewatch = mutation({
  args: { anilistId: v.number() }, returns: savedResultValidator,
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx); await requireCachedAnime(ctx, args.anilistId); const entry = await readEntry(ctx, profile._id, args.anilistId)
    if (!entry) throw new ConvexError({ code: 'REWATCH_NOT_FOUND', message: 'No rewatch exists to remove.' })
    const history = await ctx.db.query('animeRewatchEntries').withIndex('by_user_anime_sequence', (q) => q.eq('userId', profile._id).eq('anilistId', args.anilistId)).order('desc').take(2)
    if (!history[0]) throw new ConvexError({ code: 'REWATCH_NOT_FOUND', message: 'No rewatch exists to remove.' })
    const now = Date.now(); const rollback = rollbackRewatch(history.map((item) => item.completedAt), entry.status as AnimeStatus | null); await ctx.db.delete(history[0]._id)
    const milestone = await readMilestone(ctx, profile._id, args.anilistId, 'rewatched')
    if (milestone && rollback.milestoneAt === null) { await ctx.db.delete(milestone._id); await removeMilestoneCard(ctx, profile._id, args.anilistId, 'rewatched') }
    else if (milestone && rollback.milestoneAt !== null) {
      await ctx.db.patch(milestone._id, { ...createMilestoneTimestampPatch(now), occurredAt: rollback.milestoneAt })
      const updated = await ctx.db.get('animeMilestones', milestone._id); if (updated) await upsertMilestoneCard(ctx, updated, false)
    }
    await ctx.db.patch(entry._id, { rewatchCount: Math.max(0, entry.rewatchCount - 1), status: rollback.nextStatus, updatedAt: now })
    const saved = await ctx.db.get('userAnimeEntries', entry._id); if (!saved) throw new ConvexError({ code: 'ENTRY_NOT_FOUND', message: 'User anime entry no longer exists.' }); return toSavedResult(toPublicEntry(saved))
  },
})
