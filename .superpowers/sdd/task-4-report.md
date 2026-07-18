# Task 4 Report

Status: DONE_WITH_CONCERNS

## RED

Migration:

```text
pnpm test -- convex/catalogAnimeDataMigration.integration.test.ts
Test Files 1 failed
Tests 3 failed
Cause: Could not find module for "catalogAnimeDataMigration".
```

User Anime dual write:

```text
pnpm test -- convex/userAnime.integration.test.ts -t "dual-writes one existing Anime entity"
Test Files 1 failed
Tests 1 failed
Cause: entry animeId was undefined.
```

Review dual write:

```text
pnpm test -- convex/social.integration.test.ts -t "dual-writes one existing Anime entity to Review"
Test Files 1 failed
Tests 1 failed
Cause: Review animeId was undefined.
```

## Changed Files

- `convex/schema.ts`
- `convex/catalogAnimeDataMigration.ts`
- `convex/catalogAnimeDataMigration.integration.test.ts`
- `convex/userAnime.ts`
- `convex/userAnime.integration.test.ts`
- `convex/reviews.ts`
- `convex/feed.ts`
- `convex/social.integration.test.ts`
- `docs/runbooks/catalog-identity-backfill.md`

`reviewDiscovery.ts`, `reviewDiscoveryPolicy.ts`, `profileReviewPolicy.ts`, and their tests stayed unchanged. They contain no provider Anime equality, source key, or Anime cursor field requiring transitional identity logic.

## Result

- Added optional `animeId` fields and parallel entity indexes. Kept every `anilistId` field and legacy index.
- Existing provider-ID writes resolve existing mapping only. Missing/conflicting mappings fail explicitly. No client path creates identity mappings.
- User entries, rewatches, milestones, Reviews, feed cards, and Review stats dual-write entity and provider IDs.
- Milestone reads accept legacy and entity source keys. New cards use entity source keys.
- Added bounded internal reference backfill, milestone source-key migration, and zero-counter verification.
- Backfill patches only missing refs. Rerun patches zero. Source-key migration refuses duplicate targets.
- Migration preserves bodies, visibility, timestamps, counts, bands, activity state, cursors, ordering fields, and legacy provider data.

## Validation

```text
pnpm test -- convex/catalogAnimeDataMigration.integration.test.ts convex/userAnime.integration.test.ts convex/reviewDiscoveryPolicy.test.ts convex/feedPolicy.test.ts
Test Files 4 passed
Tests 20 passed
```

```text
pnpm test -- convex/social.integration.test.ts
Test Files 1 passed
Tests 26 passed
```

Final affected retest:

```text
pnpm test -- convex/social.integration.test.ts -t "backfills milestone cards idempotently|dual-writes one existing Anime entity to Review"
Test Files 1 passed
Tests 2 passed
```

```text
pnpm exec tsc --noEmit
PASS

git diff --check
PASS
```

No remote Convex command ran.

## Commit

`feat(catalog): migrate durable anime references` (this commit)

## Concerns

- Aggregate verification is bounded to 1,000 Public Reviews per Anime. It fails explicitly above that bound. Runbook requires a resumable aggregate verifier before data reaches that size.
- Production backfill and verification remain blocked pending separate explicit approval.
