# Discover data flow

## Entry and route

`src/routes/_public/route.tsx` owns shared public layout. `src/routes/_public/discover.tsx` owns `/discover`: it validates URL search, normalizes `q`, genre, format, season, year, and sort, loads initial rails through `getDiscoverPage`, and serializes UI changes back to URL state. `PublicShell` renders responsive shared navigation.

## Curated rails

1. The route loader calls TanStack Start `getDiscoverPage` (`GET`) in `src/features/discover/server/discover.functions.ts`.
2. The server cache gateway reads Convex query `animeCache.readSections`.
3. Fresh sections return ordered `animeSummaries`. Missing or expired sections acquire a 30-second lease, fetch AniList server-side, validate and normalize summaries, and commit through Convex mutations (`acquireSectionLease`, `commitSection`, `releaseSectionLease`). Lease contention rereads up to six times at 500 ms intervals.
4. Convex stores lightweight `animeSummaries`, ordered `discoverSectionCache` records, and `discoverCacheLeases`. No Convex action or browser-side provider call is used. Writes require `DISCOVER_CACHE_WRITE_TOKEN`; lease ownership and section limits are validated.

TTL: Trending 3h; Upcoming 6h; Seasonal and Recommendations 24h. Expired or missing cache never serves stale data; refresh/cache failures return explicit section error states with retry controls.

## AniList boundary

`src/features/discover/server/anilist.server.ts` is server-only. It calls `https://graphql.anilist.co` with an 8-second timeout, validates GraphQL payloads with Zod, normalizes numeric AniList IDs and Unicode-safe title slugs, filters anime/non-adult recommendations, and retries transient failures up to three attempts. Short `429` windows retry using `Retry-After`; longer or unknown limits and final failures surface sanitized `UPSTREAM` or `RATE_LIMITED` errors. No provider call is made by browser code or Convex actions.

## Search path

Valid URL search/filter state enables `DiscoverSearchResults`, which calls TanStack Query infinite pagination through server function `searchAnime` (`GET`). Search bypasses Convex cache and queries AniList directly on the server. Results are deduplicated by AniList ID and link each card/list row to `/anime/$anilistId/$slug`; the detail route owns canonical slug correction after metadata loads. Search exposes explicit loading, empty, retry, rate-limit, and end states. No stale fallback.

## Discover layout and filters

The main column renders Trending, Seasonal, Popular Recommendations, and responsive This Week/Upcoming lists. It does not render a main-column Genres section. Desktop Top Genres remains in the sidebar. `DISCOVER_GENRES` powers both Top Genres selection and the URL `genre` filter; format, season, year, query, and sort filters remain URL-controlled. Manga placeholder remains a separate sidebar/mobile utility section.

Home calls the same `getDiscoverPage` loader and reuses the cached `trending` data for its This Week list and the cached `upcoming` data for Upcoming. Home desktop utility cards use `rounded-lg border border-border bg-card p-4`, matching Discover. No responsive sidebar or data-fetch change exists.

## UI validation and ownership

Discover layout is responsive at 390/768/1280 px with no horizontal overflow; URL search/filter state persists; Top Genres and genre filtering remain available; browser console is clean. Route and shell are owned by `src/routes/_public` and `src/features/shell`; server transport/cache orchestration is owned by `src/features/discover/server`; contracts and UI are owned by `src/features/discover`; persistence policy is owned by `convex/animeCache*` and `convex/schema.ts`.
