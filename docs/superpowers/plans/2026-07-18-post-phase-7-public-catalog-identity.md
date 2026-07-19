# Post-Phase 7 Public Catalog Identity Implementation Plan

Status: COMPLETE AND CLOSED. Dev migration verification, additive cutover, automated gates, integrated review, signed-out QA, and authenticated responsive QA pass. Production migration and final schema tightening remain separately gated. Phase 8 remains unstarted.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace client-visible AniList Anime, Character, and Staff IDs with stable AnimeX-owned `publicId` values while preserving existing metadata caches and stored user data.

**Architecture:** Add `catalogEntities` plus provider-reference rows. Serialized `catalogEntities._id` becomes public `publicId`; AniList numeric IDs remain server-only provider/cache keys. Public server functions resolve or materialize identities before returning strict client contracts. Durable user Anime, Review, feed, milestone, rewatch, and aggregate records migrate to AnimeX entity references through additive schema, bounded internal backfills, verification, and cutover. Final schema tightening follows only after separately approved production migration.

**Tech Stack:** TanStack Start server functions and file routes, React 19, TanStack Router/Query, Convex schema/indexes/internal migrations, Zod 4, Vitest, React Testing Library, Fallow, React Doctor.

## Global Constraints

- Run after Phase 7 closure and before Phase 8 implementation.
- Metadata Image Proxy stays optional, unscheduled, and untouched.
- Keep current image URLs, image rendering, metadata TTLs, lease keys, and cache expiration behavior.
- Keep AniList GraphQL server-only. Browser and Convex actions must never call AniList.
- `publicId` is opaque serialized `catalogEntities._id`; never derive provider, entity kind, or title from it.
- Use separate `catalogProviderRefs` rows keyed by provider + entity kind + provider ID.
- Character and Staff provider IDs use separate kind namespaces.
- Keep `anilistId` only in AniList adapters, server-only cache models, provider references, migration code, and server logs that never reach browser.
- Remove `anilistId` from browser contracts, route parameter names, hydrated payloads, public UI props, Convex user mutations/queries, rendered URLs, and client logs.
- Preserve existing `animeSummaries`, `animeDetails`, `animeDetailPeoplePages`, `catalogPersonDetails`, `catalogPersonWorkPages`, Discover section rows, lease rows, timestamps, and cached image URLs.
- Durable user data must migrate without deleting Reviews, drafts, list state, favorites, rewatches, milestones, activities, or aggregates.
- Legacy numeric Anime/Character/Staff URLs must issue one canonical redirect to `publicId` URLs.
- Missing or conflicting identity mappings fail with clear typed errors. No silent provider-ID fallback.
- Use existing packages only. Ask before adding any production dependency.
- Use additive schema, dev deploy, bounded backfill, verification, then public cutover.
- Retain migration functions and legacy durable fields until every target deployment, including production, is separately approved, backfilled, and verified. Required-field schema tightening is outside this execution.
- Do not deploy production or run `npx convex deploy` without explicit approval.
- Preserve unrelated dirty `README.md` work.

---

## Public Contract

```ts
export type CatalogEntityKind = 'anime' | 'character' | 'staff'

export interface CatalogIdentity {
  publicId: string
  kind: CatalogEntityKind
}

export interface AnimeSummary {
  publicId: string
  slug: string
  // Existing display metadata stays unchanged.
}
```

Canonical routes:

```text
/anime/$publicId/$slug
/characters/$publicId/$slug
/staff/$publicId/$slug
/anime/$publicId/$slug/reviews/new
```

Identity flow:

```text
AniList numeric ID
  -> server-only catalogProviderRefs(provider, kind, providerId)
  -> catalogEntities._id
  -> publicId in server response, route, UI, and durable AnimeX references
```

Cache flow:

```text
Existing AniList-keyed cache row
  -> batch indexed provider-reference resolution
  -> strict public response with publicId
```

## File Ownership Map

| Surface | Owned files |
| --- | --- |
| Identity schema/model | `convex/schema.ts`, `convex/catalogIdentityModel.ts`, `convex/catalogIdentity.ts`, identity policy/tests |
| Identity migrations | `convex/catalogIdentityMigration.ts`, migration integration test, migration runbook |
| Metadata cache bridge | `convex/animeCache.ts`, `convex/animeDetailCache.ts`, `convex/catalogPersonCache.ts`, matching policy/integration tests |
| Public identity gateway | `src/features/catalog-identity/{shared,server}`, gateway tests |
| Public metadata contracts | Discover, Anime Detail, Catalog Person, Quick Search shared/server files and tests |
| Durable Anime references | `convex/userAnime.ts`, `convex/reviews.ts`, `convex/reviewDiscovery.ts`, `convex/feed.ts`, profiles and integration tests |
| Routes and UI | Anime/Character/Staff route trees, Anime UI, review UI, feed/profile/discover/quick-search consumers |
| Controller-only integration | `convex/schema.ts`, `convex/_generated/*`, `src/routeTree.gen.ts`, migrations, `PLAN.md`, `TODO.md`, current-state docs |

Shared schema, generated files, route tree, and migration execution stay serialized. No parallel writer may edit these surfaces.

---

## Safe Staged Execution Order

Execute tasks in this order:

```text
Tasks 1-4 additive code
  -> Task 7 additive Convex dev sync, backfill, and verification
  -> Tasks 5-6 public contract and route cutover
  -> Task 8 validation and documentation
```

