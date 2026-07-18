import { paginationOptsValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'

import { type Doc, type Id } from './_generated/dataModel'
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { resolveProviderRef } from './catalogIdentityModel'
import { removeMilestoneCard, upsertMilestoneCard } from './feed'
import { resolveProfileAccess } from './profiles'
import { requireProfile } from './users'
import {
  applyFavorite,
  applyProgressTransition,
  createMilestoneInsert,
  createMilestoneTimestampPatch,
  decideStatusChange,
  normalizeScore,
  rollbackRewatch,
  toSavedResult,
  type AnimeStatus,
  type UserAnimeProgress,
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
const progressValidator = v.object({ watching: v.number(), completed: v.number(), planned: v.number(), dropped: v.number() })
const rewatchPageValidator = v.object({
  items: v.array(rewatchValidator), continueCursor: v.string(), isDone: v.boolean(), perPage: v.literal(20),
})
const profileFavoriteValidator = v.object({
  favoriteAt: v.number(),
  anime: v.object({
    anilistId: v.number(),
    slug: v.string(),
    title: v.string(),
    coverImageUrl: v.union(v.string(), v.null()),
  }),
})
const profileFavoritePageValidator = v.object({
  items: v.array(profileFavoriteValidator),
  cursor: v.union(v.string(), v.null()),
  hasMore: v.boolean(),
})
type UserCtx = QueryCtx | MutationCtx
type Profile = Doc<'users'>
type ProfileFavoriteCursor = {
  lane: 'favorites'
  usernameKey: string
  viewerId: string
  cursor: string
}

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

const encodeProfileFavoriteCursor = (cursor: ProfileFavoriteCursor): string => btoa(JSON.stringify(cursor))

const invalidProfileFavoriteCursor = (message: string): never => {
  throw new TypeError(`Invalid Favorite cursor: ${message}`)
}

/** Decodes one Profile Favorite cursor envelope. */
const parseProfileFavoriteCursor = (cursor: string): Partial<ProfileFavoriteCursor> => {
  let value: unknown
  try {
    value = JSON.parse(atob(cursor)) as unknown
  } catch (error) {
    return invalidProfileFavoriteCursor(error instanceof Error ? error.message : 'unknown error')
  }
  if (!value || typeof value !== 'object') return invalidProfileFavoriteCursor('Cursor state is invalid.')
  return value as Partial<ProfileFavoriteCursor>
}

const decodeProfileFavoriteCursor = (
  cursor: string | null,
  usernameKey: string,
  viewerId: Id<'users'>,
): string | null => {
  if (cursor === null) return null
  const value = parseProfileFavoriteCursor(cursor)
  if (value.lane !== 'favorites') throw new TypeError('Favorite cursor belongs to another lane.')
  if (value.usernameKey !== usernameKey) throw new TypeError('Favorite cursor belongs to another profile.')
  if (value.viewerId !== viewerId) throw new TypeError('Favorite cursor belongs to another viewer.')
  if (typeof value.cursor !== 'string') return invalidProfileFavoriteCursor('Favorite cursor state is invalid.')
  return value.cursor
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

/** Resolves an existing Anime mapping without creating identity rows. */
const requireAnimeId = async (ctx: UserCtx, anilistId: number): Promise<Id<'catalogEntities'>> => {
  await requireCachedAnime(ctx, anilistId)
  const animeId = await resolveProviderRef(ctx, { provider: 'anilist', kind: 'anime', providerId: anilistId })
  if (!animeId) throw new ConvexError({ code: 'CATALOG_PROVIDER_REF_MISSING', message: `Anime provider mapping anilist:anime:${anilistId} is missing.` })
  return animeId
}

const readEntry = async (ctx: UserCtx, userId: Id<'users'>, anilistId: number) => await ctx.db
  .query('userAnimeEntries').withIndex('by_user_anime', (q) => q.eq('userId', userId).eq('anilistId', anilistId)).unique()

const readProgress = async (ctx: UserCtx, userId: Id<'users'>) => await ctx.db
  .query('userAnimeProgress').withIndex('by_user', (q) => q.eq('userId', userId)).unique()

const isEmptyProgress = (progress: UserAnimeProgress): boolean => progress.watching === 0
  && progress.completed === 0
  && progress.planned === 0
  && progress.dropped === 0

const progressMatches = (left: UserAnimeProgress, right: UserAnimeProgress): boolean => left.watching === right.watching
  && left.completed === right.completed
  && left.planned === right.planned
  && left.dropped === right.dropped

/** Recomputes List Progress from one user's indexed entries. */
const computeProgress = async (ctx: UserCtx, userId: Id<'users'>): Promise<UserAnimeProgress> => {
  const [watching, completed, planned, dropped] = await Promise.all([
    ctx.db.query('userAnimeEntries').withIndex('by_user_status', (q) => q.eq('userId', userId).eq('status', 'watching')).collect(),
    ctx.db.query('userAnimeEntries').withIndex('by_user_status', (q) => q.eq('userId', userId).eq('status', 'completed')).collect(),
    ctx.db.query('userAnimeEntries').withIndex('by_user_status', (q) => q.eq('userId', userId).eq('status', 'planned')).collect(),
    ctx.db.query('userAnimeEntries').withIndex('by_user_status', (q) => q.eq('userId', userId).eq('status', 'dropped')).collect(),
  ])
  return { watching: watching.length, completed: completed.length, planned: planned.length, dropped: dropped.length }
}

/** Replaces one aggregate with recomputed truth and removes zero-only rows. */
const replaceProgress = async (ctx: MutationCtx, userId: Id<'users'>, expected: UserAnimeProgress): Promise<boolean> => {
  const current = await readProgress(ctx, userId)
  if (isEmptyProgress(expected)) {
    if (!current) return false
    await ctx.db.delete('userAnimeProgress', current._id)
    return true
  }
  if (!current) {
    await ctx.db.insert('userAnimeProgress', { userId, ...expected })
    return true
  }
  if (progressMatches(current, expected)) return false
  await ctx.db.patch('userAnimeProgress', current._id, expected)
  return true
}

const transitionProgress = (
  previous: AnimeStatus | null,
  next: AnimeStatus | null,
  current: UserAnimeProgress,
): UserAnimeProgress => {
  try {
    return applyProgressTransition(previous, next, current)
  } catch (error) {
    throw new ConvexError({
      code: 'USER_ANIME_PROGRESS_DRIFT',
      message: error instanceof Error ? error.message : 'List Progress projection is inconsistent.',
    })
  }
}

/** Applies one status delta while keeping the aggregate sparse. */
const applyProgress = async (
  ctx: MutationCtx,
  userId: Id<'users'>,
  previous: AnimeStatus | null,
  next: AnimeStatus | null,
): Promise<void> => {
  const current = await readProgress(ctx, userId)
  const baseline = current ?? await computeProgress(ctx, userId)
  const updated = transitionProgress(previous, next, baseline)
  if (isEmptyProgress(updated)) {
    if (current) await ctx.db.delete('userAnimeProgress', current._id)
    return
  }
  if (current) await ctx.db.patch('userAnimeProgress', current._id, updated)
  else await ctx.db.insert('userAnimeProgress', { userId, ...updated })
}

const getOrCreateEntry = async (ctx: MutationCtx, userId: Id<'users'>, anilistId: number, animeId: Id<'catalogEntities'>, now: number): Promise<Doc<'userAnimeEntries'>> => {
  const current = await readEntry(ctx, userId, anilistId)
  if (current?.animeId && current.animeId !== animeId) throw new ConvexError({ code: 'CATALOG_PROVIDER_REF_CONFLICT', message: `User Anime entry ${current._id} conflicts with provider mapping ${animeId}.` })
  if (current) {
    if (!current.animeId) await ctx.db.patch(current._id, { animeId })
    return { ...current, animeId }
  }
  const id = await ctx.db.insert('userAnimeEntries', { userId, anilistId, animeId, status: null, score: null, favoriteAt: null, rewatchCount: 0, lastRewatchSequence: 0, createdAt: now, updatedAt: now })
  const created = await ctx.db.get('userAnimeEntries', id)
  if (!created) throw new ConvexError({ code: 'ENTRY_CREATE_FAILED', message: 'User anime entry was not created.' })
  return created
}

const readMilestone = async (ctx: UserCtx, userId: Id<'users'>, anilistId: number, kind: 'completed' | 'rewatched') => await ctx.db
  .query('animeMilestones').withIndex('by_user_anime_kind', (q) => q.eq('userId', userId).eq('anilistId', anilistId).eq('kind', kind)).unique()

/** Links one legacy milestone to its existing Anime entity. */
const linkMilestone = async (
  ctx: MutationCtx,
  milestone: Doc<'animeMilestones'>,
  animeId: Id<'catalogEntities'>,
): Promise<Doc<'animeMilestones'>> => {
  if (milestone.animeId && milestone.animeId !== animeId) throw new ConvexError({ code: 'CATALOG_PROVIDER_REF_CONFLICT', message: `Anime milestone ${milestone._id} conflicts with provider mapping ${animeId}.` })
  if (!milestone.animeId) await ctx.db.patch(milestone._id, { animeId })
  return { ...milestone, animeId }
}

/** Creates a milestone once, copying current profile visibility only at creation. */
const createMilestoneOnce = async (ctx: MutationCtx, profile: Profile, anilistId: number, animeId: Id<'catalogEntities'>, kind: 'completed' | 'rewatched', now: number) => {
  const existing = await readMilestone(ctx, profile._id, anilistId, kind)
  if (existing) {
    const current = await linkMilestone(ctx, existing, animeId)
    await upsertMilestoneCard(ctx, current, false)
    return current
  }
  const id = await ctx.db.insert('animeMilestones', { ...createMilestoneInsert(profile._id, anilistId, kind, profile.visibility, now), animeId })
  const milestone = await ctx.db.get('animeMilestones', id)
  if (milestone) await upsertMilestoneCard(ctx, milestone, true)
  return milestone
}

/** Records one rewatch and creates or bumps its single milestone. */
const addRewatch = async (ctx: MutationCtx, profile: Profile, entry: Doc<'userAnimeEntries'>, now: number): Promise<void> => {
  if (!entry.animeId) throw new ConvexError({ code: 'CATALOG_PROVIDER_REF_MISSING', message: `User Anime entry ${entry._id} is missing its Anime entity.` })
  const sequence = entry.lastRewatchSequence + 1
  await ctx.db.insert('animeRewatchEntries', { entryId: entry._id, userId: profile._id, anilistId: entry.anilistId, animeId: entry.animeId, completedAt: now, sequence })
  const milestone = await readMilestone(ctx, profile._id, entry.anilistId, 'rewatched')
  if (milestone) {
    const linked = await linkMilestone(ctx, milestone, entry.animeId)
    await ctx.db.patch(linked._id, createMilestoneTimestampPatch(now))
    const updated = await ctx.db.get('animeMilestones', milestone._id)
    if (updated) await upsertMilestoneCard(ctx, updated, true)
  } else await createMilestoneOnce(ctx, profile, entry.anilistId, entry.animeId, 'rewatched', now)
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

/** Returns current List Progress, including explicit zeros for untouched users. */
export const getMyProgress = query({
  args: {}, returns: progressValidator,
  handler: async (ctx) => {
    const { profile } = await requireProfile(ctx)
    const progress = await readProgress(ctx, profile._id)
    return progress
      ? transitionProgress(null, null, {
        watching: progress.watching, completed: progress.completed, planned: progress.planned, dropped: progress.dropped,
      })
      : { watching: 0, completed: 0, planned: 0, dropped: 0 }
  },
})

/** Lists one accessible profile's favorites, newest first. */
export const listProfileFavorites = query({
  args: { username: v.string(), cursor: v.union(v.string(), v.null()) },
  returns: profileFavoritePageValidator,
  handler: async (ctx, args) => {
    const access = await resolveProfileAccess(ctx, args.username)
    if (access.access === 'header') {
      throw new ConvexError({ code: 'PROFILE_PRIVATE', message: 'Profile content is private.' })
    }
    const cursor = decodeProfileFavoriteCursor(
      args.cursor,
      access.usernameKey,
      access.viewerId,
    )
    const page = await ctx.db
      .query('userAnimeEntries')
      .withIndex('by_user_favorite_at', (q) => q
        .eq('userId', access.targetId)
        .gt('favoriteAt', null))
      .order('desc')
      .paginate({ numItems: 20, cursor })
    const items = await Promise.all(page.page.map(async (entry) => {
      if (entry.favoriteAt === null) {
        throw new ConvexError({
          code: 'PROFILE_FAVORITE_CORRUPT',
          message: 'Favorite entry is missing its timestamp.',
        })
      }
      const anime = await ctx.db
        .query('animeSummaries')
        .withIndex('by_anilist_id', (q) => q.eq('anilistId', entry.anilistId))
        .unique()
      if (!anime) {
        throw new ConvexError({
          code: 'PROFILE_ANIME_MISSING',
          message: 'Favorite Anime summary is missing.',
        })
      }
      return {
        favoriteAt: entry.favoriteAt,
        anime: {
          anilistId: anime.anilistId,
          slug: anime.slug,
          title: anime.titles.display,
          coverImageUrl: anime.coverImageUrl,
        },
      }
    }))
    return {
      items,
      cursor: page.isDone
        ? null
        : encodeProfileFavoriteCursor({
            lane: 'favorites',
            usernameKey: access.usernameKey,
            viewerId: access.viewerId,
            cursor: page.continueCursor,
          }),
      hasMore: !page.isDone,
    }
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
    const { profile } = await requireProfile(ctx); const animeId = await requireAnimeId(ctx, args.anilistId); const now = Date.now()
    const entry = await getOrCreateEntry(ctx, profile._id, args.anilistId, animeId, now)
    const storedCompletion = await readMilestone(ctx, profile._id, args.anilistId, 'completed')
    const completion = storedCompletion ? await linkMilestone(ctx, storedCompletion, animeId) : null
    const effects = decideStatusChange(entry.status as AnimeStatus | null, args.status, Boolean(completion))
    await applyProgress(ctx, profile._id, entry.status as AnimeStatus | null, args.status)
    if (effects.createCompletion) await createMilestoneOnce(ctx, profile, args.anilistId, animeId, 'completed', now)
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
    const { profile } = await requireProfile(ctx); const animeId = await requireAnimeId(ctx, args.anilistId); const now = Date.now(); let score
    try { score = normalizeScore(args.score) } catch (error) { throw new ConvexError({ code: 'INVALID_SCORE', message: error instanceof Error ? error.message : 'Score is invalid.' }) }
    const entry = await getOrCreateEntry(ctx, profile._id, args.anilistId, animeId, now)
    const status = entry.score === null && score !== null && entry.status === null ? 'watching' : entry.status
    await applyProgress(ctx, profile._id, entry.status as AnimeStatus | null, status as AnimeStatus | null)
    await ctx.db.patch(entry._id, { score, status, updatedAt: now })
    const storedCompletion = await readMilestone(ctx, profile._id, args.anilistId, 'completed')
    const completion = storedCompletion ? await linkMilestone(ctx, storedCompletion, animeId) : null
    if (completion) await upsertMilestoneCard(ctx, completion, false)
    const saved = await ctx.db.get('userAnimeEntries', entry._id); if (!saved) throw new ConvexError({ code: 'ENTRY_NOT_FOUND', message: 'User anime entry no longer exists.' }); return toSavedResult(toPublicEntry(saved))
  },
})

/** Sets explicit favorite state with idempotent timestamps. */
export const setFavorite = mutation({
  args: { anilistId: v.number(), isFavorite: v.boolean() }, returns: savedResultValidator,
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx); const animeId = await requireAnimeId(ctx, args.anilistId); const now = Date.now(); const entry = await getOrCreateEntry(ctx, profile._id, args.anilistId, animeId, now)
    await ctx.db.patch(entry._id, { favoriteAt: applyFavorite(entry.favoriteAt, args.isFavorite, now), updatedAt: now })
    const saved = await ctx.db.get('userAnimeEntries', entry._id); if (!saved) throw new ConvexError({ code: 'ENTRY_NOT_FOUND', message: 'User anime entry no longer exists.' }); return toSavedResult(toPublicEntry(saved))
  },
})

/** Explicitly records another completed rewatch. */
export const recordRewatch = mutation({
  args: { anilistId: v.number() }, returns: savedResultValidator,
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx); const animeId = await requireAnimeId(ctx, args.anilistId); const now = Date.now(); const entry = await getOrCreateEntry(ctx, profile._id, args.anilistId, animeId, now)
    await applyProgress(ctx, profile._id, entry.status as AnimeStatus | null, 'rewatched')
    await addRewatch(ctx, profile, entry, now); await ctx.db.patch(entry._id, { status: 'rewatched', updatedAt: now })
    const saved = await ctx.db.get('userAnimeEntries', entry._id); if (!saved) throw new ConvexError({ code: 'ENTRY_NOT_FOUND', message: 'User anime entry no longer exists.' }); return toSavedResult(toPublicEntry(saved))
  },
})

