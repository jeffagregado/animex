# Phase 3 AniList And Discover Implementation Record

**Goal:** Ship server-backed AniList discovery and responsive `/discover` UI.

**Architecture:** TanStack Start server functions own AniList calls. Convex validated queries/mutations own durable curated cache. Browser receives normalized app types only. Search bypasses Convex.

## Constraints

- No Convex AniList action or browser AniList endpoint.
- No stale/fake content fallback.
- Shared public layout uses `_public/route.tsx`.
- Home/auth behavior preserved.
- Cards remain non-interactive until Phase 4.

## Verified implementation

### Contracts

- [x] Normalize anime metadata, canonical numeric `anilistId`, Unicode-safe slug, season, TTL, search, and errors.
- [x] Lock contracts with focused tests.

### Convex cache

- [x] Add summary, ordered section, and lease tables/indexes.
- [x] Add token-validated read/acquire/commit/release queries and mutations; no actions.
- [x] Push schema/functions with `pnpm exec convex dev --once`.
- [x] Fix final reviewer cache-parallel P2 and rerun affected gates.

### AniList server boundary

- [x] Add server-only GraphQL transport, validated normalization, retries, sanitized errors, section refresh, and live search.
- [x] Pass two live AniList tests and client endpoint scan.

### Routes and UI

- [x] Move Home and Discover under pathless `_public/route.tsx`; regenerate route tree.
- [x] Add `/discover` loader plus validated URL search/filter state.
- [x] Build responsive rails, desktop-only Top Genres, complete states, filters, and infinite search.
- [x] Verify Home regression, clean console, and no overflow at 390/768/1280.

### Validation and closure

- [x] Pass 212 tests with 2 skipped, TypeScript, build, route generation, Convex dev push, Fallow new-only audit, client endpoint scan, and browser QA.
- [x] Publish current data-flow and sync Phase 3 trackers.
- [x] Receive final integrated review PASS with no findings.
- [x] Close Phase 3.
- [x] Stop before Phase 4; remain paused until approval.

Status: COMPLETE. Final integrated review PASS with no findings. Phase 4 paused and not started.