Do not delete migration tooling or make migrated durable fields required during this execution. Production deployment, production backfill, and final schema tightening require separate explicit approval.

---

### Task 1: Add AnimeX Catalog Identity Registry

**Files:**

- Create: `src/features/catalog-identity/shared/catalog-identity-contracts.ts`
- Create: `src/features/catalog-identity/shared/catalog-identity-contracts.test.ts`
- Create: `convex/catalogIdentityPolicy.ts`
- Create: `convex/catalogIdentityPolicy.test.ts`
- Create: `convex/catalogIdentityModel.ts`
- Create: `convex/catalogIdentity.ts`
- Create: `convex/catalogIdentity.integration.test.ts`
- Modify: `convex/schema.ts`

**Interfaces:**

- Produces: `CatalogEntityKind`, `CatalogPublicId`, `parseCatalogPublicId`.
- Produces: `ensureCatalogEntity(ctx, ref)` and indexed provider/public resolution helpers.
- Produces: token-gated batch `ensureProviderRefs` and `resolveProviderRefs`.
- Consumes: existing `requireCacheWriteToken` server-token boundary.

- [ ] **Step 1: Write failing public-ID contract tests**

```ts
expect(parseCatalogPublicId('jh7abc123')).toBe('jh7abc123')
expect(() => parseCatalogPublicId('52991')).toThrow('CATALOG_PUBLIC_ID_INVALID')
expect(() => parseCatalogPublicId('bad/id')).toThrow('CATALOG_PUBLIC_ID_INVALID')
```

Route parsing rejects positive decimal legacy IDs as canonical `publicId`; route loaders handle those values only through explicit legacy redirect logic.

- [ ] **Step 2: Run contract test and confirm RED**

```powershell
pnpm test -- src/features/catalog-identity/shared/catalog-identity-contracts.test.ts
```

Expected: fail because identity contract module does not exist.

- [ ] **Step 3: Add strict shared contract**

```ts
import { z } from 'zod'

export const catalogEntityKindSchema = z.enum(['anime', 'character', 'staff'])
export type CatalogEntityKind = z.infer<typeof catalogEntityKindSchema>
export type CatalogPublicId = string

const catalogPublicIdSchema = z.string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^(?![1-9]\d*$)[A-Za-z0-9_-]+$/)

export const parseCatalogPublicId = (value: unknown): CatalogPublicId => {
  const result = catalogPublicIdSchema.safeParse(value)
  if (!result.success) {
    throw new RangeError('CATALOG_PUBLIC_ID_INVALID', { cause: result.error })
  }
  return result.data
}
```

- [ ] **Step 4: Add identity tables and indexes**

```ts
catalogEntities: defineTable({
  kind: v.union(v.literal('anime'), v.literal('character'), v.literal('staff')),
  createdAt: v.number(),
  updatedAt: v.number(),
}),
catalogProviderRefs: defineTable({
  entityId: v.id('catalogEntities'),
  provider: v.literal('anilist'),
  kind: v.union(v.literal('anime'), v.literal('character'), v.literal('staff')),
  providerId: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index('by_provider_kind_id', ['provider', 'kind', 'providerId'])
  .index('by_entity_provider', ['entityId', 'provider']),
```

Do not add a second stored `publicId`; `catalogEntities._id` is source of truth.

- [ ] **Step 5: Write failing policy and integration tests**

Cover:

- same `anilist + kind + providerId` returns same entity under retries;
- Character `1` and Staff `1` resolve to different entities;
- one entity cannot acquire mismatched kind;
- one entity cannot acquire two AniList references for same kind;
- invalid, duplicate, over-cap, missing, and conflicting refs fail explicitly;
- batch order matches input order;
- returned `publicId` equals serialized entity ID;
- every registered function has strict args and return validators;
- token missing/mismatch rejects public identity functions.

- [ ] **Step 6: Implement idempotent indexed registry**

Use `withIndex('by_provider_kind_id')`; never scan/filter. Insert `catalogEntities` and matching reference in one mutation. Recheck current mapping before insert so Convex retry/OCC yields one stable entity.

```ts
export type ProviderRef = {
  provider: 'anilist'
  kind: CatalogEntityKind
  providerId: number
}

export const ensureCatalogEntity = async (
  ctx: MutationCtx,
  ref: ProviderRef,
): Promise<Id<'catalogEntities'>> => {
  const current = await ctx.db
    .query('catalogProviderRefs')
    .withIndex('by_provider_kind_id', (q) =>
      q.eq('provider', ref.provider).eq('kind', ref.kind).eq('providerId', ref.providerId))
    .unique()
  if (current) return current.entityId

  const now = Date.now()
  const entityId = await ctx.db.insert('catalogEntities', {
    kind: ref.kind,
    createdAt: now,
    updatedAt: now,
  })
  await ctx.db.insert('catalogProviderRefs', {
    entityId,
    ...ref,
    createdAt: now,
    updatedAt: now,
  })
  return entityId
}
```

- [ ] **Step 7: Run focused tests**

