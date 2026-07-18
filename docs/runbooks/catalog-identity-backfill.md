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
pnpm exec convex run catalogIdentityMigration:backfillLane '{"lane":"anime-summaries","paginationOpts":{"numItems":50,"cursor":null}}'
```

Pass returned `continueCursor` into next page:

```powershell
pnpm exec convex run catalogIdentityMigration:backfillLane '{"lane":"anime-summaries","paginationOpts":{"numItems":50,"cursor":"RETURNED_CURSOR"}}'
```

Repeat until `isDone: true`. Then run next lane from `cursor: null`.

Require every successful page:

```text
missingCount: 0
conflictCount: 0
```

On failure, fix explicit cause. Restart lane from last successful page cursor. Never skip failed page.

## Verify

Verify each lane independently from null cursor:

```powershell
pnpm exec convex run catalogIdentityMigration:verifyLane '{"lane":"anime-summaries","paginationOpts":{"numItems":50,"cursor":null}}'
```

Continue with returned cursor until `isDone: true`. Repeat for all lanes.

Accept only zero `missingCount` and zero `conflictCount` on every page. Any thrown conflict blocks rollout.

## Retention And Rollback

Migration reads source pages and adds identity rows. It never deletes or refetches cache rows.

Rollback application code only. Keep `catalogEntities` and `catalogProviderRefs`; public IDs may already exist in saved or shared URLs.
