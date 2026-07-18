# Catalog Identity Backfill

## Gate

Deploy additive identity schema and internal migration functions first. Stop on deploy error.

Production execution needs separate explicit approval. Do not run these commands against production without it.

Record only lane, cursor, and result counts. Never record secrets or private row data.

## Lanes

Run every lane:

```text
anime-summaries
anime-details
anime-people-pages
catalog-person-details
catalog-person-work-pages
user-anime-entries
anime-rewatches
anime-milestones
reviews
feed-cards
anime-review-stats
```

## Backfill

Start one lane:

```powershell
pnpm exec convex run --deployment dev catalogIdentityMigration:backfillLane '{"lane":"anime-summaries","paginationOpts":{"numItems":50,"cursor":null}}'
```

Pass returned `continueCursor` into next page:

```powershell
pnpm exec convex run --deployment dev catalogIdentityMigration:backfillLane '{"lane":"anime-summaries","paginationOpts":{"numItems":50,"cursor":"RETURNED_CURSOR"}}'
```

Repeat until `isDone: true`. Then run next lane from `cursor: null`.

Require every successful page:

```text
missingCount: 0
conflictCount: 0
```

On page-bound failure, retry same cursor with smaller `paginationOpts.numItems`. On other failure, fix explicit cause. Restart lane from last successful page cursor. Never skip failed page.

## Verify

Verify each lane independently from null cursor:

```powershell
pnpm exec convex run --deployment dev catalogIdentityMigration:verifyLane '{"lane":"anime-summaries","paginationOpts":{"numItems":50,"cursor":null}}'
```

Continue with returned cursor until `isDone: true`. Repeat for all lanes.

Accept only zero `missingCount` and zero `conflictCount` on every page. Any thrown conflict blocks rollout.

## Durable Anime References

Run after every identity lane verifies cleanly. Mapping must already exist. Durable migration never creates Catalog entities or provider references.

Backfill each lane from null cursor:

```text
user-anime-entries
anime-rewatches
anime-milestones
reviews
feed-cards
anime-review-stats
```

```powershell
pnpm exec convex run --deployment dev catalogAnimeDataMigration:backfillAnimeRefs '{"lane":"user-anime-entries","paginationOpts":{"numItems":50,"cursor":null}}'
```

Continue with returned cursor until `isDone: true`. Require no error. `patchedCount` may be positive first pass and must be zero on full rerun.

Missing mapping or conflicting stored `animeId` blocks rollout. Error includes table and document ID. Fix identity data; retry same cursor.

After all six lanes finish, migrate milestone feed keys:

```powershell
pnpm exec convex run --deployment dev catalogAnimeDataMigration:backfillMilestoneSourceKeys '{"paginationOpts":{"numItems":50,"cursor":null}}'
```

Continue to completion. Duplicate target key blocks rollout. Fix duplicate; retry same cursor. Full rerun must report `patchedCount: 0`.

Verify every durable lane:

```powershell
pnpm exec convex run --deployment dev catalogAnimeDataMigration:verifyAnimeRefs '{"lane":"user-anime-entries","paginationOpts":{"numItems":50,"cursor":null}}'
```

Continue each lane to completion. Accept only exact zero counters on every page:

```text
missingAnimeId = 0
mismatchedProviderRef = 0
duplicateUserAnime = 0
duplicateReview = 0
duplicateMilestoneSourceKey = 0
aggregateMismatch = 0
projectionMismatch = 0
```

Any nonzero counter blocks public cutover. Keep legacy `anilistId` fields and indexes in this rollout.
Aggregate verification fails explicitly above 1,000 Public Reviews for one Anime. Do not bypass this bound; add a resumable aggregate verifier before such data exists.

## Production

Blocked until separate explicit approval. After approval, use explicit production deployment forms:

```powershell
pnpm exec convex run --deployment prod catalogIdentityMigration:backfillLane '{"lane":"anime-summaries","paginationOpts":{"numItems":50,"cursor":null}}'
pnpm exec convex run --deployment prod catalogIdentityMigration:verifyLane '{"lane":"anime-summaries","paginationOpts":{"numItems":50,"cursor":null}}'
```

Follow same cursor, page-bound, lane, and zero-count gates. Run identity lanes, durable Anime lanes, milestone source keys, then both verification sets.

## Retention And Rollback

Migration reads source pages and adds identity rows. It never deletes or refetches cache rows.

Rollback application code only. Keep `catalogEntities` and `catalogProviderRefs`; public IDs may already exist in saved or shared URLs.
