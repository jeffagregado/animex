import { ConvexError, v } from 'convex/values'

import { type Doc } from './_generated/dataModel'
import { mutation, query, type MutationCtx } from './_generated/server'
import { requireCacheWriteToken } from './animeCache'
import {
  ANIME_DETAIL_LEASE_MS,
  AnimeDetailCachePolicyError,
  assertDetailLease,
  createDetailTiming,
  decideDetailLease,
  decideDetailLeaseRelease,
  resolveDetailRead,
  validatePeoplePage,
} from './animeDetailCachePolicy'

const kindValidator = v.union(v.literal('characters'), v.literal('staff'))
const titlesValidator = v.object({ display: v.string(), english: v.union(v.string(), v.null()), romaji: v.union(v.string(), v.null()), native: v.union(v.string(), v.null()) })
const dateValidator = v.union(v.object({ year: v.union(v.number(), v.null()), month: v.union(v.number(), v.null()), day: v.union(v.number(), v.null()) }), v.null())
const formatValidator = v.union(v.literal('TV'), v.literal('TV_SHORT'), v.literal('MOVIE'), v.literal('SPECIAL'), v.literal('OVA'), v.literal('ONA'), v.literal('MUSIC'), v.null())
const seasonValidator = v.union(v.literal('WINTER'), v.literal('SPRING'), v.literal('SUMMER'), v.literal('FALL'), v.null())
const listItemValidator = v.object({ anilistId: v.number(), slug: v.string(), title: v.string(), coverImageUrl: v.union(v.string(), v.null()), format: formatValidator, seasonYear: v.union(v.number(), v.null()) })
const characterValidator = v.object({ anilistId: v.number(), name: v.string(), role: v.union(v.literal('MAIN'), v.literal('SUPPORTING'), v.literal('BACKGROUND')), imageUrl: v.union(v.string(), v.null()), japaneseVoiceActor: v.union(v.object({ anilistId: v.number(), name: v.string(), imageUrl: v.union(v.string(), v.null()), language: v.literal('Japanese') }), v.null()) })
const staffValidator = v.object({ anilistId: v.number(), name: v.string(), role: v.string(), imageUrl: v.union(v.string(), v.null()) })
const detailValidator = v.object({
  anilistId: v.number(), slug: v.string(), titles: titlesValidator,
  coverImageUrl: v.union(v.string(), v.null()), bannerImageUrl: v.union(v.string(), v.null()), synopsis: v.union(v.string(), v.null()), format: formatValidator,
  status: v.union(v.literal('FINISHED'), v.literal('RELEASING'), v.literal('NOT_YET_RELEASED'), v.literal('CANCELLED'), v.literal('HIATUS'), v.null()),
  source: v.union(v.string(), v.null()), season: seasonValidator, seasonYear: v.union(v.number(), v.null()), episodes: v.union(v.number(), v.null()), durationMinutes: v.union(v.number(), v.null()),
  startDate: dateValidator, endDate: dateValidator, genres: v.array(v.string()), mainStudio: v.union(v.object({ name: v.string(), siteUrl: v.union(v.string(), v.null()) }), v.null()),
  related: v.array(listItemValidator), recommendations: v.array(listItemValidator), trailer: v.union(v.object({ youtubeId: v.string(), thumbnailUrl: v.union(v.string(), v.null()) }), v.null()), externalLinks: v.array(v.object({ site: v.string(), url: v.string() })),
  charactersPage: v.object({ items: v.array(characterValidator), currentPage: v.number(), hasNextPage: v.boolean(), perPage: v.literal(24) }),
  staffPage: v.object({ items: v.array(staffValidator), currentPage: v.number(), hasNextPage: v.boolean(), perPage: v.literal(24) }),
})
const summaryValidator = v.object({
  anilistId: v.number(), slug: v.string(), titles: titlesValidator, coverImageUrl: v.union(v.string(), v.null()), bannerImageUrl: v.union(v.string(), v.null()), format: formatValidator,
  season: seasonValidator, seasonYear: v.union(v.number(), v.null()), episodes: v.union(v.number(), v.null()), genres: v.array(v.string()), popularity: v.number(), averageScore: v.union(v.number(), v.null()), trending: v.union(v.number(), v.null()), startDate: dateValidator, nextAiringAt: v.union(v.number(), v.null()),
})
const itemValidator = v.union(characterValidator, staffValidator)
const unavailableValidator = v.union(v.object({ status: v.literal('missing'), entry: v.null() }), v.object({ status: v.literal('expired'), entry: v.null() }))
const detailReadValidator = v.union(unavailableValidator, v.object({ status: v.literal('fresh'), entry: v.object({ payload: detailValidator, refreshedAt: v.number(), expiresAt: v.number() }) }))
const pageReadValidator = v.union(unavailableValidator, v.object({ status: v.literal('fresh'), entry: v.object({ payload: v.object({ items: v.array(itemValidator), currentPage: v.number(), hasNextPage: v.boolean(), perPage: v.literal(24) }), refreshedAt: v.number(), expiresAt: v.number() }) }))

