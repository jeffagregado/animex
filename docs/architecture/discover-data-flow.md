# Discover data flow

## Entry and route

`src/routes/_public/discover.tsx` owns `/discover`. It validates and normalizes query, genre, format, season, year, and sort; loaders return strict public rows. Anime links use `/anime/$publicId/$slug`. `PublicShell` owns shared responsive navigation.

## Curated rails

| Field | Current state |
| --- | --- |
| Entry | Discover route loader and Home consumers call `getDiscoverPage`; search calls `searchAnime`. |
| Input | Rail key, URL filters, or search page/cursor. |
| Validation | Server Zod contracts validate filters and provider responses. Convex cache writes validate bounded sections, lease ownership, and token. |
| Transform | AniList provider summaries keep numeric IDs in server/cache models. Cache reads resolve existing mappings; live search ensures mappings, then maps rows to opaque `publicId`. |
| Storage | `animeSummaries`, ordered `discoverSectionCache`, and `discoverCacheLeases` keep existing AniList keys, section order, timestamps, image URLs, and TTLs. Numeric provider IDs are not stored in browser DTOs. |
| External calls | Server-only `src/features/discover/server/anilist.server.ts` → AniList GraphQL. Browser and Convex actions never call provider. |
| Retry | Missing/expired section acquires existing bounded lease, fetches, normalizes, commits, releases, rereads. AniList transport retries transient failures with timeout/Retry-After policy; no stale fallback. |
| Error | Invalid filters, identity mapping failure, missing cache, malformed provider data, upstream, rate-limit, lease, and commit errors remain explicit section/search states. |
| Output | Rails and search rows contain display metadata plus opaque `publicId`, slug, and provider-neutral destinations. |
| Owner | Route/UI: `src/routes/_public/discover.tsx`, `src/features/discover`; server/cache bridge: `src/features/discover/server`; Convex cache/schema: `convex/animeCache*`, `convex/schema.ts`; identity: `src/features/catalog-identity`, `convex/catalogIdentity*`. |

## Rails and search

Trending remains 3h, Upcoming 6h, Seasonal and Recommendations 24h. Home reuses cached Trending and Upcoming. Search bypasses Convex cache for a server-only AniList request, deduplicates provider rows before identity materialization, and returns explicit loading/empty/retry/rate-limit/end states. No browser provider endpoint or AniList ID is rendered.

## Boundary and validation

Existing cache rows and image URLs remain unchanged; Metadata Image Proxy remains optional, unscheduled, and untouched. Dev additive sync and identity/durable migration receipts are recorded in `docs/runbooks/catalog-identity-backfill.md`. Full tests, client boundary scans, Fallow, React Doctor, integrated review, and responsive browser QA remain pending for this cutover.
