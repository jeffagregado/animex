import { ConvexError, v } from 'convex/values'

import { type Doc } from './_generated/dataModel'
import { type MutationCtx, type QueryCtx, mutation, query } from './_generated/server'
import {
  DiscoverCachePolicyError,
  type DiscoverCacheSectionKey,
  SECTION_LEASE_DURATION_MS,
  assertActiveSectionLease,
  createSectionTiming,
  decideSectionLease,
  decideSectionLeaseRelease,
  isSectionFresh,
  resolveSectionRead,
  validateCacheWriteToken,
  validateSectionCommit,
} from './animeCachePolicy'
import { ensureCatalogEntity } from './catalogIdentityModel'
import { type CatalogProviderRef } from './catalogIdentityPolicy'

const sectionKeyValidator = v.union(
  v.literal('trending'),
  v.literal('seasonal'),
  v.literal('recommendations'),
  v.literal('upcoming'),
)

const animeSummaryValidator = v.object({
  anilistId: v.number(),
  slug: v.string(),
  titles: v.object({
    display: v.string(),
    english: v.union(v.string(), v.null()),
    romaji: v.union(v.string(), v.null()),
    native: v.union(v.string(), v.null()),
  }),
  coverImageUrl: v.union(v.string(), v.null()),
  bannerImageUrl: v.union(v.string(), v.null()),
  format: v.union(
    v.literal('TV'),
    v.literal('TV_SHORT'),
    v.literal('MOVIE'),
    v.literal('SPECIAL'),
    v.literal('OVA'),
    v.literal('ONA'),
    v.literal('MUSIC'),
    v.null(),
  ),
  season: v.union(
    v.literal('WINTER'),
    v.literal('SPRING'),
    v.literal('SUMMER'),
    v.literal('FALL'),
    v.null(),
  ),
  seasonYear: v.union(v.number(), v.null()),
  episodes: v.union(v.number(), v.null()),
  genres: v.array(v.string()),
  popularity: v.number(),
  averageScore: v.union(v.number(), v.null()),
  trending: v.union(v.number(), v.null()),
  startDate: v.union(
    v.object({
      year: v.union(v.number(), v.null()),
      month: v.union(v.number(), v.null()),
      day: v.union(v.number(), v.null()),
    }),
    v.null(),
  ),
  nextAiringAt: v.union(v.number(), v.null()),
})

const freshSectionValidator = v.object({
  key: sectionKeyValidator,
  status: v.literal('fresh'),
  section: v.object({
    key: sectionKeyValidator,
    items: v.array(animeSummaryValidator),
    refreshedAt: v.number(),
    expiresAt: v.number(),
  }),
})

const unavailableSectionValidator = v.union(
  v.object({ key: sectionKeyValidator, status: v.literal('missing'), section: v.null() }),
  v.object({ key: sectionKeyValidator, status: v.literal('expired'), section: v.null() }),
)

type CachedAnimeSummary = Omit<Doc<'animeSummaries'>, '_id' | '_creationTime' | 'updatedAt'>
type CacheLease = Doc<'discoverCacheLeases'>
type CacheSection = Doc<'discoverSectionCache'>
type SectionLeaseDecision = { acquired: boolean; leaseUntil: number | null }
type CacheSectionTiming = { refreshedAt: number; expiresAt: number }

/** Converts cache policy failures into client-safe Convex errors. */
const throwCachePolicyError = (error: DiscoverCachePolicyError): never => {
  throw new ConvexError({ code: error.code, message: error.message })
}

/** Requires the deployment-configured token before cache writes. */
export const requireCacheWriteToken = (token: string): void => {
  try {
    validateCacheWriteToken(token, process.env.DISCOVER_CACHE_WRITE_TOKEN)
  } catch (error) {
    if (error instanceof DiscoverCachePolicyError) {
      return throwCachePolicyError(error)
    }
    throw error
  }
}

/** Removes Convex metadata before exposing an anime summary. */
const toCachedAnimeSummary = (summary: Doc<'animeSummaries'>): CachedAnimeSummary => ({
  anilistId: summary.anilistId,
  slug: summary.slug,
  titles: summary.titles,
  coverImageUrl: summary.coverImageUrl,
  bannerImageUrl: summary.bannerImageUrl,
  format: summary.format,
  season: summary.season,
  seasonYear: summary.seasonYear,
  episodes: summary.episodes,
  genres: summary.genres,
  popularity: summary.popularity,
  averageScore: summary.averageScore,
  trending: summary.trending,
  startDate: summary.startDate,
  nextAiringAt: summary.nextAiringAt,
})

