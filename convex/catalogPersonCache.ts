import { ConvexError, v } from 'convex/values'

import { type Doc } from './_generated/dataModel'
import { mutation, query, type MutationCtx } from './_generated/server'
import { type CatalogPersonDetail } from '../src/features/catalog-person/shared/catalog-person-contracts'
import { requireCacheWriteToken } from './animeCache'
import {
  CATALOG_PERSON_LEASE_MS,
  CatalogPersonCachePolicyError,
  assertCatalogPersonLease,
  createCatalogPersonTiming,
  decideCatalogPersonLease,
  decideCatalogPersonLeaseRelease,
  personDetailKey,
  personWorkKey,
  resolveCatalogPersonRead,
  validateCatalogPersonDetail,
  validateCatalogPersonWorkPage,
} from './catalogPersonCachePolicy'
import { ensureCatalogEntity } from './catalogIdentityModel'
import { type CatalogProviderRef } from './catalogIdentityPolicy'

const kindValidator = v.union(v.literal('character'), v.literal('staff'))
const formatValidator = v.union(v.literal('TV'), v.literal('TV_SHORT'), v.literal('MOVIE'), v.literal('SPECIAL'), v.literal('OVA'), v.literal('ONA'), v.literal('MUSIC'), v.null())
const voiceActorValidator = v.object({ id: v.number(), name: v.string(), imageUrl: v.union(v.string(), v.null()), language: v.string() })
const detailValidator = v.union(
  v.object({ kind: v.literal('character'), id: v.number(), name: v.string(), nativeName: v.union(v.string(), v.null()), imageUrl: v.union(v.string(), v.null()), description: v.union(v.string(), v.null()), age: v.union(v.string(), v.null()), gender: v.union(v.string(), v.null()), birthday: v.union(v.string(), v.null()), bloodType: v.union(v.string(), v.null()), voiceActorScope: v.literal('all-languages'), voiceActors: v.array(voiceActorValidator) }),
  v.object({ kind: v.literal('staff'), id: v.number(), name: v.string(), nativeName: v.union(v.string(), v.null()), imageUrl: v.union(v.string(), v.null()), description: v.union(v.string(), v.null()), occupations: v.array(v.string()), language: v.union(v.string(), v.null()), hometown: v.union(v.string(), v.null()), activeYears: v.union(v.string(), v.null()) }),
)
const summaryValidator = v.object({
  anilistId: v.number(), slug: v.string(),
  titles: v.object({ display: v.string(), english: v.union(v.string(), v.null()), romaji: v.union(v.string(), v.null()), native: v.union(v.string(), v.null()) }),
  coverImageUrl: v.union(v.string(), v.null()), bannerImageUrl: v.union(v.string(), v.null()), format: formatValidator,
  season: v.union(v.literal('WINTER'), v.literal('SPRING'), v.literal('SUMMER'), v.literal('FALL'), v.null()),
  seasonYear: v.union(v.number(), v.null()), episodes: v.union(v.number(), v.null()), genres: v.array(v.string()),
  popularity: v.number(), averageScore: v.union(v.number(), v.null()), trending: v.union(v.number(), v.null()),
  startDate: v.union(v.object({ year: v.union(v.number(), v.null()), month: v.union(v.number(), v.null()), day: v.union(v.number(), v.null()) }), v.null()),
  nextAiringAt: v.union(v.number(), v.null()),
})
const catalogSummaryValidator = v.object({ id: v.number(), slug: v.string(), title: v.string(), coverImageUrl: v.union(v.string(), v.null()), format: formatValidator, seasonYear: v.union(v.number(), v.null()) })
const workPageValidator = v.object({ items: v.array(v.object({ anime: catalogSummaryValidator, role: v.union(v.string(), v.null()) })), currentPage: v.number(), hasNextPage: v.boolean(), perPage: v.literal(20) })
const unavailableValidator = v.union(v.object({ status: v.literal('missing'), entry: v.null() }), v.object({ status: v.literal('expired'), entry: v.null() }))
const detailReadValidator = v.union(unavailableValidator, v.object({ status: v.literal('fresh'), entry: v.object({ payload: detailValidator, refreshedAt: v.number(), expiresAt: v.number() }) }))
const workReadValidator = v.union(unavailableValidator, v.object({ status: v.literal('fresh'), entry: v.object({ payload: workPageValidator, refreshedAt: v.number(), expiresAt: v.number() }) }))

const failPolicy = (error: unknown): never => {
  if (error instanceof CatalogPersonCachePolicyError) throw new ConvexError({ code: error.code, message: error.message })
  throw error
}