```powershell
pnpm test -- src/features/catalog-identity/shared/catalog-identity-contracts.test.ts convex/catalogIdentityPolicy.test.ts convex/catalogIdentity.integration.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 8: Commit registry**

```powershell
git add src/features/catalog-identity convex/catalogIdentityPolicy.ts convex/catalogIdentityPolicy.test.ts convex/catalogIdentityModel.ts convex/catalogIdentity.ts convex/catalogIdentity.integration.test.ts convex/schema.ts
git commit -m "feat(catalog): add public identity registry"
```

---

### Task 2: Preserve Caches and Attach Identity Creation to Cache Writes

**Files:**

- Modify: `convex/animeCache.ts`
- Modify: `convex/animeCachePolicy.ts`
- Modify: `convex/animeCachePolicy.test.ts`
- Modify: `convex/animeDetailCache.ts`
- Modify: `convex/animeDetailCachePolicy.ts`
- Modify: `convex/animeDetailCachePolicy.test.ts`
- Modify: `convex/catalogPersonCache.ts`
- Modify: `convex/catalogPersonCachePolicy.ts`
- Modify: `convex/catalogPersonCachePolicy.test.ts`
- Modify: `convex/catalogPersonCache.integration.test.ts`
- Create: `convex/animeCache.integration.test.ts`
- Create: `convex/animeDetailCache.integration.test.ts`

**Interfaces:**

- Consumes: `ensureCatalogEntity`.
- Produces: every new/refreshed cached Anime, Character, Staff, voice actor, relation, recommendation, and work Anime has one identity mapping.
- Preserves: all current cache row shapes, AniList-keyed indexes, ordered section IDs, cache leases, and TTL fields.

- [ ] **Step 1: Write failing cache identity tests**

Prove:

- Discover commit registers every unique Anime ID.
- Anime Detail commit registers root Anime, related Anime, recommendations, Characters, Staff, and voice actors.
- People page commit registers every person.
- Catalog Person detail registers person and voice actors.
- Catalog work commit registers person and Anime items.
- duplicate provider IDs within one bounded payload create one mapping.
- cache record fields, `refreshedAt`, `expiresAt`, ordered IDs, and lease deletion remain unchanged.

Use real Convex integration harnesses for `commitSection`, `commitDetail`, and `commitPeoplePage`. Pure policy tests do not satisfy transaction, identity-row, or cache-preservation assertions.

- [ ] **Step 2: Run focused cache tests and confirm RED**

```powershell
pnpm test -- convex/animeCachePolicy.test.ts convex/animeCache.integration.test.ts convex/animeDetailCachePolicy.test.ts convex/animeDetailCache.integration.test.ts convex/catalogPersonCachePolicy.test.ts convex/catalogPersonCache.integration.test.ts
```

Expected: new identity assertions fail.

- [ ] **Step 3: Ensure mappings inside existing commit transactions**

Before each cache upsert, collect bounded unique refs and call `ensureCatalogEntity`.

```ts
const refs = [
  { provider: 'anilist', kind: 'anime', providerId: detail.anilistId },
  ...detail.related.map((item) => ({
    provider: 'anilist' as const,
    kind: 'anime' as const,
    providerId: item.anilistId,
  })),
]
```

Do not change:

```text
animeSummaries.anilistId
animeDetails.anilistId
animeDetailPeoplePages.anilistId
catalogPersonDetails.personId
catalogPersonWorkPages.personId
discoverSectionCache.animeIds
detail:/people:/person:/person-work: lease keys
```

- [ ] **Step 4: Keep identity registration bounded**

Reject payloads beyond current section/detail/person caps before identity writes. Deduplicate refs in memory; no unbounded `.collect()` or table scan.

- [ ] **Step 5: Run focused cache suite**

```powershell
pnpm test -- convex/animeCachePolicy.test.ts convex/animeCache.integration.test.ts convex/animeDetailCachePolicy.test.ts convex/animeDetailCache.integration.test.ts convex/catalogPersonCachePolicy.test.ts convex/catalogPersonCache.integration.test.ts
```

Expected: identity assertions and existing cache invariants pass.

- [ ] **Step 6: Commit cache bridge**

```powershell
git add convex/animeCache.ts convex/animeCachePolicy.ts convex/animeCachePolicy.test.ts convex/animeCache.integration.test.ts convex/animeDetailCache.ts convex/animeDetailCachePolicy.ts convex/animeDetailCachePolicy.test.ts convex/animeDetailCache.integration.test.ts convex/catalogPersonCache.ts convex/catalogPersonCachePolicy.ts convex/catalogPersonCachePolicy.test.ts convex/catalogPersonCache.integration.test.ts
git commit -m "feat(catalog): register identities during cache writes"
```

---

### Task 3: Backfill and Verify Existing Provider Identities

**Files:**

- Create: `convex/catalogIdentityMigration.ts`
- Create: `convex/catalogIdentityMigration.integration.test.ts`
- Create: `docs/runbooks/catalog-identity-backfill.md`
- Modify: `convex/schema.ts` only if migration return types require shared validators

**Interfaces:**

- Produces: internal-only `backfillLane` and `verifyLane`.
- Consumes: indexed/idempotent `ensureCatalogEntity`.
- Produces: explicit cursor, processed count, created count, existing count, missing count, conflict count.

- [ ] **Step 1: Write failing migration tests**

Use these exact lanes:

```ts
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
```

Cover empty tables, one page, resume cursor, idempotent rerun, embedded detail refs, duplicate IDs, kind separation, missing source rows, and conflict failure.

- [ ] **Step 2: Run migration test and confirm RED**

```powershell
pnpm test -- convex/catalogIdentityMigration.integration.test.ts
```

Expected: fail because migration functions do not exist.

- [ ] **Step 3: Implement bounded internal mutations**

```ts
export const backfillLane = internalMutation({
  args: {
    lane: laneValidator,
    paginationOpts: paginationOptsValidator,
  },
  returns: migrationResultValidator,
  handler: async (ctx, args) => {
    const page = await paginateIdentityLane(
      ctx,
      args.lane,
      args.paginationOpts,
    )
    const refs = extractIdentityRefs(args.lane, page.page)
    const result = await ensureCatalogEntities(ctx, refs)

    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      processedCount: page.page.length,
      createdCount: result.createdCount,
      existingCount: result.existingCount,
      missingCount: 0,
      conflictCount: 0,
    }
  },
})
```

No public migration query/mutation/action. No table-filter scan. No swallowed conflict.

- [ ] **Step 4: Implement independent verification**

`verifyLane` paginates same source and checks every extracted ref against `by_provider_kind_id`. Require matching entity kind and exactly one provider reference.

- [ ] **Step 5: Write exact runbook**

Runbook records:

- additive deployment prerequisite;
- one lane/page command;
- repeat with returned cursor until `isDone: true`;
- restart failed lane from last successful cursor;
- verify every lane from null cursor;
- require zero missing/conflict counts;
- cache rows are never deleted/refetched;
- rollback keeps identity rows because IDs may already appear in URLs;
- production execution requires separate approval.

- [ ] **Step 6: Run focused migration tests**

```powershell
pnpm test -- convex/catalogIdentityMigration.integration.test.ts
```

Expected: all lanes, resume, idempotency, and verification pass.

- [ ] **Step 7: Commit migration tooling**

```powershell
git add convex/catalogIdentityMigration.ts convex/catalogIdentityMigration.integration.test.ts docs/runbooks/catalog-identity-backfill.md
git commit -m "chore(catalog): add identity backfill"
```

---

### Task 4: Migrate Durable AnimeX Records to Entity References

**Files:**

- Modify: `convex/schema.ts`
- Modify: `convex/userAnime.ts`
- Modify: `convex/userAnime.integration.test.ts`
- Modify: `convex/reviews.ts`
- Modify: `convex/reviewDiscovery.ts`
- Modify: `convex/reviewDiscoveryPolicy.ts`
- Modify: `convex/profileReviewPolicy.ts`
- Modify: `convex/feed.ts`
- Modify: `convex/feedPolicy.ts`
- Modify: matching Review/feed/profile integration tests
- Create: `convex/catalogAnimeDataMigration.ts`
- Create: `convex/catalogAnimeDataMigration.integration.test.ts`
- Modify: `docs/runbooks/catalog-identity-backfill.md`

**Interfaces:**

- Produces transitional optional `animeId: Id<'catalogEntities'>` fields and entity-based indexes.
- Preserves old `anilistId` fields/indexes until verified cutover.
- Produces final AnimeX-owned keys for user entries, rewatches, milestones, Reviews, feed cards, and Review stats.

- [ ] **Step 1: Write failing additive-schema migration tests**

Cover:

- user Anime entry maps to one Anime entity;
- rewatch and milestone match same entity;
- Review and aggregate match same entity;
- Review feed card matches Review entity;
- milestone feed source key migrates from provider number to entity ID;
- rerun patches nothing;
- conflict or missing mapping fails with exact document/table evidence;
- owner, visibility, timestamps, ordering keys, cursors, activity state, counts, bands, and Review bodies remain unchanged.

- [ ] **Step 2: Add optional entity fields and parallel indexes**

```ts
animeId: v.optional(v.id('catalogEntities'))

