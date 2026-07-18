import { type PaginationOptions, paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'

import { type Doc } from './_generated/dataModel'
import { internalMutation, type MutationCtx } from './_generated/server'
import { ensureCatalogEntity, resolveProviderRef } from './catalogIdentityModel'
import {
  CATALOG_PROVIDER_REF_BATCH_MAX,
  type CatalogProviderRef,
} from './catalogIdentityPolicy'

const laneValidator = v.union(
  v.literal('anime-summaries'),
  v.literal('anime-details'),
  v.literal('anime-people-pages'),
  v.literal('catalog-person-details'),
  v.literal('catalog-person-work-pages'),
  v.literal('user-anime-entries'),
  v.literal('anime-rewatches'),
  v.literal('anime-milestones'),
  v.literal('reviews'),
  v.literal('feed-cards'),
  v.literal('anime-review-stats'),
)

type CatalogIdentityLane =
  | 'anime-summaries'
  | 'anime-details'
  | 'anime-people-pages'
  | 'catalog-person-details'
  | 'catalog-person-work-pages'
  | 'user-anime-entries'
  | 'anime-rewatches'
  | 'anime-milestones'
  | 'reviews'
  | 'feed-cards'
  | 'anime-review-stats'

const migrationResultValidator = v.object({
  lane: laneValidator,
  continueCursor: v.string(),
  isDone: v.boolean(),
  processedCount: v.number(),
  createdCount: v.number(),
  existingCount: v.number(),
  missingCount: v.number(),
  conflictCount: v.number(),
})

type IdentityPage = {
  continueCursor: string
  isDone: boolean
  processedCount: number
  refs: CatalogProviderRef[]
}

type IdentityCounts = {
  createdCount: number
  existingCount: number
  missingCount: number
  conflictCount: number
}

type CatalogIdentityMigrationErrorCode =
  | 'CATALOG_ENTITY_KIND_CONFLICT'
  | 'CATALOG_ENTITY_PROVIDER_CONFLICT'
  | 'CATALOG_IDENTITY_PAGE_UNBOUNDED'
  | 'CATALOG_IDENTITY_SOURCE_UNBOUNDED'
  | 'CATALOG_PROVIDER_REF_CONFLICT'

class CatalogIdentityMigrationError extends Error {
  readonly code: CatalogIdentityMigrationErrorCode

  constructor(code: CatalogIdentityMigrationErrorCode, message: string) {
    super(`${code}: ${message}`)
    this.name = 'CatalogIdentityMigrationError'
    this.code = code
  }
}

const animeRef = (providerId: number): CatalogProviderRef => ({
  provider: 'anilist',
  kind: 'anime',
  providerId,
})

const personRef = (
  kind: 'character' | 'staff',
  providerId: number,
): CatalogProviderRef => ({
  provider: 'anilist',
  kind,
  providerId,
})

/** Removes repeated tuples without merging Character and Staff namespaces. */
const uniqueRefs = (refs: CatalogProviderRef[]): CatalogProviderRef[] => {
  const unique = new Map<string, CatalogProviderRef>()
  for (const ref of refs) {
    unique.set(`${ref.provider}:${ref.kind}:${ref.providerId}`, ref)
  }
  return [...unique.values()]
}

/** Rejects legacy source rows beyond current cache identity bounds. */
const boundedRefs = (refs: CatalogProviderRef[]): CatalogProviderRef[] => {
  const unique = uniqueRefs(refs)
  if (unique.length > CATALOG_PROVIDER_REF_BATCH_MAX) {
    throw new CatalogIdentityMigrationError(
      'CATALOG_IDENTITY_SOURCE_UNBOUNDED',
      `Source row has more than ${CATALOG_PROVIDER_REF_BATCH_MAX} embedded provider references.`,
    )
  }
  return unique
}

/** Caps aggregate page work before any identity reads or writes start. */
const boundedPageRefs = (refs: CatalogProviderRef[]): CatalogProviderRef[] => {
  const unique = uniqueRefs(refs)
  if (unique.length > CATALOG_PROVIDER_REF_BATCH_MAX) {
    throw new CatalogIdentityMigrationError(
      'CATALOG_IDENTITY_PAGE_UNBOUNDED',
      `Page has ${unique.length} unique provider references; retry the same cursor with a smaller paginationOpts.numItems value so the page has at most ${CATALOG_PROVIDER_REF_BATCH_MAX}.`,
    )
  }
  return unique
}

/** Extracts every bounded identity embedded in one Anime detail cache row. */
const detailRefs = (row: Doc<'animeDetails'>): CatalogProviderRef[] => boundedRefs([
  animeRef(row.detail.anilistId),
  ...row.detail.related.map((item) => animeRef(item.anilistId)),
  ...row.detail.recommendations.map((item) => animeRef(item.anilistId)),
  ...row.detail.charactersPage.items.map((item) => personRef('character', item.anilistId)),
  ...row.detail.staffPage.items.map((item) => personRef('staff', item.anilistId)),
  ...row.detail.charactersPage.items.flatMap((item) => item.japaneseVoiceActor
    ? [personRef('staff', item.japaneseVoiceActor.anilistId)]
    : []),
])

/** Extracts identities from one bounded Character or Staff page. */
const peoplePageRefs = (
  row: Doc<'animeDetailPeoplePages'>,
): CatalogProviderRef[] => boundedRefs([
  animeRef(row.anilistId),
  ...row.items.flatMap((item): CatalogProviderRef[] => {
    if (row.kind === 'characters' && 'japaneseVoiceActor' in item) {
      return [
        personRef('character', item.anilistId),
        ...(item.japaneseVoiceActor
          ? [personRef('staff', item.japaneseVoiceActor.anilistId)]
          : []),
      ]
    }
    return [personRef('staff', item.anilistId)]
  }),
])

/** Extracts one person and any bounded voice-actor references. */
const personDetailRefs = (
  row: Doc<'catalogPersonDetails'>,
): CatalogProviderRef[] => boundedRefs([
  personRef(row.kind, row.personId),
  ...(row.detail.kind === 'character'
    ? (row.detail.voiceActors ?? []).map((actor) => personRef('staff', actor.id))
    : []),
])

/** Extracts one person and bounded Anime work references. */
const personWorkRefs = (
  row: Doc<'catalogPersonWorkPages'>,
): CatalogProviderRef[] => boundedRefs([
  personRef(row.kind, row.personId),
  ...row.items.map((item) => animeRef(item.animeId)),
])

/** Paginates exactly one source table and extracts only that returned page. */
const paginateIdentityLane = async (
  ctx: MutationCtx,
  lane: CatalogIdentityLane,
  paginationOpts: PaginationOptions,
): Promise<IdentityPage> => {
  if (lane === 'anime-summaries') {
    const page = await ctx.db.query('animeSummaries').paginate(paginationOpts)
    return { ...page, processedCount: page.page.length, refs: page.page.map((row) => animeRef(row.anilistId)) }
  }
  if (lane === 'anime-details') {
    const page = await ctx.db.query('animeDetails').paginate(paginationOpts)
    return { ...page, processedCount: page.page.length, refs: page.page.flatMap(detailRefs) }
  }
  if (lane === 'anime-people-pages') {
    const page = await ctx.db.query('animeDetailPeoplePages').paginate(paginationOpts)
    return { ...page, processedCount: page.page.length, refs: page.page.flatMap(peoplePageRefs) }
  }
  if (lane === 'catalog-person-details') {
    const page = await ctx.db.query('catalogPersonDetails').paginate(paginationOpts)
    return { ...page, processedCount: page.page.length, refs: page.page.flatMap(personDetailRefs) }
  }
  if (lane === 'catalog-person-work-pages') {
    const page = await ctx.db.query('catalogPersonWorkPages').paginate(paginationOpts)
    return {
      ...page,
      processedCount: page.page.length,
      refs: page.page.flatMap(personWorkRefs),
    }
  }
  if (lane === 'user-anime-entries') {
    const page = await ctx.db.query('userAnimeEntries').paginate(paginationOpts)
    return { ...page, processedCount: page.page.length, refs: page.page.map((row) => animeRef(row.anilistId)) }
  }
  if (lane === 'anime-rewatches') {
    const page = await ctx.db.query('animeRewatchEntries').paginate(paginationOpts)
    return { ...page, processedCount: page.page.length, refs: page.page.map((row) => animeRef(row.anilistId)) }
  }
  if (lane === 'anime-milestones') {
    const page = await ctx.db.query('animeMilestones').paginate(paginationOpts)
    return { ...page, processedCount: page.page.length, refs: page.page.map((row) => animeRef(row.anilistId)) }
  }
  if (lane === 'reviews') {
    const page = await ctx.db.query('reviews').paginate(paginationOpts)
    return { ...page, processedCount: page.page.length, refs: page.page.map((row) => animeRef(row.anilistId)) }
  }
  if (lane === 'feed-cards') {
    const page = await ctx.db.query('feedCards').paginate(paginationOpts)
    return {
      ...page,
      processedCount: page.page.length,
      refs: page.page.flatMap((row) => row.anilistId === undefined ? [] : [animeRef(row.anilistId)]),
    }
  }
  const page = await ctx.db.query('animeReviewStats').paginate(paginationOpts)
  return { ...page, processedCount: page.page.length, refs: page.page.map((row) => animeRef(row.anilistId)) }
}

/** Ensures each page tuple once and reports retry-safe creation counts. */
const ensureCatalogEntities = async (
  ctx: MutationCtx,
  refs: CatalogProviderRef[],
): Promise<IdentityCounts> => {
  let createdCount = 0
  let existingCount = 0
  for (const ref of uniqueRefs(refs)) {
    const current = await resolveProviderRef(ctx, ref)
    if (current) {
      existingCount += 1
      continue
    }
    await ensureCatalogEntity(ctx, ref)
    createdCount += 1
  }
  return { createdCount, existingCount, missingCount: 0, conflictCount: 0 }
}

/** Checks indexed mappings independently without creating missing rows. */
const verifyCatalogEntities = async (
  ctx: MutationCtx,
  refs: CatalogProviderRef[],
): Promise<IdentityCounts> => {
  let existingCount = 0
  let missingCount = 0
  for (const ref of uniqueRefs(refs)) {
    const rows = await ctx.db
      .query('catalogProviderRefs')
      .withIndex('by_provider_kind_id', (q) => q
        .eq('provider', ref.provider)
        .eq('kind', ref.kind)
        .eq('providerId', ref.providerId))
      .take(2)
    if (rows.length === 0) {
      missingCount += 1
      continue
    }
    if (rows.length !== 1) {
      throw new CatalogIdentityMigrationError(
        'CATALOG_PROVIDER_REF_CONFLICT',
        `Provider tuple ${ref.provider}:${ref.kind}:${ref.providerId} has multiple mappings.`,
      )
    }
    const mapping = rows[0]
    const entity = await ctx.db.get('catalogEntities', mapping.entityId)
    if (!entity || entity.kind !== ref.kind) {
      throw new CatalogIdentityMigrationError(
        'CATALOG_ENTITY_KIND_CONFLICT',
        `Provider tuple ${ref.provider}:${ref.kind}:${ref.providerId} points to a missing or mismatched entity.`,
      )
    }
    const entityRefs = await ctx.db
      .query('catalogProviderRefs')
      .withIndex('by_entity_provider', (q) => q
        .eq('entityId', mapping.entityId)
        .eq('provider', ref.provider))
      .take(2)
    if (entityRefs.length !== 1 || entityRefs[0]?._id !== mapping._id) {
      throw new CatalogIdentityMigrationError(
        'CATALOG_ENTITY_PROVIDER_CONFLICT',
        `Catalog entity ${mapping.entityId} does not have exactly one ${ref.provider} reference.`,
      )
    }
    existingCount += 1
  }
  return { createdCount: 0, existingCount, missingCount, conflictCount: 0 }
}

/** Backfills one resumable source-table page with internal-only access. */
export const backfillLane = internalMutation({
  args: { lane: laneValidator, paginationOpts: paginationOptsValidator },
  returns: migrationResultValidator,
  handler: async (ctx, args) => {
    const page = await paginateIdentityLane(ctx, args.lane, args.paginationOpts)
    const refs = boundedPageRefs(page.refs)
    const counts = await ensureCatalogEntities(ctx, refs)
    return {
      lane: args.lane,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      processedCount: page.processedCount,
      ...counts,
    }
  },
})

/** Verifies one resumable source-table page without repairing it. */
export const verifyLane = internalMutation({
  args: { lane: laneValidator, paginationOpts: paginationOptsValidator },
  returns: migrationResultValidator,
  handler: async (ctx, args) => {
    const page = await paginateIdentityLane(ctx, args.lane, args.paginationOpts)
    const refs = boundedPageRefs(page.refs)
    const counts = await verifyCatalogEntities(ctx, refs)
    return {
      lane: args.lane,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      processedCount: page.processedCount,
      ...counts,
    }
  },
})