/** Removes the latest owned rewatch and rolls milestone/status state back. */
export const removeLatestRewatch = mutation({
  args: { anilistId: v.number() }, returns: savedResultValidator,
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx); const animeId = await requireAnimeId(ctx, args.anilistId); const entry = await readEntry(ctx, profile._id, args.anilistId)
    if (!entry) throw new ConvexError({ code: 'REWATCH_NOT_FOUND', message: 'No rewatch exists to remove.' })
    if (entry.animeId && entry.animeId !== animeId) throw new ConvexError({ code: 'CATALOG_PROVIDER_REF_CONFLICT', message: `User Anime entry ${entry._id} conflicts with provider mapping ${animeId}.` })
    if (!entry.animeId) await ctx.db.patch(entry._id, { animeId })
    const history = await ctx.db.query('animeRewatchEntries').withIndex('by_user_anime_sequence', (q) => q.eq('userId', profile._id).eq('anilistId', args.anilistId)).order('desc').take(2)
    if (!history[0]) throw new ConvexError({ code: 'REWATCH_NOT_FOUND', message: 'No rewatch exists to remove.' })
    const now = Date.now(); const rollback = rollbackRewatch(history.map((item) => item.completedAt), entry.status as AnimeStatus | null); await ctx.db.delete(history[0]._id)
    await applyProgress(ctx, profile._id, entry.status as AnimeStatus | null, rollback.nextStatus)
    const storedMilestone = await readMilestone(ctx, profile._id, args.anilistId, 'rewatched')
    const milestone = storedMilestone ? await linkMilestone(ctx, storedMilestone, animeId) : null
    if (milestone && rollback.milestoneAt === null) { await ctx.db.delete(milestone._id); await removeMilestoneCard(ctx, profile._id, args.anilistId, animeId, 'rewatched') }
    else if (milestone && rollback.milestoneAt !== null) {
      await ctx.db.patch(milestone._id, { ...createMilestoneTimestampPatch(now), occurredAt: rollback.milestoneAt })
      const updated = await ctx.db.get('animeMilestones', milestone._id); if (updated) await upsertMilestoneCard(ctx, updated, false)
    }
    await ctx.db.patch(entry._id, { rewatchCount: Math.max(0, entry.rewatchCount - 1), status: rollback.nextStatus, updatedAt: now })
    const saved = await ctx.db.get('userAnimeEntries', entry._id); if (!saved) throw new ConvexError({ code: 'ENTRY_NOT_FOUND', message: 'User anime entry no longer exists.' }); return toSavedResult(toPublicEntry(saved))
  },
})

