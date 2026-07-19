# Post-Phase 7 Quality Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` when this plan is handed to another task.

**Goal:** Remove the current Fallow blockers and React Doctor error without changing AnimeX behavior, cache contracts, provider identifiers, publicId routing, or migration results.

**Architecture:** Keep public and provider contracts separate. Consolidate only structurally identical Anime date/title schemas. Replace complex orchestration branches with small typed helpers while retaining the same reads, writes, errors, cursors, receipts, and retry behavior.

**Tech Stack:** TypeScript, React, TanStack Start, Convex, Zod, Vitest, React Doctor, Fallow.

**Status:** COMPLETE on `jeff-cx/post-phase-7-cleanup`.

## Constraints

- No dependency, schema, route, cache-key, or UI changes.
- No `.env` or credential access.
- Preserve every migration cursor, receipt, counter, error code, and deletion boundary.
- Use existing integration tests; add coverage only if a behavior boundary is not already exercised.
- Run Convex sync before browser QA because Convex source changes are in scope.

## Task 1: Contracts and Discover render safety

**Files:**

- Create: `src/features/discover/shared/anime-metadata-contracts.ts`
- Modify: `src/features/discover/shared/discover-contracts.ts`
- Modify: `src/features/discover/server/discover-provider-cache-contracts.server.ts`
- Modify: `src/features/anime-detail/shared/anime-detail-contracts.ts`
- Modify: `src/features/anime-detail/server/anime-detail-provider-cache-contracts.server.ts`
- Modify: `src/features/catalog-person/server/catalog-person-provider-cache-contracts.server.ts`
- Modify: `src/features/discover/ui/discover-search-results.tsx`
- Test: `src/features/discover/ui/discover-search-results.test.tsx`

**Steps:**

1. Move the identical `AnimeDate` and `AnimeTitles` types and schemas into one shared browser-safe module.
2. Re-export existing public types so consumer imports stay compatible.
3. Remove the three dead public symbols reported by Fallow.
4. Move `nextPageGuard` reset from render into an effect keyed by the serialized search state.
5. Run:

```powershell
pnpm test -- src/features/discover/ui/discover-search-results.test.tsx
pnpm exec tsc --noEmit
```

## Task 2: Server read-path helpers

**Files:**

- Modify: `src/features/catalog-person/server/catalog-person-public.server.ts`
- Modify: `src/features/discover/server/discover-cache.server.ts`
- Modify: `convex/feed.ts`
- Modify: `convex/reviews.ts`
- Modify: `convex/userAnime.ts`

**Steps:**

1. Separate biography URL parsing, provider-kind parsing, and provider-ID validation.
2. Separate Discover initial-cache read, competing-refresh wait, owned refresh, and commit handling.
3. Separate milestone source validation, Review publish-intent matching, and rewatch rollback orchestration.
4. Preserve all current authorization, explicit failures, lease releases, and return shapes.
5. Run focused tests selected from the touched feature and Convex integration suites.

## Task 3: Convex migration orchestration

**Files:**

- Modify: `convex/catalogIdentityMigration.ts`
- Modify: `convex/catalogAnimeAggregateVerification.ts`
- Modify: `convex/catalogAnimeDataMigration.ts`
- Test: existing catalog identity, aggregate, and durable migration integration suites

**Steps:**

1. Split identity pagination into cache-backed and durable lanes.
2. Split aggregate verification into metadata validation, page accumulation, and progress persistence.
3. Split durable Anime migration handlers into projection checks, page mutation, verification, and receipt helpers.
4. Keep lane order, pagination size, counters, terminal cursors, repair rules, and corruption checks exact.
5. Run focused migration integration tests and both TypeScript checks.

## Task 4: Integrated validation and closure

**Files:**

- Modify: `TODO.md`
- Modify: this plan

**Steps:**

1. Run the full Vitest suite, root and Convex TypeScript, client plus SSR build, and `git diff --check`.
2. Run Fallow against baseline `23c2d27`; require zero introduced findings.
3. Run React Doctor; require the inherited render-time ref error to be gone and no new error.
4. Run `pnpm convex:dev --once`, then focused signed-out Discover browser QA with clean console and application logs.
5. Review the final diff, mark TODO and plan complete, and leave the branch ready for user review.

## Validation Receipt

- Focused: Discover 7/7; server/Convex 38/38; migration 21/21.
- Full: 152 passed + 2 skipped files; 1031 passed + 3 skipped tests.
- Pass: root and Convex TypeScript, client + SSR build, Convex sync, `git diff --check`.
- Fallow: zero findings against `23c2d27`.
- React Doctor: zero errors; zero `no-multi-comp` findings; 349 other advisories remain outside this cleanup.
- Browser: signed-out `/discover` search switching passes at 1280 px with no overflow, alerts, server error, or console error.
- Home follow-up: focused route tests 2/2; stale Following canonicalization and responsive rendering pass at 390 and 1280 px with clean console.
- Cleanup: browser closed, QA server stopped, port 3000 free.
