# Anime Detail data flow

## Entry and route

The canonical public route is `/anime/$anilistId/$slug`. The parent parses a positive safe AniList ID and hydrates `['anime-detail', anilistId]` through `getAnimeDetail` with a 15-minute browser stale time. Missing or stale slugs redirect only after a ready detail is loaded. `tab=overview|reviews|characters|staff` is normalized; Overview omits the query and tab changes preserve browser history while swapping only the main panel.

## Shared page geometry

Anime Detail now renders the neutral required-slot `DetailPageLayout` shared with Character and Staff. It owns only responsive geometry: `max-w-[1480px]`, current gutters/bottom spacing, one main column below `lg`, `minmax(0,3fr)` main plus `minmax(17rem,1fr)` aside at `lg`, and `min-w-0` containment. Anime-specific hero, controls, tab rail, content panels, sidebar ordering, loading, empty, and error behavior remain owned by `src/features/anime-detail/ui` and are unchanged.

## Public detail flow

1. Route loader calls validated TanStack Start `getAnimeDetail` (`GET`) in `src/features/anime-detail/server/anime-detail.functions.ts`.
2. `anime-detail-cache.server.ts` reads `animeDetailCache.readDetail` from Convex; a fresh entry returns the validated 24-hour detail payload.
3. Missing or expired detail acquires `detail:<id>` with the existing `DISCOVER_CACHE_WRITE_TOKEN`, fetches AniList server-side, validates/normalizes detail and summary, atomically commits both, then rereads. Lease contention rereads up to six times at 500 ms and fails explicitly when exhausted.
4. Convex stores `animeDetails`, normalized `animeSummaries`, `animeDetailPeoplePages`, and `animeDetailCacheLeases`. Convex owns validation and lease ownership; browser never calls AniList and no Convex action is used.

Detail cache TTL remains 24 hours. Not-found, upstream, rate-limit, malformed payload, missing environment, lease contention, and commit/reread failures remain explicit; expired data is never served.

## AniList and people pages

`anilist-detail.server.ts` remains server-only and reuses shared AniList transport. Full detail is capped at five related and five recommendations. Initial Characters and Staff pages contain 24 items. `AnimePeopleGrid` requests one explicit next page, deduplicates by AniList person ID, retains successful cards when a later page fails, and exposes Retry/Load more/end states. People pages use independent 24-hour leases and never fall back to expired pages.

## Private user state

After public auth state and Convex auth are complete, `AnimeUserControls` reads `userAnime.getMine` and owner-only rewatch data. Signed-out/incomplete users receive the existing validated auth destination with encoded `returnTo`. Convex `userAnime.ts` requires a verified profile and cached Anime summary for every read/mutation. Status, one-decimal score save/clear, favorite timestamp, rewatch record, and remove-latest operations remain atomic and owner-scoped. No private user state enters public detail cache records.

## UI boundaries and output

`AnimeDetailPage` renders loading, empty, not-found, and error states with stable shell dimensions. Ready detail renders one shared hero, controls, tab bar, and sidebar; only tab content swaps. Characters, Staff, Overview, and truthful empty Reviews stay in the main panel. Related Anime, Recommendations, Trailer, and External Links keep stable sidebar order. Owners: public transport/cache under `src/features/anime-detail/server` and `convex/animeDetailCache*`; private persistence/auth in `convex/userAnime.ts`, `convex/users.ts`, and `convex/schema.ts`; UI/routes in `src/features/anime-detail` and `src/routes/_public/anime`.

## Remaining browser-fixture gaps

Deep people/work pagination beyond the exercised page remains unverified. Second-account private-profile, real Profile media lifecycle, and the Phase 7 failure fixture are verified. Failure injection used Storage HTTP 503; provider variants were not separately injected.