/** Re-throws a cache policy failure as a client-safe Convex error. */
const throwUnknownCacheError = (error: unknown): never => {
  if (error instanceof DiscoverCachePolicyError) {
    return throwCachePolicyError(error)
  }
  throw error
}

/** Loads one cached summary without Convex document metadata. */
const readCachedSummary = async (
  ctx: QueryCtx,
  anilistId: number,
): Promise<CachedAnimeSummary | null> => {
  const summary = await ctx.db
    .query('animeSummaries')
    .withIndex('by_anilist_id', (index) => index.eq('anilistId', anilistId))
    .unique()
  return summary ? toCachedAnimeSummary(summary) : null
}

/** Loads summaries referenced by a cache section. */
const readCachedSummaries = async (
  ctx: QueryCtx,
  section: CacheSection,
): Promise<CachedAnimeSummary[]> => {
  const summaries = await Promise.all(section.animeIds.map((anilistId) => readCachedSummary(ctx, anilistId)))
  return summaries.filter((summary): summary is CachedAnimeSummary => summary !== null)
}

/** Reads one cache section and translates policy failures for clients. */
const readSection = async (
  ctx: QueryCtx,
  key: DiscoverCacheSectionKey,
  now: number,
) => {
  const section = await ctx.db
    .query('discoverSectionCache')
    .withIndex('by_key', (index) => index.eq('key', key))
    .unique()
  if (!isSectionFresh(section, now)) {
    return resolveSectionRead(key, section, [], now)
  }

  try {
    return resolveSectionRead(key, section, await readCachedSummaries(ctx, section), now)
  } catch (error) {
    return throwUnknownCacheError(error)
  }
}

/** Decides a lease while translating policy failures for clients. */
const getSectionLeaseDecision = (
  current: CacheLease | null,
  leaseId: string,
  now: number,
  leaseUntil: number,
): SectionLeaseDecision => {
  try {
    return decideSectionLease(current, leaseId, now, leaseUntil)
  } catch (error) {
    return throwUnknownCacheError(error)
  }
}

/** Writes an acquired section lease. */
const persistSectionLease = async (
  ctx: MutationCtx,
  current: CacheLease | null,
  key: DiscoverCacheSectionKey,
  leaseId: string,
  leaseUntil: number,
  now: number,
  decision: SectionLeaseDecision,
): Promise<void> => {
  if (!decision.acquired) return

  const value = { key, leaseId, leaseUntil, updatedAt: now }
  if (current) {
    await ctx.db.patch(current._id, value)
    return
  }
  await ctx.db.insert('discoverCacheLeases', value)
}

/** Requires a current lease held by the committing worker. */
const requireActiveSectionLease = (
  lease: CacheLease | null,
  leaseId: string,
  now: number,
): CacheLease => {
  try {
    assertActiveSectionLease(lease, leaseId, now)
    return lease
  } catch (error) {
    return throwUnknownCacheError(error)
  }
}

/** Validates a section replacement before its writes start. */
const validateCacheSectionCommit = (
  key: DiscoverCacheSectionKey,
  summaries: CachedAnimeSummary[],
  timing: CacheSectionTiming,
): void => {
  try {
    validateSectionCommit(key, summaries, timing.refreshedAt, timing.expiresAt)
  } catch (error) {
    return throwUnknownCacheError(error)
  }
}

/** Registers each unique Anime provider reference once. */
const ensureAnimeIdentities = async (
  ctx: MutationCtx,
  summaries: CachedAnimeSummary[],
): Promise<void> => {
  const ids = new Set(summaries.map((summary) => summary.anilistId))
  for (const providerId of ids) {
    const ref: CatalogProviderRef = { provider: 'anilist', kind: 'anime', providerId }
    await ensureCatalogEntity(ctx, ref)
  }
}

/** Upserts one anime summary from a valid section commit. */
const upsertAnimeSummary = async (
  ctx: MutationCtx,
  summary: CachedAnimeSummary,
  now: number,
): Promise<void> => {
  const existing = await ctx.db
    .query('animeSummaries')
    .withIndex('by_anilist_id', (index) => index.eq('anilistId', summary.anilistId))
    .unique()
  if (existing) {
    await ctx.db.patch(existing._id, { ...summary, updatedAt: now })
    return
  }
  await ctx.db.insert('animeSummaries', { ...summary, updatedAt: now })
}