const failPolicy = (error: unknown): never => {
  if (error instanceof AnimeDetailCachePolicyError) throw new ConvexError({ code: error.code, message: error.message })
  throw error
}
const assertPositive = (value: number, name: string): void => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new ConvexError({ code: `INVALID_${name.toUpperCase()}`, message: `${name} must be a positive safe integer.` })
}
const detailKey = (anilistId: number) => `detail:${anilistId}`
const pageKey = (anilistId: number, kind: 'characters' | 'staff', page: number) => `people:${anilistId}:${kind}:${page}`
const assertCacheKey = (key: string): void => {
  const detailMatch = /^detail:([1-9]\d*)$/.exec(key)
  if (detailMatch) { assertPositive(Number(detailMatch[1]), 'anilistId'); return }
  const pageMatch = /^people:([1-9]\d*):(characters|staff):([1-9]\d*)$/.exec(key)
  if (pageMatch) {
    try { validatePeoplePage(Number(pageMatch[1]), pageMatch[2] as 'characters' | 'staff', Number(pageMatch[3]), []) } catch (error) { return failPolicy(error) }
    return
  }
  throw new ConvexError({ code: 'INVALID_CACHE_KEY', message: 'Anime detail cache key is invalid.' })
}

/** Reads a detail record without exposing expired data. */
export const readDetail = query({
  args: { anilistId: v.number() }, returns: detailReadValidator,
  handler: async (ctx, args) => {
    assertPositive(args.anilistId, 'anilistId')
    const record = await ctx.db.query('animeDetails').withIndex('by_anilist_id', (q) => q.eq('anilistId', args.anilistId)).unique()
    return resolveDetailRead(record ? { payload: record.detail, refreshedAt: record.refreshedAt, expiresAt: record.expiresAt } : null, Date.now())
  },
})

/** Reads one Character or Staff page without exposing expired data. */
export const readPeoplePage = query({
  args: { anilistId: v.number(), kind: kindValidator, page: v.number() }, returns: pageReadValidator,
  handler: async (ctx, args) => {
    try { validatePeoplePage(args.anilistId, args.kind, args.page, []) } catch (error) { return failPolicy(error) }
    const record = await ctx.db.query('animeDetailPeoplePages').withIndex('by_anime_kind_page', (q) => q.eq('anilistId', args.anilistId).eq('kind', args.kind).eq('page', args.page)).unique()
    return resolveDetailRead(record ? { payload: { items: record.items, currentPage: record.page, hasNextPage: record.hasNextPage, perPage: 24 as const }, refreshedAt: record.refreshedAt, expiresAt: record.expiresAt } : null, Date.now())
  },
})

/** Acquires a token-gated refresh lease for a detail or people-page key. */
export const acquireLease = mutation({
  args: { key: v.string(), leaseId: v.string(), token: v.string() }, returns: v.object({ acquired: v.boolean(), leaseUntil: v.union(v.number(), v.null()) }),
  handler: async (ctx, args) => {
    requireCacheWriteToken(args.token); assertCacheKey(args.key)
    const now = Date.now()
    const current = await ctx.db.query('animeDetailCacheLeases').withIndex('by_key', (q) => q.eq('key', args.key)).unique()
    let decision
    try { decision = decideDetailLease(current, args.leaseId, now, now + ANIME_DETAIL_LEASE_MS) } catch (error) { return failPolicy(error) }
    if (decision.acquired) {
      const value = { key: args.key, leaseId: args.leaseId, leaseUntil: decision.leaseUntil as number, updatedAt: now }
      if (current) await ctx.db.patch(current._id, value); else await ctx.db.insert('animeDetailCacheLeases', value)
    }
    return decision
  },
})