.index('by_user_anime_entity', ['userId', 'animeId'])
```

Add the field and index inside the existing `userAnimeEntries` definition. Keep its `anilistId`, domain fields, and `by_user_anime` index unchanged during the additive stage.

Apply the same additive pattern to:

```text
animeRewatchEntries
animeMilestones
reviews
feedCards
animeReviewStats
```

- [ ] **Step 3: Add dual-write compatibility**

Existing provider-ID call paths resolve mapping and write both fields. New entity-based helpers become source for indexes and equality checks after backfill. Old source keys remain readable during this stage.

- [ ] **Step 4: Implement bounded data backfill**

`backfillAnimeRefs` patches only missing `animeId`. `backfillMilestoneSourceKeys` runs after every milestone/card has `animeId`, accepts legacy/new keys during transition, and refuses duplicate target keys.

New milestone source key:

```ts
const sourceKey = `${milestone.kind}:${milestone.userId}:${milestone.animeId}`
```

Review source keys remain `review:${reviewId}`.

- [ ] **Step 5: Implement verification**

Require:

```text
missingAnimeId = 0
mismatchedProviderRef = 0
duplicateUserAnime = 0
duplicateReview = 0
duplicateMilestoneSourceKey = 0
aggregateMismatch = 0
projectionMismatch = 0
```

- [ ] **Step 6: Run focused durable-data tests**

```powershell
pnpm test -- convex/catalogAnimeDataMigration.integration.test.ts convex/userAnime.integration.test.ts convex/reviewDiscoveryPolicy.test.ts convex/feedPolicy.test.ts
```

Expected: migration and existing behavior pass.

- [ ] **Step 7: Commit additive durable migration**

```powershell
git add convex/schema.ts convex/userAnime.ts convex/reviews.ts convex/reviewDiscovery.ts convex/reviewDiscoveryPolicy.ts convex/profileReviewPolicy.ts convex/feed.ts convex/feedPolicy.ts convex/catalogAnimeDataMigration.ts convex/catalogAnimeDataMigration.integration.test.ts convex/userAnime.integration.test.ts docs/runbooks/catalog-identity-backfill.md
git commit -m "feat(catalog): migrate durable anime references"
```

---

### Task 5: Split Provider Models from Public Browser Contracts

**Files:**

- Create: `src/features/catalog-identity/server/catalog-identity.server.ts`
- Create: `src/features/catalog-identity/server/catalog-identity.server.test.ts`
- Create: server-only provider/cache contract modules for Discover, Anime Detail, and Catalog Person
- Modify: `src/features/discover/shared/discover-contracts.ts`
- Modify: `src/features/discover/shared/discover-contracts.test.ts`
- Create: `src/features/discover/server/anilist-normalization.server.ts`
- Create: `src/features/discover/server/anilist-normalization.server.test.ts`
- Modify: `src/features/discover/server/anilist.server.ts`
- Modify: `src/features/discover/server/discover-cache.server.ts`
- Modify: `src/features/discover/server/discover.functions.ts`
- Modify: `src/features/anime-detail/shared/anime-detail-contracts.ts`
- Modify: `src/features/anime-detail/server/anilist-detail.server.ts`
- Modify: `src/features/anime-detail/server/anime-detail-cache.server.ts`
- Modify: `src/features/anime-detail/server/anime-detail.functions.ts`
- Modify: `src/features/catalog-person/shared/catalog-person-contracts.ts`
- Modify: `src/features/catalog-person/server/anilist-person.server.ts`
- Modify: `src/features/catalog-person/server/catalog-person-cache.server.ts`
- Modify: `src/features/catalog-person/server/catalog-person.functions.ts`
- Modify: `src/features/quick-search/shared/quick-search-contracts.ts`
- Modify: `src/features/quick-search/server/anilist-quick-search.server.ts`
- Modify: `src/features/quick-search/server/quick-search.functions.ts`
- Modify: `convex/catalogIdentity.ts`
- Modify: `convex/catalogIdentityModel.ts`
- Modify: `convex/animeCache.ts`
- Modify: `convex/animeDetailCache.ts`
- Modify: `convex/catalogPersonCache.ts`
- Modify: `convex/catalogPersonCachePolicy.ts`
- Modify: matching server/shared tests

**Interfaces:**

- Public types expose `publicId`.
- Provider/cache types retain `anilistId` only in `.server.ts` and Convex cache modules.
- `ensurePublicIds(refs)` materializes live search identities once per bounded response.
- `resolvePublicIds(refs)` batch-resolves cache results without writes.
- `resolveProviderByPublicId({ publicId, kind })` is token-gated and server-only.
- Raw Convex cache reads require the server cache token; browsers cannot read provider/cache DTOs directly.

Execute Task 5 in this order:

```text
5A provider/cache model isolation
5B identity gateway and raw-cache security
5C Discover + 5D Quick Search + 5E Anime Detail + 5F Catalog Person
Task 5 integrated review
```

Only the four metadata lanes may run in parallel, and only after 5A and 5B release their contracts.

- [ ] **Step 1: Write failing strict public-contract tests**

```ts
const summary = {
  publicId: 'jh7abc123',
  slug: 'frieren',
  // existing display fields
}

