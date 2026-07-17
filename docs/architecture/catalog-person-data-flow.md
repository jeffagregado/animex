# Catalog Person data flow

## Entry and route contract

Public entry points are Character and Staff result rows, Anime Detail people links, `/characters/:id/:slug`, `/staff/:id/:slug`, `/search/characters?q=`, and `/search/staff?q=`. `parseCatalogPersonRouteId` accepts only positive decimal IDs without leading zeroes. Slugs are display-only: the detail loader waits for a ready record, then replaces wrong/missing slugs with `createCatalogPersonPath`. Character supports `overview|anime`; Staff supports `overview|works`; invalid tab state replaces before the work query mounts.

## Detail/work cache flow

| Field | Current contract |
| --- | --- |
| Entry | `getCatalogPerson` / `getCatalogPersonWorks` TanStack Start GET functions from `catalog-person-route.ts`. |
| Input | Provider-neutral `kind` (`character|staff`), positive person ID, and work page (20 rows). |
| Validation | Server functions parse Zod inputs. AniList adapter validates strict detail/work payloads and rejects adult rows, mismatched IDs/pages, malformed optional fields, and invalid dates/years. |
| Transform | `anilist-person.server.ts` maps provider fields to `CatalogPersonDetail`, `CatalogPersonWorkPage`, and normalized anime summaries/roles. No raw provider response reaches UI. |
| Storage | `catalogPersonDetails` and `catalogPersonWorkPages` are separate from Anime Detail people edges. Work commits upsert `animeSummaries`; `catalogPersonCacheLeases` owns token-gated leases. TTL is 24 hours. |
| External calls | Server-only AniList GraphQL through `src/lib/anilist-client.server.ts`; browser never calls AniList. |
| Retry | AniList transport uses 8-second timeout and at most three attempts; short `Retry-After` (≤2s) waits, while longer/unknown limits return `RATE_LIMITED`. Cache lease contention rereads six times at 500 ms. Expired data is never served. |
| Error | `not-found`, `UPSTREAM`, `RATE_LIMITED`, malformed provider data, missing environment, lease/commit/re-read failures, and cache corruption remain explicit. No stale fallback. |
| Output | Ready detail or ordered 20-row work page; route UI renders loading, not-found, error/retry, empty, auto-load, visible Load more, and end states. |
| Owner | `src/features/catalog-person/server`, `src/features/catalog-person/ui`, route files under `src/routes/_public/characters|staff`, `convex/catalogPersonCache*`, and `convex/schema.ts`. |

Fresh cache reads return immediately. Missing/expired reads acquire `person:<kind>:<id>` or `person-work:<kind>:<id>:<page>`; lease owner fetches, validates, commits, releases, and rereads. A competing request waits for a fresh record; contention exhaustion is an error. Work-page reads hydrate each stored anime reference from `animeSummaries` and fail on a missing summary.

## Search flow

`searchCatalogPeople` validates `kind`, trimmed 2–100 character query, and positive page, then calls one uncached AniList query per requested page with `perPage=20`. Search rows contain provider-neutral ID/name/native name/image and canonical destination. TanStack Query infinite state is keyed by kind + query, deduplicates by person ID, auto-requests the next page when new rows exist, and still exposes a visible Load more button. Query whitespace, short input, overlong input, initial/next-page failure, retry, empty, and end states are explicit.

## UI/cache boundaries

Detail queries use `['catalog-person', kind, id]` with a 15-minute browser stale time over the 24-hour Convex cache. Work pages are fetched by the rendered tab only. Canonical redirects run only on ready detail, so an unavailable provider cannot redirect to an unverified slug. Character/Staff paths remain public; no auth/profile data is read.

## Verification gaps

- [ ] Deep work/search pagination beyond the exercised page.
- [ ] Injected AniList rate-limit/unavailable browser flow.
