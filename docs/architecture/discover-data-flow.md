# Discover data flow

## Entry and route

`src/routes/_public/route.tsx` owns shared public layout. `src/routes/_public/discover.tsx` owns `/discover`: it validates URL search, normalizes `q`, genre, format, season, year, and sort, loads initial rails through `getDiscoverPage`, and serializes UI changes back to URL state. `PublicShell` renders responsive shared navigation; Home remains intact.

## Curated rails

1. Route loader calls TanStack Start `getDiscoverPage` (`GET`) in `src/features/discover/server/discover.functions.ts`.
2. Server cache gateway reads Convex query `animeCache.readSections`.
3. Fresh sections return ordered summaries. Missing/expired sections acquire a 30-second lease, fetch AniList server-side, validate/normalize summaries, and commit through Convex mutations (`acquireSectionLease`, `commitSection`, `releaseSectionLease`). Contention rereads up to six times at 500 ms intervals.
4. Convex stores lightweight `animeSummaries`, ordered `discoverSectionCache` records, and `discoverCacheLeases`. No Convex actions. Writes require `DISCOVER_CACHE_WRITE_TOKEN`; lease ownership and section limits are validated.

TTL: Trending 3h; Upcoming 6h; Seasonal and Recommendations 24h. Expired or missing cache never serves stale data; refresh/cache failures return explicit section error states with retry controls.

## AniList boundary

`src/features/discover/server/anilist.server.ts` is server-only. It calls `https://graphql.anilist.co` with an 8-second timeout, validates GraphQL payloads with Zod, normalizes numeric AniList IDs and Unicode-safe title slugs, filters anime/non-adult recommendations, and retries transient failures up to three attempts. Short `429` windows retry using `Retry-After`; longer/unknown limits and final failures surface sanitized `UPSTREAM` or `RATE_LIMITED` errors. No provider call is made by browser code or Convex actions.

## Search path

Valid URL search/filter state enables `DiscoverSearchResults`, which calls TanStack Query infinite pagination through server function `searchAnime` (`GET`). Search bypasses Convex cache and queries AniList directly on the server. Results are deduplicated by AniList ID, display-only until Phase 4 detail routes exist, and expose explicit loading, empty, retry, rate-limit, and end states. No stale fallback.

## UI and validation

Discover renders Trending, Seasonal, Genres, Popular Recommendations, This Week, Upcoming, desktop-only Top Genres, and future Manga placeholder. Layout is responsive at 390/768/1280 px with no horizontal overflow; URL search/filter state persists; Home remains intact; browser console clean.

Validation evidence: 212 tests pass, 2 skipped; `tsc`, build, route generation, and `convex dev --once` pass; Fallow new-only audit PASS (0 introduced dead-code/complexity/duplicate findings; one inherited `react-dom` classification); client endpoint scan PASS; two live AniList tests pass; final integrated review PASS with no findings.

Owners: route and shell in `src/routes/_public` and `src/features/shell`; server transport/cache orchestration in `src/features/discover/server`; contracts/UI in `src/features/discover`; persistence policy in `convex/animeCache*` and `convex/schema.ts`.
