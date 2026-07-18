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

After all six backfills finish, verify these durable-reference lanes:

```text
user-anime-entries
anime-rewatches
anime-milestones
reviews
feed-cards
```

```powershell
pnpm exec convex run --deployment dev catalogAnimeDataMigration:verifyAnimeRefs '{"lane":"user-anime-entries","paginationOpts":{"numItems":50,"cursor":null}}'
```

Start each lane with null cursor. Continue with exactly returned cursor; durable checkpoint rejects skipped pages. Terminal zero issues records lane receipt. Accept only exact zero counters:

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

Enumerate every aggregate target through bounded pages:

```powershell
pnpm exec convex run --deployment dev catalogAnimeDataMigration:listReviewAggregateTargets '{"paginationOpts":{"numItems":50,"cursor":null}}'
```

Continue enumeration with exactly returned cursor until `isDone: true`. Record every returned `statsId`; skipping a target blocks rollout.

Verify every returned `statsId` from a null cursor:

```powershell
pnpm exec convex run --deployment dev catalogAnimeDataMigration:verifyReviewAggregate '{"statsId":"STATS_ID","paginationOpts":{"numItems":50,"cursor":null}}'
```

Continue each target with exactly its returned cursor. Aggregate count, rating sum, and bands live in a database checkpoint; callers must not carry or alter them. A changed or skipped cursor fails. Require terminal `aggregateMismatch: 0`, which writes a snapshot receipt for that stats row.

Reset one target only when its continuation rejects because stats changed after the checkpoint, or when its exact continuation cursor was lost:

```powershell
pnpm exec convex run --deployment dev catalogAnimeDataMigration:resetReviewAggregateVerification '{"statsId":"STATS_ID"}'
```

The reset deletes only verification checkpoint and receipt data for that stats row, and invalidates the aggregate-lane receipt. It does not alter Reviews or aggregate stats. After reset, restart that target with `verifyReviewAggregate` and `cursor: null`. Never use reset to bypass a terminal mismatch; repair the Review or stats data first.

After every target has a current receipt, verify the aggregate lane:

```powershell
pnpm exec convex run --deployment dev catalogAnimeDataMigration:verifyAnimeRefs '{"lane":"anime-review-stats","paginationOpts":{"numItems":50,"cursor":null}}'
```

Continue with exactly returned cursor. A missing receipt or a receipt whose Anime, count, rating sum, bands, or stats update time is stale increments `aggregateMismatch` and blocks the lane receipt.

Only after all six lane receipts exist, migrate milestone feed keys:

```powershell
pnpm exec convex run --deployment dev catalogAnimeDataMigration:backfillMilestoneSourceKeys '{"paginationOpts":{"numItems":50,"cursor":null}}'
```

Missing receipt or duplicate target blocks rollout. Fix cause, rerun verification from null cursor, then retry source migration. Full source-key rerun must report `patchedCount: 0`.

Final verification is mandatory after source-key migration: rerun identity verification, verify the first five durable-reference lanes, enumerate and verify every aggregate target, then verify `anime-review-stats`. Require every counter to remain zero. Finally rerun milestone source-key migration and require `patchedCount: 0`.

## Production

Blocked until separate explicit approval. After approval, use explicit production deployment forms:

```powershell
pnpm exec convex run --deployment prod catalogIdentityMigration:backfillLane '{"lane":"anime-summaries","paginationOpts":{"numItems":50,"cursor":null}}'
pnpm exec convex run --deployment prod catalogIdentityMigration:verifyLane '{"lane":"anime-summaries","paginationOpts":{"numItems":50,"cursor":null}}'
```

Production reset also requires that explicit approval and is allowed only for a rejected changed-stats checkpoint or a lost exact cursor:

```powershell
pnpm exec convex run --deployment prod catalogAnimeDataMigration:resetReviewAggregateVerification '{"statsId":"STATS_ID"}'
```

Restart the approved target from null immediately, complete its receipt, then rerun `anime-review-stats` lane verification.

Follow the same cursor, page-bound, lane, and zero-count gates. Exact order:

```text
identity verification
durable-reference verification
enumerate and verify every Review aggregate
anime-review-stats receipt verification
milestone source-key migration
final verification
```

## Retention And Rollback

Migration reads source pages and adds identity rows. It never deletes or refetches cache rows.

Rollback application code only. Keep `catalogEntities` and `catalogProviderRefs`; public IDs may already exist in saved or shared URLs.
