# Anime Detail data flow

## Entry and route

The canonical public route is `/anime/$anilistId/$slug`; the parent route parses a positive safe AniList ID and hydrates `['anime-detail', anilistId]` through `getAnimeDetail` with a 15-minute browser stale time. The missing-slug index and stale-slug child redirect to the title-derived canonical path only after a ready detail is loaded; `tab=overview|reviews|characters|staff` is normalized (Overview omits the query), preserves browser history, and changes only the main tab panel. Route and shell ownership: `src/routes/_public/anime` and `src/features/anime-detail/ui`.

## Public detail flow

1. Route loader calls validated TanStack Start `getAnimeDetail` (`GET`) in `src/features/anime-detail/server/anime-detail.functions.ts`.
2. `anime-detail-cache.server.ts` reads `animeDetailCache.readDetail` from Convex. A fresh entry returns the validated 24-hour detail payload.
3. Missing/expired detail acquires `detail:<id>` using the existing `DISCOVER_CACHE_WRITE_TOKEN`, fetches AniList server-side, validates/normalizes the detail and summary, atomically commits both, then rereads. A competing lease rereads up to six times at 500 ms; failure is explicit.
4. Convex stores `animeDetails`, normalized `animeSummaries`, `animeDetailPeoplePages`, and `animeDetailCacheLeases`. Convex owns validation and lease ownership; no Convex action or browser AniList call exists.

Detail cache TTL is 24 hours. Expired data is never served. Not-found, upstream, rate-limit, malformed payload, missing environment, lease contention, and commit/reread failures become explicit serialized states; no stale or silent fallback.

## AniList and people pages

`src/features/anime-detail/server/anilist-detail.server.ts` is server-only and reuses the shared AniList transport. Full detail is capped at five related and five recommendations. Initial Characters and Staff pages contain 24 items. `AnimePeopleGrid` requests one explicit next page (`getAnimePeoplePage`), deduplicates by AniList person ID, retains successful cards when a later page fails, and exposes Retry/Load more/end states. People pages use independent `people:<id>:<kind>:<page>` 24-hour leases and never fall back to expired pages.

## Private user state

After both public auth state and Convex auth are complete, `AnimeUserControls` reads `userAnime.getMine` and owner-only `listMyRewatches`; otherwise controls are auth-gated with an encoded `returnTo` to sign-in, verify-email, or profile completion. Convex `userAnime.ts` requires a verified profile and a cached anime summary before every read/mutation. Status, one-decimal score save/clear, favorite timestamp, record rewatch, and remove-latest operations are atomic. Milestones (`completed`, `rewatched`) and rewatch entries are owner-scoped; rewatch history is cursor-paginated at 20 per page. No private user state is included in public detail cache records.

## UI boundaries and output

`AnimeDetailPage` renders loading, empty, not-found, and error states with stable shell dimensions. Ready detail renders one shared hero, controls, tab bar, and sidebar; only tab content swaps. Characters, Staff, Overview, and truthful empty Reviews stay in the main panel. Related Anime, Recommendations, Trailer, and External Links stay in stable sidebar order. Public output is typed detail state; private output is typed user entry or owner rewatch page. Owners: public transport/cache in `src/features/anime-detail/server` and `convex/animeDetailCache*`; user persistence/auth in `convex/userAnime.ts`, `convex/users.ts`, and `convex/schema.ts`; UI/routes in `src/features/anime-detail` and `src/routes/_public/anime`.
