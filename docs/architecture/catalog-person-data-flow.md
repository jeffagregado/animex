# Catalog Person data flow

## Route and entry

Canonical detail routes: `/characters/$publicId/$slug` and `/staff/$publicId/$slug`. Route identity resolves public or legacy positive decimal IDs before provider-backed detail/work queries. Character supports Overview, Anime, and Voice Actors; Staff supports Overview and Anime. Legacy Staff `?tab=works` and invalid tabs replace to the current public tab after identity/detail state is ready. Browser redirect proof remains a pending gate.

## Detail and work flow

| Field | Current state |
| --- | --- |
| Entry | `getCatalogPerson` and `getCatalogPersonWorks` TanStack Start GET functions; search uses `searchCatalogPeople`. |
| Input | Provider-neutral kind, opaque person `publicId`, and optional positive 20-row Anime work page; search uses trimmed 2–100 character text and page. |
| Validation | Strict Zod functions validate public IDs, kind, page, query, and output. AniList schemas validate detail/work payloads, adult filtering, dates, roles, and actor languages. Convex validates cache leases and token. |
| Transform | Server reverse-resolves person `publicId` to AniList provider key, reads/refreshes provider cache, then maps person, Anime works, voice actors, biography links, and destination paths to public IDs. Provider IDs never reach UI. |
| Storage | `catalogPersonDetails`, `catalogPersonWorkPages`, `animeSummaries`, and leases retain provider IDs, ordered rows, image URLs, and 24-hour TTL. Cache commits ensure bounded identity mappings without changing row shape. |
| External calls | Server-only AniList adapters and shared transport. Browser and Convex actions never call AniList. Metadata Image Proxy stays outside flow. |
| Retry | Missing/expired detail/work page acquires existing lease, fetches, validates, commits, releases, rereads. Bounded lease wait and provider retry are explicit; expired data is not served. |
| Error | Invalid/missing mapping, cache corruption, not-found, malformed provider data, upstream, rate-limit, lease, commit, and reread failures remain explicit. No numeric provider fallback. |
| Output | Typed public person detail/work/search page with opaque IDs, canonical AnimeX routes, and explicit loading/empty/error/load-more/end states. |
| Owner | Routes/UI: `src/routes/_public/{characters,staff}`, `src/features/catalog-person`; provider/cache: `src/features/catalog-person/server`, `convex/catalogPersonCache*`; identity: `src/features/catalog-identity`, `convex/catalogIdentity*`. |

## Search and links

Live Character/Staff search ensures identity mappings before returning rows. Infinite pages deduplicate by `publicId`; View all destinations remain `/search/characters?q=` and `/search/staff?q=`. Biography parser rewrites supported AniList Anime/Character/Staff links server-side to publicId paths; unsupported safe external links stay external. Work cards use Anime `publicId` for React keys, query keys, and canonical hrefs.

## Validation state

Dev migration receipts and retained provider/cache contracts are recorded in `docs/runbooks/catalog-identity-backfill.md`. Full automated gates, integrated review, and responsive browser QA are pending; no browser closure is claimed.