/** Atomically replaces the cache record for one section. */
const upsertSectionCache = async (
  ctx: MutationCtx,
  key: DiscoverCacheSectionKey,
  summaries: CachedAnimeSummary[],
  timing: CacheSectionTiming,
): Promise<void> => {
  const section = await ctx.db
    .query('discoverSectionCache')
    .withIndex('by_key', (index) => index.eq('key', key))
    .unique()
  const value = {
    key,
    animeIds: summaries.map((summary) => summary.anilistId),
    refreshedAt: timing.refreshedAt,
    expiresAt: timing.expiresAt,
  }
  if (section) {
    await ctx.db.patch(section._id, value)
    return
  }
  await ctx.db.insert('discoverSectionCache', value)
}

/** Decides whether a lease release is permitted for its owner. */
const shouldReleaseSectionLease = (
  current: CacheLease | null,
  leaseId: string,
  now: number,
): boolean => {
  try {
    return decideSectionLeaseRelease(current, leaseId, now)
  } catch (error) {
    return throwUnknownCacheError(error)
  }
}

/** Deletes a lease only when policy permits its release. */
const deleteReleasedSectionLease = async (
  ctx: MutationCtx,
  current: CacheLease | null,
  shouldRelease: boolean,
): Promise<boolean> => {
  if (!current || !shouldRelease) return false
  await ctx.db.delete(current._id)
  return true
}

/** Reads cache sections in caller order without returning stale items. */
export const readSections = query({
  args: { keys: v.array(sectionKeyValidator), token: v.string() },
  returns: v.array(v.union(freshSectionValidator, unavailableSectionValidator)),
  handler: async (ctx, args) => {
    requireCacheWriteToken(args.token)
    const now = Date.now()
    return await Promise.all(args.keys.map((key) => readSection(ctx, key, now)))
  },
})

/** Acquires a per-section lease for a single cache refresh worker. */
export const acquireSectionLease = mutation({
  args: {
    key: sectionKeyValidator,
    leaseId: v.string(),
    token: v.string(),
  },
  returns: v.object({ acquired: v.boolean(), leaseUntil: v.union(v.number(), v.null()) }),
  handler: async (ctx, args) => {
    requireCacheWriteToken(args.token)
    const now = Date.now()
    const leaseUntil = now + SECTION_LEASE_DURATION_MS
    const current = await ctx.db
      .query('discoverCacheLeases')
      .withIndex('by_key', (index) => index.eq('key', args.key))
      .unique()
    const result = getSectionLeaseDecision(current, args.leaseId, now, leaseUntil)
    await persistSectionLease(ctx, current, args.key, args.leaseId, leaseUntil, now, result)
    return result
  },
})

/** Stores a fully refreshed section only for its active lease holder. */
export const commitSection = mutation({
  args: {
    key: sectionKeyValidator,
    leaseId: v.string(),
    summaries: v.array(animeSummaryValidator),
    token: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireCacheWriteToken(args.token)
    const now = Date.now()
    const timing = createSectionTiming(args.key, now)
    const lease = await ctx.db
      .query('discoverCacheLeases')
      .withIndex('by_key', (index) => index.eq('key', args.key))
      .unique()
    const activeLease = requireActiveSectionLease(lease, args.leaseId, now)
    validateCacheSectionCommit(args.key, args.summaries, timing)
    await ensureAnimeIdentities(ctx, args.summaries)
    for (const summary of args.summaries) {
      await upsertAnimeSummary(ctx, summary, now)
    }
    await upsertSectionCache(ctx, args.key, args.summaries, timing)
    await ctx.db.delete(activeLease._id)
    return null
  },
})

/** Releases a matching lease without letting another active worker clear it. */
export const releaseSectionLease = mutation({
  args: { key: sectionKeyValidator, leaseId: v.string(), token: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    requireCacheWriteToken(args.token)
    const now = Date.now()
    const current = await ctx.db
      .query('discoverCacheLeases')
      .withIndex('by_key', (index) => index.eq('key', args.key))
      .unique()
    const shouldRelease = shouldReleaseSectionLease(current, args.leaseId, now)
    return await deleteReleasedSectionLease(ctx, current, shouldRelease)
  },
})
