# Profile data flow

## Entry and access

`/_public/_profile` resolves the application auth state in `beforeLoad` through the shared TanStack Query auth cache before a protected child route renders. Signed-out, email-unverified, and profile-incomplete requests redirect to the existing auth route with a validated relative `returnTo`. Auth transport or schema failures render `Authentication unavailable` with an explicit refresh action; they are not treated as signed out. No Profile route renders a `Checking authentication` state.

The shared public header consumes the same auth-state query. Complete accounts render a circular `UserAvatar` trigger and an owner menu containing only `Profile` and `Sign out`; pending or incomplete accounts keep the direct Sign out action, and signed-out visitors keep Sign in. Profile selection uses TanStack Router navigation. Sign-out has one guarded request, re-enables on failure, and navigates to `/home` only after success.

## Profile read

| Field | Current contract |
| --- | --- |
| Entry | `src/routes/_public/_profile/users/$username.tsx`; Activity is default, `tab` accepts `activity`, `reviews`, or `favorites`. |
| Input | Normalized username, validated tab, server request session, optional lane cursor. |
| Validation | `_profile.beforeLoad` ensures `authStateQueryOptions()`; `getProfileByUsername` and `getProfileContentPage` use strict Zod input/output contracts; Convex remains the final access authority. |
| Transform | Authenticated server facades call `api.profiles.getByUsername`, `api.feed.listForProfile`, `api.reviews.listForProfile`, or `api.userAnime.listProfileFavorites`. Private non-owners receive header identity/bio plus a privacy notice; full output includes four progress counts and ten newest favorites. |
| Storage | `users`, `userAnimeProgress`, `userAnimeEntries` + favorite index, `animeSummaries`, `reviews`, and active `feedCards`; profile content reuses the existing Convex list queries. |
| External calls | TanStack Start server functions use `getAuthProxy`; browser does not call Convex for Profile reads and no raw Better Auth identity/email reaches output. |
| Retry | Route/auth failures expose explicit refresh or retry. Activity, Reviews, and Favorites lanes own cursor retry and load-more; no stale or synthetic fallback. |
| Error | `PROFILE_NOT_FOUND`, invalid/corrupt visibility, private access, unauthenticated server transport, missing Anime summary, and lane failures remain explicit and scoped to the affected surface. |
| Output | Typed Profile header/full result, or independently paginated Activity, Reviews, and Favorites UI. |
| Owner | Auth facade and route under `src/features/auth`, `src/features/profile/server`, `src/routes/_public/_profile`; data authority in `convex/users.ts`, `convex/profiles.ts`, `convex/feed.ts`, `convex/reviews.ts`, and `convex/userAnime.ts`. |

`useProfilePages` scopes state by `username:tab`, binds cursors to username/viewer/lane, deduplicates merged rows, and keeps lane failures independent. Router tab links preserve the public shell and browser history; they do not reload the document or remount the auth/header boundary. `refreshProfileQuery` invalidates and refetches the server-owned Profile query only after a successful owner mutation; cancel and failed mutations do not refresh.

## User Search

Username completion and profile edits refresh `userSearchDocuments` in the same Convex mutation boundary as the user write. `searchUsersPreview` and `searchUsers` are authenticated TanStack Start server facades over `userSearch:searchPreview` and `userSearch:search`; they return identity-only rows and never expose auth IDs or email. The full `/search/users` route uses an infinite TanStack Query cache keyed by normalized query and explicit retry/error/end states.

## Owner mutations and media

Edit Profile validates display name, bio, and `public|private` visibility with Zod, then calls the owner mutation through client Convex synchronization. Client Convex identity gates edit/media mutations only; it is not required for server Profile reads. A successful edit or media finalize/remove refreshes the Profile server query; cancellation or failure leaves current data unchanged and reports the error.

Profile media keeps the existing crop/upload contract: JPEG/PNG/WebP input up to 10 MiB, `react-easy-crop`, avatar 512×512 or banner 1600×400 WebP capped at 2 MiB, owner upload URL, pending registration, bounded Storage validation, finalize, replacement cleanup, and remove. Browser QA verified real avatar/banner upload, crop, replacement with changed Storage URLs, removal, fallback restoration, injected upload HTTP 503 feedback, and successful retry.

## Avatar and containment

`UserAvatar` is the shared user-identity renderer used by the header account trigger, Quick Search Users, `/search/users`, feed, and Profile. User sizes are 44×44 for header/Quick Search (`md`), 64×64 for `/search/users` (`search`), 96×96 on Profile phone, and 128×128 on Profile tablet/desktop (`profile`); Profile fallback glyphs scale to 36 px and 48 px respectively. Every box is square, circular, non-shrinking, clipped, and `object-cover`; broken URLs switch to one uppercase initial without layout shift. Profile identity text wraps safely, grid children use `min-width: 0`, support content follows the main column below desktop, and only the tab rail may scroll horizontally on narrow screens.

## Phase 7 closure

No browser fixture remains open. Second-account private-profile, real media lifecycle, and Storage failure/retry scenarios have recorded browser evidence. User confirmed closure for deep pagination; Codex did not independently exercise that fixture. Provider failure variants were not separately injected because the Phase 7 failure fixture required provider or Storage coverage.
