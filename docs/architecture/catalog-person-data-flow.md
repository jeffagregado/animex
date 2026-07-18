# Catalog Person data flow

## Entry and route contract

Character and Staff rows enter from Quick Search, dedicated result pages, Anime Detail people links, or canonical detail paths `/characters/:id/:slug` and `/staff/:id/:slug`. `parseCatalogPersonRouteId` accepts only positive decimal IDs without leading zeroes. Slugs are display-only and are corrected only after a ready detail record exists.

Both kinds use one neutral tab contract: `overview` (default) or `anime`. Explicit Overview removes the query; `?tab=anime` stays in the URL. Legacy Staff `?tab=works` is accepted only as a migration input and replaces once with `?tab=anime` before the Anime work query mounts. Invalid values also replace to Overview. Provider and cache identities remain `kind`, person ID, and work page; no `works` cache key or API name is introduced.

## Detail and work cache flow

| Field | Current contract |
| --- | --- |
| Entry | `getCatalogPerson` and `getCatalogPersonWorks` TanStack Start GET functions in `catalog-person-route.ts`. |
| Input | Provider-neutral `kind` (`character|staff`), positive person ID, and optional 20-row work page. |
| Validation | Server functions parse strict Zod input. AniList adapter validates detail/work payloads, IDs/pages, dates/years, optional fields, and rejects adult rows. |
| Transform | `anilist-person.server.ts` maps provider data to `CatalogPersonDetail`, `CatalogPersonWorkPage`, normalized summaries, and roles. Raw provider data never reaches UI. |
| Storage | `catalogPersonDetails`, `catalogPersonWorkPages`, normalized `animeSummaries`, and token-gated `catalogPersonCacheLeases`; detail/work TTL remains 24 hours. |
| External calls | Server-only AniList GraphQL through `src/lib/anilist-client.server.ts`; browser has no provider call. |
| Retry | AniList transport keeps 8-second timeout/three-attempt policy and short `Retry-After` waits. Lease contention rereads six times at 500 ms. Expired data is never served. |
| Error | Not-found, upstream, rate-limit, malformed provider data, missing environment, lease/commit/reread failure, and cache corruption remain explicit. No stale fallback. |
| Output | Ready detail or ordered work page; shared page renders loading, not-found, error/retry, empty, loading-more, visible Load more, and end states. |
| Owner | `src/features/catalog-person/{server,shared,ui}`, Character/Staff routes, and `convex/catalogPersonCache*`. |

Fresh cache reads return immediately. Missing or expired records acquire `person:<kind>:<id>` or `person-work:<kind>:<id>:<page>`; the lease owner fetches, validates, commits, releases, and rereads. Competing requests wait for a fresh record or fail explicitly. Work pages hydrate each stored Anime reference from `animeSummaries` and fail on a missing summary.

## Shared detail layout

Character and Staff now render the neutral `DetailPageLayout` used by Anime Detail: the same `max-w-[1480px]` width, responsive gutters, one-column small-screen flow, and `minmax(0,3fr)` main plus `minmax(17rem,1fr)` aside at `lg`. The neutral component owns geometry only. Catalog Person retains its image-led hero, About/Facts overview, and Anime work grid; Anime retains its own controls, metadata, tabs, and sidebar behavior.

## Search flow

`searchCatalogPeople` validates `kind`, trimmed 2–100 character query, and positive page, then issues one uncached AniList query per page with `perPage=20`. Rows contain provider-neutral identity fields and canonical destinations. Infinite query state is keyed by kind + query, deduplicates by person ID, auto-requests when new rows exist, and still exposes a visible Load more button. Whitespace, short/overlong input, initial/next-page failure, retry, empty, and end states are explicit.

## Remaining browser-fixture gaps

- Injected AniList/provider or Storage failure flow.
- Deep work/search pagination beyond the exercised page.

The second-account private-profile scenario is closed and verified. Real media upload/crop/remove remains a Profile gap.