const requireLease = async (ctx: MutationCtx, key: string, leaseId: string, now: number): Promise<Doc<'animeDetailCacheLeases'>> => {
  const lease = await ctx.db.query('animeDetailCacheLeases').withIndex('by_key', (q) => q.eq('key', key)).unique()
  try { assertDetailLease(lease, leaseId, now) } catch (error) { return failPolicy(error) }
  return lease
}

/** Atomically commits a summary and full detail for the active lease owner. */
export const commitDetail = mutation({
  args: { leaseId: v.string(), token: v.string(), summary: summaryValidator, detail: detailValidator }, returns: v.null(),
  handler: async (ctx, args) => {
    requireCacheWriteToken(args.token); assertPositive(args.detail.anilistId, 'anilistId')
    if (args.summary.anilistId !== args.detail.anilistId || args.detail.related.length > 5 || args.detail.recommendations.length > 5 || args.detail.externalLinks.length > 8) throw new ConvexError({ code: 'INVALID_DETAIL', message: 'Detail identity or bounded lists are invalid.' })
    try {
      validatePeoplePage(args.detail.anilistId, 'characters', args.detail.charactersPage.currentPage, args.detail.charactersPage.items)
      validatePeoplePage(args.detail.anilistId, 'staff', args.detail.staffPage.currentPage, args.detail.staffPage.items)
    } catch (error) { return failPolicy(error) }
    if (args.detail.charactersPage.currentPage !== 1 || args.detail.staffPage.currentPage !== 1) throw new ConvexError({ code: 'INVALID_DETAIL', message: 'Initial Character and Staff pages must be page 1.' })
    const now = Date.now(); const lease = await requireLease(ctx, detailKey(args.detail.anilistId), args.leaseId, now); const timing = createDetailTiming(now)
    const summary = await ctx.db.query('animeSummaries').withIndex('by_anilist_id', (q) => q.eq('anilistId', args.summary.anilistId)).unique()
    if (summary) await ctx.db.patch(summary._id, { ...args.summary, updatedAt: now }); else await ctx.db.insert('animeSummaries', { ...args.summary, updatedAt: now })
    const detail = await ctx.db.query('animeDetails').withIndex('by_anilist_id', (q) => q.eq('anilistId', args.detail.anilistId)).unique()
    const value = { anilistId: args.detail.anilistId, detail: args.detail, ...timing }
    if (detail) await ctx.db.patch(detail._id, value); else await ctx.db.insert('animeDetails', value)
    await ctx.db.delete(lease._id); return null
  },
})

/** Commits only one bounded Character or Staff page. */
export const commitPeoplePage = mutation({
  args: { anilistId: v.number(), kind: kindValidator, page: v.number(), items: v.array(itemValidator), hasNextPage: v.boolean(), leaseId: v.string(), token: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    requireCacheWriteToken(args.token); try { validatePeoplePage(args.anilistId, args.kind, args.page, args.items) } catch (error) { return failPolicy(error) }
    const now = Date.now(); const lease = await requireLease(ctx, pageKey(args.anilistId, args.kind, args.page), args.leaseId, now); const timing = createDetailTiming(now)
    const record = await ctx.db.query('animeDetailPeoplePages').withIndex('by_anime_kind_page', (q) => q.eq('anilistId', args.anilistId).eq('kind', args.kind).eq('page', args.page)).unique()
    const value = { anilistId: args.anilistId, kind: args.kind, page: args.page, items: args.items, hasNextPage: args.hasNextPage, ...timing }
    if (record) await ctx.db.patch(record._id, value); else await ctx.db.insert('animeDetailPeoplePages', value)
    await ctx.db.delete(lease._id); return null
  },
})

/** Releases a lease only for its active owner. */
export const releaseLease = mutation({
  args: { key: v.string(), leaseId: v.string(), token: v.string() }, returns: v.boolean(),
  handler: async (ctx, args) => {
    requireCacheWriteToken(args.token); assertCacheKey(args.key); const now = Date.now(); const lease = await ctx.db.query('animeDetailCacheLeases').withIndex('by_key', (q) => q.eq('key', args.key)).unique()
    let release: boolean
    try { release = decideDetailLeaseRelease(lease, args.leaseId, now) } catch (error) { return failPolicy(error) }
    if (lease && release) await ctx.db.delete(lease._id)
    return release
  },
})