expect(animeSummarySchema.parse(summary)).toEqual(summary)
expect(() => animeSummarySchema.parse({ ...summary, anilistId: 52991 })).toThrow()
```

Apply strict rejection to Anime Detail root/list/people/voice actors, Catalog Person detail/work/search, Quick Search rows, profile favorites, social Anime, Review outputs, and feed outputs.

Also reject every digit-only canonical `publicId`, including `0` and leading-zero values. Only positive safe decimal route segments without leading zeros enter explicit legacy redirect resolution.

- [ ] **Step 2: Run focused contract tests and confirm RED**

```powershell
pnpm test -- src/features/discover/shared/discover-contracts.test.ts src/features/anime-detail/shared/anime-detail-contracts.test.ts src/features/catalog-person/shared/catalog-person-contracts.test.ts src/features/quick-search/shared/quick-search-contracts.test.ts
```

Expected: public models still require numeric provider IDs.

- [ ] **Step 3: Move provider normalization behind server-only modules**

`normalizeAnimeSummary` and provider schemas move from shared browser contracts to `anilist-normalization.server.ts`. Public shared modules retain display types, slugs, filters, tabs, and `publicId` validators only.

Complete provider/cache isolation before public schema edits. Convex cache validators and storage DTOs must import server/cache-owned provider contracts, never browser-public DTOs. Preserve every stored cache shape, key, TTL, lease, and refresh behavior.

- [ ] **Step 4: Add one indexed identity round trip per response**

```ts
const refs = providerItems.map((item) => ({
  provider: 'anilist' as const,
  kind: 'anime' as const,
  providerId: item.anilistId,
}))
const identities = await identity.ensurePublicIds(refs)
```

Use `ensurePublicIds` for uncached Discover, Quick Search, Character search, and Staff search. Use `resolvePublicIds` for cache reads after Task 3 verification. Missing cache mapping throws `CATALOG_IDENTITY_MISSING`; it does not refetch or expose provider ID.

Add a token-gated reverse resolver for canonical public routes and provider-backed cache reads. It validates the requested entity kind and returns provider data only to server modules. Public route helpers return `publicId`, kind, source, and safe status only. Sanitize provider tuples and numeric IDs from browser errors.

Token-gate the existing raw cache reads in `animeCache`, `animeDetailCache`, and `catalogPersonCache`; all current callers are server modules and must pass the server cache token.

- [ ] **Step 5: Map nested Anime Detail identities**

Convert root Anime, related Anime, recommendations, Characters, Staff, and voice actors to `publicId`. Deduplicate pagination by `publicId`.

- [ ] **Step 6: Rewrite biography entity links server-side**

Extract supported AniList Anime/Character/Staff links from provider biography text, batch ensure their mappings, and rewrite targets to AnimeX `publicId` routes before returning `CatalogPersonDetail`. Client renderer accepts AnimeX internal paths or safe external HTTP(S) links; it no longer parses AniList numeric URLs.

- [ ] **Step 7: Return strict public search rows**

Quick Search row `id` equals `publicId`. Destination builders accept opaque IDs:

```ts
type QuickSearchDestinationInput =
  | { kind: 'anime'; publicId: string; slug: string }
  | { kind: 'character'; publicId: string; label: string }
  | { kind: 'staff'; publicId: string; label: string }
