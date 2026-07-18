# Profile data flow

## Entry and access

`/_public/_profile/users/$username` resolves auth in TanStack Router `beforeLoad` before protected Profile children render. Activity is default; `tab=activity|reviews|favorites`. Signed-out, unverified, and incomplete requests redirect with validated `returnTo`. Auth transport failure is explicit; it is not treated as signed out.

## Read contract

| Field | Current state |
| --- | --- |
| Entry | `getProfileByUsername` and `getProfileContentPage` server functions, then Profile Activity/Reviews/Favorites UI lanes. |
| Input | Username, normalized tab, request session, and optional lane cursor. |
| Validation | Strict Zod input/output plus Convex auth/profile/visibility checks. Convex remains access authority. |
| Transform | Authenticated server facades call profile/feed/review/favorite queries. Anime-backed rows now carry opaque Anime `publicId`; provider IDs remain internal to cache/provider lookup. Private non-owners receive only allowed header identity/bio and privacy notice. |
| Storage | `users`, progress/Anime entries, `animeSummaries`, `reviews`, and active `feedCards`. Additive Anime entity refs coexist with legacy provider fields until approved production tightening. |
| External calls | TanStack Start server functions use auth proxy and Convex reads. Profile browser code does not call AniList or expose Better Auth identity/email. |
| Retry | Route/auth refresh plus independent Activity/Reviews/Favorites cursor retry/load-more. No stale or synthetic fallback. |
| Error | Not found, invalid visibility, private access, missing Anime mapping/summary, unauthenticated transport, and lane failure remain explicit. |
| Output | Typed Profile header/full result and independently paginated content rows with provider-neutral Anime IDs/destinations. |
| Owner | Route/auth facade/UI: `src/routes/_public/_profile`, `src/features/profile`; data authority: `convex/profiles.ts`, `convex/feed.ts`, `convex/reviews.ts`, `convex/userAnime.ts`, `convex/users.ts`; identity: `convex/catalogIdentity*`. |

## User Search and mutations

`userSearchDocuments` refreshes with username/profile writes. Authenticated User Search server facades return identity-only rows. Owner Anime list, favorite, status, score, rewatch, Review, and profile activity writes use `v.id('catalogEntities')` Anime IDs; server verifies provider mapping and cached Anime metadata before writes. Legacy `anilistId` values remain for migration consistency and are never emitted in browser contracts.

## Media and avatar boundary

Profile avatar/banner crop, Storage validation, replacement, removal, and `UserAvatar` geometry are unchanged. Image URLs remain direct AnimeX/Storage or existing metadata URLs. Metadata Image Proxy is optional, unscheduled, and untouched.

## Validation state

Dev identity/durable migration evidence is in `docs/runbooks/catalog-identity-backfill.md`. Full automated gates, integrated review, and responsive browser QA for publicId surfaces are pending; prior Phase 7 browser evidence does not close this cutover.
