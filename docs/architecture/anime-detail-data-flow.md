# Anime Detail data flow

## Route and boundary

Canonical route: `/anime/$publicId/$slug`. The parent route resolves `publicId` through `getCatalogRouteIdentity` before any provider-backed query. Opaque IDs use `catalogEntities._id`; positive decimal legacy route IDs resolve through the server-only AniList mapping. Browser proof of one-way legacy canonical redirect remains a pending gate.

`tab=overview|reviews|characters|staff` stays URL state. Missing or stale slugs replace only after ready metadata. Overview omits its default query; tab navigation preserves history and scroll position.

## Flow contract

| Field | Current state |
| --- | --- |
| Entry | TanStack file routes under `src/routes/_public/anime/$publicId`; review editor under `_protected/anime/$publicId/$slug/reviews/new`. |
| Input | Route `publicId`, display slug, normalized tab, or one positive page number for Character/Staff people. |
| Validation | Strict Zod server functions parse opaque public IDs and page/kind. Catalog identity gateway validates kind, mapping cardinality, and server token. Convex validators remain final authority. |
| Transform | Server reverse-resolves `publicId` to AniList provider ID, reads provider/cache DTOs, then maps root Anime, related Anime, recommendations, Characters, Staff, and voice actors back to opaque `publicId` fields. UI receives no provider ID. |
| Storage | `animeSummaries`, `animeDetails`, `animeDetailPeoplePages`, and leases retain AniList-keyed rows, ordered data, image URLs, and 24-hour TTL. Additive durable `animeId` entity refs back user Anime state; legacy provider fields stay during migration. |
| External calls | Server-only `anilist-detail.server.ts` and shared AniList transport. Browser and Convex actions never call AniList. Metadata Image Proxy is not involved. |
| Retry | Cache miss/expiry acquires existing detail or people lease, fetches, validates, commits, releases, rereads. Lease contention waits bounded times; no stale or fabricated fallback. |
| Error | Invalid/missing identity, missing provider mapping, cache corruption, not-found, upstream, rate-limit, lease, commit, and reread failures surface explicit safe status. Provider IDs are not included in browser errors. |
| Output | Ready public detail/people state, not-found, or retryable error. Anime detail UI keeps existing hero, controls, tabs, sidebar, loading, empty, and error geometry. |
| Owner | Routes/UI: `src/routes/_public/anime` and `src/features/anime-detail`; identity: `src/features/catalog-identity` and `convex/catalogIdentity*`; cache: `src/features/anime-detail/server` and `convex/animeDetailCache*`; durable state: `convex/userAnime.ts`, `convex/reviews.ts`, `convex/feed.ts`. |

## Cache and durable identity

Cache refresh ensures bounded `(anilist, kind, providerId)` mappings in the same Convex write boundary, but does not change cache schema, TTL, lease keys, or image URLs. Cache reads reverse-resolve public identity server-side. Durable status, score, favorite, rewatch, and milestone operations accept AnimeX entity IDs; server checks entity/provider agreement and cached summary before writes. Missing mappings fail explicitly.

## Validation state

Dev additive sync and migration receipts are recorded in `docs/runbooks/catalog-identity-backfill.md`. Full automated gates, integrated review, and responsive browser QA are not yet claimed for this cutover.