```

- [ ] **Step 8: Run server/shared tests**

```powershell
pnpm test -- src/features/catalog-identity src/features/discover src/features/anime-detail/server src/features/anime-detail/shared src/features/catalog-person/server src/features/catalog-person/shared src/features/quick-search/server src/features/quick-search/shared
```

Expected: strict public outputs contain `publicId`; provider models remain server-only.

- [ ] **Step 9: Commit contract boundary**

```powershell
git add src/features/catalog-identity src/features/discover src/features/anime-detail src/features/catalog-person src/features/quick-search
git commit -m "feat(catalog): expose public ids from server boundaries"
```

---

### Task 6: Cut Routes, UI, Reviews, Feed, and Profile to `publicId`

**Files:**

- Move: `src/routes/_public/anime/$anilistId/*` to `src/routes/_public/anime/$publicId/*`
- Move: `src/routes/_public/_protected/anime/$anilistId/*` to `src/routes/_public/_protected/anime/$publicId/*`
- Move: `src/routes/_public/characters/$id/*` to `src/routes/_public/characters/$publicId/*`
- Move: `src/routes/_public/staff/$id/*` to `src/routes/_public/staff/$publicId/*`
- Modify: `src/routes/_public/anime/-anime-route.test.ts`
- Modify: `src/routes/_public/-catalog-person-route.test.ts`
- Modify: `src/features/anime-detail/ui/*`
- Modify: `src/features/catalog-person/ui/*`
- Modify: `src/features/discover/ui/*`
- Modify: `src/features/quick-search/ui/*`
- Modify: `src/features/reviews/ui/*`
- Modify: `src/features/reviews/shared/*`
- Modify: `src/features/feed/*`
- Modify: `src/features/social/shared/social-contracts.ts`
- Modify: `src/features/profile/shared/profile-contracts.ts`
- Modify: `src/features/profile/ui/*`
- Modify: `src/routeTree.gen.ts` through route generation only
- Modify: affected tests

**Interfaces:**

- Canonical route/query keys use `publicId`.
- Legacy decimal params resolve server-side, then replace to canonical path.
- User Anime and Review Convex functions accept `animeId: v.id('catalogEntities')`.
- Review detail IDs and user profile IDs remain unchanged.

Execute Task 6 in this order:

```text
6A durable/social Convex API cutover
6B Anime + Reviews | 6C Feed + Profile + Home | 6D Catalog + Search browser consumers
6E serialized route-tree cutover and one route generation
Task 6 integrated review
```

Only the three browser-consumer lanes may run in parallel. Shared public contracts release from 6A first. The controller owns route moves, `src/routeTree.gen.ts`, and generated Convex files.

- [ ] **Step 1: Write failing route tests**

Cover:

```text
/anime/52991/frieren -> 301/302-style app redirect to /anime/jh7abc123/frieren
/characters/12/frieren -> canonical Character publicId URL
/staff/21/atsumi-tanezaki -> canonical Staff publicId URL
missing/stale slug -> canonical publicId + current title slug
invalid opaque ID -> explicit not-found/error state
legacy Staff ?tab=works -> publicId URL with ?tab=anime
Review editor stale slug -> publicId Review editor URL
```

Route logic must not mount provider/cache queries with decimal legacy IDs before redirect resolution.

- [ ] **Step 2: Run route tests and confirm RED**

```powershell
pnpm test -- src/routes/_public/anime/-anime-route.test.ts src/routes/_public/-catalog-person-route.test.ts
```

Expected: current route params and destinations use numeric IDs.

- [ ] **Step 3: Rename route trees and regenerate**

```powershell
pnpm exec tsr generate
```

Expected generated paths use `$publicId`; no `$anilistId` route remains.

- [ ] **Step 4: Update UI identity props and keys**

Replace public/browser `anilistId`/numeric `id` props with `publicId`. Use `publicId` for React keys, dedupe sets, TanStack Query keys, hrefs, and mutation inputs.

```tsx
<AnimeUserControls animeId={detail.publicId} canonicalPath={canonicalPath} />
```

- [ ] **Step 5: Cut durable Convex APIs to entity IDs**

Final public args:

```ts
args: { animeId: v.id('catalogEntities') }
```

Use entity indexes for user Anime, Reviews, milestones, rewatches, aggregates, feed projection, profile favorites, and discovery. Provider/cache lookup happens only when display metadata is required.

- [ ] **Step 6: Preserve behavior and UI**

Keep layout, copy, tabs, pagination, accessibility, responsive rules, auth guards, owner checks, Review behavior, feed ranking, visibility, activity behavior, and image URLs unchanged.

- [ ] **Step 7: Run focused UI/route tests**

```powershell
pnpm test -- src/routes/_public src/features/anime-detail/ui src/features/catalog-person/ui src/features/discover/ui src/features/quick-search/ui src/features/reviews/ui src/features/feed src/features/profile/ui
```

Expected: canonical/legacy navigation and existing UI behavior pass.

- [ ] **Step 8: Commit route/UI cutover**

```powershell
git add src/routes src/routeTree.gen.ts src/features
git commit -m "feat(catalog): route client surfaces by public id"
```

---

### Task 7: Execute Additive Dev Migration and Retain Migration Tooling

**Files:**

- Modify: `convex/schema.ts`
- Modify: `convex/userAnime.ts`
- Modify: `convex/reviews.ts`
- Modify: `convex/reviewDiscovery.ts`
- Modify: `convex/feed.ts`
- Modify: affected tests
- Retain: `convex/catalogIdentityMigration.ts`
- Retain: `convex/catalogIdentityMigration.integration.test.ts`
- Retain: `convex/catalogAnimeDataMigration.ts`
- Retain: `convex/catalogAnimeDataMigration.integration.test.ts`
- Retain: `convex/catalogAnimeAggregateVerification.ts`
- Retain: `convex/catalogAnimeAggregateVerification.integration.test.ts`
- Modify: `docs/runbooks/catalog-identity-backfill.md`
- Regenerate: `convex/_generated/*`

**Interfaces:**

- Dev durable rows have verified AnimeX entity references.
- Cache/provider tables retain server-only AniList IDs.
- Final public functions contain no provider-ID args or returns.
- Transitional durable fields remain additive until separately approved production backfill and tightening.

- [x] **Step 1: Push additive schema and functions to Convex dev**

```powershell
pnpm exec convex dev --once
```

Expected: successful migration-safe dev sync. Stop on schema/function error.

- [x] **Step 2: Backfill every identity lane**

Start each lane with:

```powershell
pnpm exec convex run --deployment dev catalogIdentityMigration:backfillLane '{"lane":"anime-summaries","paginationOpts":{"numItems":50,"cursor":null}}'
```

Repeat with each returned cursor until `isDone: true`, then repeat for every lane named in Task 3.

- [x] **Step 3: Verify every identity lane**

```powershell
pnpm exec convex run --deployment dev catalogIdentityMigration:verifyLane '{"lane":"anime-summaries","paginationOpts":{"numItems":50,"cursor":null}}'
```

Require zero missing/conflict/mismatch counts for every lane.

- [x] **Step 4: Backfill durable Anime references**

Run each `catalogAnimeDataMigration` lane from null cursor to `isDone: true`. Rerun every lane once and require zero patches. Do not migrate milestone source keys yet.

- [x] **Step 5: Verify durable data**

Use this exact order:

1. Verify the first five durable lanes to terminal zero counters.
2. Enumerate every aggregate target through `catalogAnimeAggregateVerification:listReviewAggregateTargets`.
3. Verify every target through `catalogAnimeAggregateVerification:verifyReviewAggregate`, following its database-owned cursor.
4. Verify the `anime-review-stats` lane to create its terminal receipt.

Require zero values for every Task 4 verification counter. Record only counts/cursors; never record credentials or private Review/profile content.

- [x] **Step 6: Migrate milestone source keys**

Run `catalogAnimeDataMigration:backfillMilestoneSourceKeys` only after all six durable lane receipts exist. Rerun from null cursor and require zero patches. Run final durable verification and require terminal zero counters.

- [x] **Step 7: Run migration-focused regression**

```powershell
pnpm test -- convex/catalogIdentity.integration.test.ts convex/catalogIdentityMigration.integration.test.ts convex/catalogAnimeDataMigration.integration.test.ts convex/catalogAnimeAggregateVerification.integration.test.ts convex/userAnime.integration.test.ts
```

Expected: registry, migration reruns, and additive durable model pass against verified dev data shape.

- [x] **Step 8: Run post-backfill identity and domain regression**

```powershell
pnpm test -- convex/catalogIdentity.integration.test.ts convex/catalogIdentityMigration.integration.test.ts convex/catalogAnimeDataMigration.integration.test.ts convex/catalogAnimeAggregateVerification.integration.test.ts convex/userAnime.integration.test.ts convex/feedMilestones.integration.test.ts convex/reviewDiscoveryPolicy.test.ts convex/feedPolicy.test.ts
```

Expected: registry, retained migration tooling, and additive durable model pass.

- [x] **Step 9: Record dev migration evidence and commit generated state**

Update runbook with exact dev lane counts, terminal cursors, rerun results, and zero-mismatch verification. Do not record credentials or private Review/profile content.

```powershell
git add convex docs/runbooks/catalog-identity-backfill.md
git commit -m "chore(catalog): verify additive identity migration"
```

After this task passes, release public-contract and route cutover work in Tasks 5 and 6. Production deployment, production backfill, migration deletion, legacy-field removal, and required-field tightening remain blocked pending separate approval.

---

### Task 8: Documentation, Review, and Full Validation

**Files:**

- Modify: `PLAN.md`
- Modify: `TODO.md`
- Modify after implementation: `CONTEXT.md`
- Modify: `docs/architecture/anime-detail-data-flow.md`
- Modify: `docs/architecture/discover-data-flow.md`
- Modify: `docs/architecture/catalog-person-data-flow.md`
- Modify: `docs/architecture/quick-search-data-flow.md`
- Modify: `docs/architecture/profile-data-flow.md`
- Modify: `docs/architecture/review-discovery-data-flow.md`
- Modify: `docs/runbooks/catalog-identity-backfill.md`

**Interfaces:**

- Current-state docs identify public identity, provider/cache identity, migration result, error path, and owner modules.
- Optional image proxy remains separate and unscheduled.

- [ ] **Step 1: Update current-state docs after code stabilizes**

Document:

- entry routes and `publicId`;
- validation and legacy redirect;
- provider-reference resolution;
- cache preservation and unchanged TTL/lease keys;
- live-search identity materialization;
- durable entity references;
- retry/error behavior;
- migration counts and verification;
- server/client boundary;
- owner modules.

Remove stale claims that AniList IDs are canonical public identity. Keep AniList as canonical external provider reference.

- [ ] **Step 2: Run full automated suite**

```powershell
pnpm test
pnpm exec tsc --noEmit
pnpm build
```

Expected: all tests, TypeScript, client build, and SSR build pass. Existing chunk warning may remain; report it unchanged.

- [ ] **Step 3: Run client-boundary scans**

```powershell
Get-ChildItem -Path '.output/public' -Recurse -File | Select-String -Pattern 'anilistId|graphql\.anilist\.co'
```

Expected: no match.

```powershell
rg -n --glob '!*.test.*' --glob '!src/routeTree.gen.ts' 'anilistId' src/features src/routes
```

Expected: matches only in `.server.ts` provider/cache implementation files; no shared/UI/route match.

- [ ] **Step 4: Run Fallow**

```powershell
pnpm exec fallow audit --base 23c2d27 --format json --quiet
```

Expected: no introduced dead-code, complexity, duplication, architecture, or styling failure.

- [ ] **Step 5: Run React Doctor**

```powershell
npx react-doctor@latest --verbose --scope changed
```

Expected: no new error and no score regression from execution baseline.

- [ ] **Step 6: Run integrated review**

Require PASS for:

- mapping uniqueness/kind isolation;
- bounded indexed writes/reads;
- no client provider IDs;
- no cache invalidation;
- migration safety/idempotency;
- Review/feed aggregate integrity;
- legacy redirect correctness;
- auth/visibility preservation;
- no image-proxy work;
- no unrelated `README.md` change.

- [x] **Step 7: Run responsive browser QA**

Check 390×844, 768×1024, and 1280×800:

- Discover rails/search;
- Quick Search Anime/Character/Staff destinations;
- dedicated Character/Staff search;
- Anime detail, Characters, Staff, related/recommendations;
- Character voice actor links and biography entity links;
- signed-in Status/Score/Favorite/Rewatch;
- Review create/detail/discovery;
- Home feed and Profile favorites/activity;
- legacy numeric URLs redirect once;
- refresh/back/forward preserve canonical public URL;
- no horizontal overflow;
- no console error, failed app request, hydration warning, or client payload containing `anilistId`.

- [x] **Step 8: Close trackers**

Mark this implementation complete only after dev migration verification, additive schema sync, review PASS, automated gates, and browser QA pass. Keep production migration/final tightening and Phase 8 unstarted.

- [x] **Step 9: Commit docs**

```powershell
git add PLAN.md TODO.md CONTEXT.md docs/architecture docs/runbooks/catalog-identity-backfill.md
git commit -m "docs(catalog): record public identity flow"
```

---

## Rollback

Before public cutover:

- revert app/schema code;
- keep `catalogEntities` and `catalogProviderRefs`;
- retain cache and durable records;
- do not delete identity rows because rerun must preserve generated IDs.

After public URLs ship:

- keep identity rows permanently;
- rollback public rendering by resolving `publicId` back to provider refs server-side;
- do not restore provider IDs as canonical client URLs;
- do not clear caches;
- do not reverse durable data migration unless verified backup/restore plan exists.

## Completion Checklist

- [x] Anime, Character, and Staff canonical URLs use `publicId`.
- [x] Public shared contracts contain no `anilistId`.
- [x] Client build contains no `anilistId` or AniList GraphQL endpoint.
- [x] AniList IDs remain available server-side for provider fetch/cache.
- [x] Existing metadata cache rows and TTLs remain intact.
- [x] Durable AnimeX data uses entity references.
- [x] Every dev migration lane completes and verifies with zero mismatch.
- [x] Migration tooling and legacy durable fields remain available for separately approved production rollout.
- [x] Legacy numeric links redirect once to stable canonical URLs.
- [x] Image proxy remains untouched.
- [x] Full tests, TypeScript, build, Fallow, React Doctor, review, and browser QA pass.
- [x] Production migration and final schema tightening remain unstarted until explicit approval.
- [x] Phase 8 remains unstarted until explicit approval.
