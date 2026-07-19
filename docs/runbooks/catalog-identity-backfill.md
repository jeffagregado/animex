# Catalog Identity Backfill

## Current rollout state

Additive catalog identity and durable-reference migration is verified on Convex `dev`. PublicId server/UI cutover is complete; automated gates plus signed-out and authenticated responsive browser QA pass. Both configured AnimeX QA accounts work. Post-Phase 7 is closed. Production backfill, migration-tool removal, legacy-field removal, and required-field schema tightening are deferred until separate explicit approval. Metadata Image Proxy is untouched and remains unscheduled.

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

If `feed-cards` reports `projectionMismatch > 0`, stop. With explicit deployment-specific data-deletion approval, delete only mismatched derived Review/milestone feed projections:

```powershell
pnpm exec convex run --deployment dev catalogAnimeDataMigration:purgeMismatchedFeedProjections '{"confirm":true,"paginationOpts":{"numItems":50,"cursor":null}}'
```

The purge starts only after terminal `feed-cards` verification proves projection mismatch is the sole issue. Follow each returned repair cursor exactly to terminal. The operator deletes no post, Review, or milestone source row. A premature, skipped-cursor, or post-terminal purge must reject. Restart `feed-cards` verification from null after terminal repair. Production use requires separate explicit production approval even when development deletion was approved.

Enumerate every aggregate target through bounded pages:

```powershell
pnpm exec convex run --deployment dev catalogAnimeAggregateVerification:listReviewAggregateTargets '{"paginationOpts":{"numItems":50,"cursor":null}}'
```

Continue enumeration with exactly returned cursor until `isDone: true`. Record every returned `statsId`; skipping a target blocks rollout.

Verify every returned `statsId` from a null cursor:

```powershell
pnpm exec convex run --deployment dev catalogAnimeAggregateVerification:verifyReviewAggregate '{"statsId":"STATS_ID","paginationOpts":{"numItems":50,"cursor":null}}'
```

Continue each target with exactly its returned cursor. Aggregate count, rating sum, and bands live in a database checkpoint; callers must not carry or alter them. A changed or skipped cursor fails. Require terminal `aggregateMismatch: 0`, which writes a snapshot receipt for that stats row.

Reset one target only when its continuation rejects because stats changed after the checkpoint, or when its exact continuation cursor was lost:

```powershell
pnpm exec convex run --deployment dev catalogAnimeAggregateVerification:resetReviewAggregateVerification '{"statsId":"STATS_ID"}'
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

## Development Evidence

Development deployment verification completed on 2026-07-18:

- Additive schema and functions synced successfully.
- Final identity source rows: summaries `199`, details `64`, Anime people pages `4`, person details `49`, person work pages `13`, user Anime `5`, rewatches `0`, milestones `4`, Reviews `2`, feed cards `6`, Review stats `1`.
- Both full identity verification cycles reached terminal cursors across `140` pages with zero missing mappings and zero conflicts.
- A later Catalog Person biography repair processed `49` person-detail rows with page size `25`, created `24` previously omitted Anime/Character/Staff mappings, and independently verified zero missing mappings and zero conflicts.
- Durable first pass patched user Anime/rewatches/milestones/Reviews/feed/stats as `5/0/4/2/7/1`; full reruns patched zero.
- One stale derived milestone feed card was explicitly deleted after deployment-specific approval and projection-only verification. No Review, Post, or authoritative milestone source row was deleted. Repair rerun deleted zero.
- Final durable verification processed `5/0/4/2/6` rows across the first five lanes with every counter zero.
- One aggregate target and one public Review verified with zero mismatch; the stats lane verified one row with every counter zero.
- Milestone source-key migration patched `4` of `6` feed cards; both required reruns patched zero.
- Final local validation passed `152` test files and `1031` tests, with `2` files and `3` tests skipped; root and Convex TypeScript, client + SSR build, client-boundary scans, Fallow new-only audit, and signed-out responsive browser QA passed.
- Authenticated QA passed with both configured AnimeX accounts. It covered Status, Score, Favorite, Rewatch rollback, Review draft/resume/publish/detail/discovery, Home feed, Profile activity/reviews/favorites, cross-account public Review visibility, and Discover sign-out. Responsive checks at `390×844`, `768×1024`, and `1280×800` found no horizontal overflow, console warning/error, failed app request, hydration symptom, or captured client request containing `anilistId`. QA-created Review/feed data was deleted and modified list state was restored.

## Production

Blocked until separate explicit approval. After approval, use explicit production deployment forms:

```powershell
pnpm exec convex run --deployment prod catalogIdentityMigration:backfillLane '{"lane":"anime-summaries","paginationOpts":{"numItems":50,"cursor":null}}'
pnpm exec convex run --deployment prod catalogIdentityMigration:verifyLane '{"lane":"anime-summaries","paginationOpts":{"numItems":50,"cursor":null}}'
```

Production reset also requires that explicit approval and is allowed only for a rejected changed-stats checkpoint or a lost exact cursor:

```powershell
pnpm exec convex run --deployment prod catalogAnimeAggregateVerification:resetReviewAggregateVerification '{"statsId":"STATS_ID"}'
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