/** Rebuilds sparse List Progress rows one resumable profile page at a time. */
export const backfillProgress = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({ continueCursor: v.string(), isDone: v.boolean(), processedCount: v.number(), updatedCount: v.number() }),
  handler: async (ctx, args) => {
    const page = await ctx.db.query('users').paginate(args.paginationOpts)
    let updatedCount = 0
    for (const profile of page.page) {
      const expected = await computeProgress(ctx, profile._id)
      if (await replaceProgress(ctx, profile._id, expected)) updatedCount += 1
    }
    return { continueCursor: page.continueCursor, isDone: page.isDone, processedCount: page.page.length, updatedCount }
  },
})

/** Reports profile aggregates that differ from indexed entry truth. */
export const verifyProgress = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({ continueCursor: v.string(), isDone: v.boolean(), processedCount: v.number(), mismatchUserIds: v.array(v.id('users')) }),
  handler: async (ctx, args) => {
    const page = await ctx.db.query('users').paginate(args.paginationOpts)
    const mismatchUserIds: Id<'users'>[] = []
    for (const profile of page.page) {
      const expected = await computeProgress(ctx, profile._id)
      const current = await readProgress(ctx, profile._id)
      const matches = current
        ? !isEmptyProgress(expected) && progressMatches(current, expected)
        : isEmptyProgress(expected)
      if (!matches) mismatchUserIds.push(profile._id)
    }
    return { continueCursor: page.continueCursor, isDone: page.isDone, processedCount: page.page.length, mismatchUserIds }
  },
})