const assertKey = (key: string): void => {
  const detail = /^person:(character|staff):([1-9]\d*)$/.exec(key)
  if (detail) {
    try { personDetailKey(detail[1] as 'character' | 'staff', Number(detail[2])) } catch (error) { failPolicy(error) }
    return
  }
  const work = /^person-work:(character|staff):([1-9]\d*):([1-9]\d*)$/.exec(key)
  if (work) {
    try { personWorkKey(work[1] as 'character' | 'staff', Number(work[2]), Number(work[3])) } catch (error) { failPolicy(error) }
    return
  }
  throw new ConvexError({ code: 'INVALID_CACHE_KEY', message: 'Catalog person cache key is invalid.' })
}

const requireLease = async (ctx: MutationCtx, key: string, leaseId: string, now: number): Promise<Doc<'catalogPersonCacheLeases'>> => {
  const lease = await ctx.db.query('catalogPersonCacheLeases').withIndex('by_key', (q) => q.eq('key', key)).unique()
  if (!lease) throw new ConvexError({ code: 'LEASE_NOT_ACTIVE', message: 'Catalog person cache lease is missing or expired.' })
  try { assertCatalogPersonLease(lease, leaseId, now) } catch (error) { failPolicy(error) }
  return lease
}

/** Registers each unique provider tuple once in the current transaction. */
const ensureIdentityRefs = async (
  ctx: MutationCtx,
  refs: CatalogProviderRef[],
): Promise<void> => {
  const unique = new Map(refs.map((ref) => [`${ref.kind}:${ref.providerId}`, ref]))
  for (const ref of unique.values()) {
    await ensureCatalogEntity(ctx, ref)
  }
}

/** Expires Character rows written before the all-language actor contract. */
const currentDetail = (detail: Doc<'catalogPersonDetails'>['detail']): CatalogPersonDetail | null => {
  if (detail.kind === 'character') {
    if (detail.voiceActorScope !== 'all-languages' || detail.voiceActors === undefined) return null
    return { ...detail, voiceActorScope: detail.voiceActorScope, voiceActors: detail.voiceActors }
  }
  return detail
}

/** Reads one person detail without expired fallback. */
export const readDetail = query({
  args: { kind: kindValidator, personId: v.number() },
  returns: detailReadValidator,
  handler: async (ctx, args) => {
    try { personDetailKey(args.kind, args.personId) } catch (error) { failPolicy(error) }
    const record = await ctx.db.query('catalogPersonDetails').withIndex('by_kind_person', (q) => q.eq('kind', args.kind).eq('personId', args.personId)).unique()
    if (!record) return resolveCatalogPersonRead<CatalogPersonDetail>(null, Date.now())
    const detail = currentDetail(record.detail)
    if (!detail) return { status: 'expired' as const, entry: null }
    return resolveCatalogPersonRead({ payload: detail, refreshedAt: record.refreshedAt, expiresAt: record.expiresAt }, Date.now())
  },
})

/** Reads and hydrates one ordered work page. */
export const readWorkPage = query({
  args: { kind: kindValidator, personId: v.number(), page: v.number() },
  returns: workReadValidator,
  handler: async (ctx, args) => {
    try { personWorkKey(args.kind, args.personId, args.page) } catch (error) { failPolicy(error) }
    const record = await ctx.db.query('catalogPersonWorkPages').withIndex('by_kind_person_page', (q) => q.eq('kind', args.kind).eq('personId', args.personId).eq('page', args.page)).unique()
    const timed = resolveCatalogPersonRead(record ? { payload: record, refreshedAt: record.refreshedAt, expiresAt: record.expiresAt } : null, Date.now())
    if (timed.status !== 'fresh') return timed
    const items = await Promise.all(record!.items.map(async (item) => {
      const summary = await ctx.db.query('animeSummaries').withIndex('by_anilist_id', (q) => q.eq('anilistId', item.animeId)).unique()
      if (!summary) throw new ConvexError({ code: 'CACHE_CORRUPT', message: `Catalog person work references missing anime ${item.animeId}.` })
      return { anime: { id: summary.anilistId, slug: summary.slug, title: summary.titles.display, coverImageUrl: summary.coverImageUrl, format: summary.format, seasonYear: summary.seasonYear }, role: item.role }
    }))
    return { status: 'fresh' as const, entry: { payload: { items, currentPage: args.page, hasNextPage: record!.hasNextPage, perPage: 20 as const }, refreshedAt: record!.refreshedAt, expiresAt: record!.expiresAt } }
  },
})

