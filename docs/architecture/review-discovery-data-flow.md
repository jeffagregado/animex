# Review and Post data flow

## Source truth

`reviews` owns Review state, visibility, Rating, Summary, body, and discovery fields. `posts` owns Post content/media. `feedCards` is an indexed projection, never source truth. Users own author identity. Anime-backed outputs resolve `animeId: Id<'catalogEntities'>` to cached display metadata; legacy provider fields remain transitional.

## Review flow

| Field | Current state |
| --- | --- |
| Entry | Anime Detail Review editor, Review Detail, Anime Reviews, Profile Reviews, and `/reviews` discovery. |
| Input | Review create/draft/publish/update uses AnimeX Anime entity ID, Rating, Summary, body JSON, spoiler flag, visibility, and request ID. Discovery uses public filters, sort, query, cursor, and viewer scope. |
| Validation | Review Zod document/rating contracts; Convex auth/owner/visibility checks; Anime entity/provider mapping and cached summary are required. Discovery cursors bind viewer, Anime entity, query, sort, and visibility. |
| Transform | Server reads entity-indexed Reviews, hydrates author and Anime summary, and emits opaque Anime `publicId`, slug, title, cover, and Review fields. AniList numeric IDs stay server-only. |
| Storage | `reviews.animeId`, entity indexes, `animeReviewStats.animeId`, and Review feed projection refs are additive. Existing body, visibility, timestamps, discovery fields, Rating bands, and legacy `anilistId` remain intact during staged rollout. |
| External calls | Convex reads/mutations only for Review writes/discovery. Anime metadata provider calls stay in server-only catalog cache gateways; Review UI never calls AniList. |
| Retry | Invalid fields stay in editor. Convex failures surface explicit toast/error state. Discovery lanes own cursor retry/load-more; no fabricated or stale fallback. |
| Error | Missing/conflicting Anime mapping, missing cached summary, auth/visibility denial, malformed body, duplicate request, source/projection mismatch, and aggregate mismatch fail explicitly. |
| Output | Review cards/detail/feed/profile rows with provider-neutral Anime destination `/anime/$publicId/$slug`; Review body and spoiler semantics unchanged. |
| Owner | Editor/UI: `src/features/reviews`; persistence/discovery: `convex/reviews.ts`, `convex/reviewDiscovery.ts`; projection/auth: `convex/feed.ts`, `convex/profiles.ts`; identity/schema: `convex/catalogIdentity*`, `convex/schema.ts`. |

## Feed and Post boundary

Post media remains one optional external HTTPS image/video URL. No upload, image proxy, metadata fetch, or first-party Post media storage is introduced. Feed Review/completed/rewatched cards resolve source owner, visibility, source key, and Anime entity before hydration. Milestone source keys use `kind:userId:animeEntityId`; legacy-key drift fails explicitly. Activity deletion removes only derived feed projection, never Review/Post/milestone source.

Post composer validates HTTPS/no-credential URLs, explicit Image/Video type, provider allowlist, labels, and 280-character text. `posts.media` stores normalized media; create is request-idempotent, owner/visibility checks stay server-side, feed reads hydrate stored media without fetching arbitrary URLs, and broken external media remains an explicit card state.

## Review discovery lanes

Latest, empty-search, and filtered search lanes use existing indexed state/visibility/rating ordering. Public viewers read Public; signed-in All keeps owner-readable legacy Private/Followers behavior. Page caps and cursor isolation remain. Anime detail Review reads use entity indexes and emit public IDs; no provider ID enters client contracts.

## Migration and validation state

Dev durable migration processed user Anime/rewatches/milestones/Reviews/feed/stats as `5/0/4/2/6` final verification rows with zero counters after first-pass patches `5/0/4/2/7/1`. One authorized stale derived milestone feed projection was deleted after projection-only verification; no source Review, Post, or authoritative milestone row was deleted. Production migration and required-field schema tightening remain deferred. Full gates, integrated review, and browser QA remain pending.