/** Acquires one token-gated 60-second lease. */
export const acquireLease = mutation({
  args: { key: v.string(), leaseId: v.string(), token: v.string() },
  returns: v.object({ acquired: v.boolean(), leaseUntil: v.union(v.number(), v.null()) }),
  handler: async (ctx, args) => {
    requireCacheWriteToken(args.token); assertKey(args.key)
    const now = Date.now()
    const current = await ctx.db.query('catalogPersonCacheLeases').withIndex('by_key', (q) => q.eq('key', args.key)).unique()
    let decision
    try { decision = decideCatalogPersonLease(current, args.leaseId, now, now + CATALOG_PERSON_LEASE_MS) } catch (error) { return failPolicy(error) }
    if (decision.acquired) {
      const value = { key: args.key, leaseId: args.leaseId, leaseUntil: decision.leaseUntil as number, updatedAt: now }
      if (current) await ctx.db.patch(current._id, value); else await ctx.db.insert('catalogPersonCacheLeases', value)
    }
    return decision
  },
})

/** Commits one strict detail for active owner. */
export const commitDetail = mutation({
  args: { kind: kindValidator, personId: v.number(), detail: detailValidator, leaseId: v.string(), token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireCacheWriteToken(args.token)
    try { validateCatalogPersonDetail(args.kind, args.personId, args.detail) } catch (error) { return failPolicy(error) }
    const now = Date.now(); const lease = await requireLease(ctx, personDetailKey(args.kind, args.personId), args.leaseId, now)
    await ensureIdentityRefs(ctx, [
      { provider: 'anilist', kind: args.kind, providerId: args.personId },
      ...(args.detail.kind === 'character'
        ? args.detail.voiceActors.map((actor) => ({ provider: 'anilist' as const, kind: 'staff' as const, providerId: actor.id }))
        : []),
    ])
    const current = await ctx.db.query('catalogPersonDetails').withIndex('by_kind_person', (q) => q.eq('kind', args.kind).eq('personId', args.personId)).unique()
    const value = { kind: args.kind, personId: args.personId, detail: args.detail, ...createCatalogPersonTiming(now) }
    if (current) await ctx.db.patch(current._id, value); else await ctx.db.insert('catalogPersonDetails', value)
    await ctx.db.delete(lease._id)
    return null
  },
})

/** Atomically upserts full summaries and ordered work references. */
export const commitWorkPage = mutation({
  args: { kind: kindValidator, personId: v.number(), page: v.number(), items: v.array(v.object({ animeId: v.number(), role: v.union(v.string(), v.null()) })), hasNextPage: v.boolean(), summaries: v.array(summaryValidator), leaseId: v.string(), token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireCacheWriteToken(args.token)
    try { validateCatalogPersonWorkPage(args.kind, args.personId, args.page, args.items) } catch (error) { return failPolicy(error) }
    const summaryIds = new Set(args.summaries.map((summary) => summary.anilistId))
    if (summaryIds.size !== args.summaries.length || args.items.some((item) => !summaryIds.has(item.animeId))) {
      throw new ConvexError({ code: 'INVALID_SUMMARIES', message: 'Work rows must reference exactly supplied unique anime summaries.' })
    }
    const now = Date.now(); const lease = await requireLease(ctx, personWorkKey(args.kind, args.personId, args.page), args.leaseId, now)
    await ensureIdentityRefs(ctx, [
      { provider: 'anilist', kind: args.kind, providerId: args.personId },
      ...args.summaries.map((summary) => ({ provider: 'anilist' as const, kind: 'anime' as const, providerId: summary.anilistId })),
    ])
    for (const summary of args.summaries) {
      const current = await ctx.db.query('animeSummaries').withIndex('by_anilist_id', (q) => q.eq('anilistId', summary.anilistId)).unique()
      if (current) await ctx.db.patch(current._id, { ...summary, updatedAt: now }); else await ctx.db.insert('animeSummaries', { ...summary, updatedAt: now })
    }
    const current = await ctx.db.query('catalogPersonWorkPages').withIndex('by_kind_person_page', (q) => q.eq('kind', args.kind).eq('personId', args.personId).eq('page', args.page)).unique()
    const value = { kind: args.kind, personId: args.personId, page: args.page, items: args.items, hasNextPage: args.hasNextPage, ...createCatalogPersonTiming(now) }
    if (current) await ctx.db.patch(current._id, value); else await ctx.db.insert('catalogPersonWorkPages', value)
    await ctx.db.delete(lease._id)
    return null
  },
})

/** Releases one active owner lease. */
export const releaseLease = mutation({
  args: { key: v.string(), leaseId: v.string(), token: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    requireCacheWriteToken(args.token); assertKey(args.key)
    const now = Date.now()
    const lease = await ctx.db.query('catalogPersonCacheLeases').withIndex('by_key', (q) => q.eq('key', args.key)).unique()
    let release
    try { release = decideCatalogPersonLeaseRelease(lease, args.leaseId, now) } catch (error) { return failPolicy(error) }
    if (lease && release) await ctx.db.delete(lease._id)
    return release
  },
})
