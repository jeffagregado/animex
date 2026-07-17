# Profile data flow

## Entry and access

`/_public/_profile` gates `/users/:username` and `/search/users` until public auth is ready, the user is email-verified, the AnimeX profile is complete, and Convex auth is synchronized. Signed-out, unverified, and profile-pending viewers redirect to the matching auth route with a validated relative `returnTo`. `convex/users.ts` is the final auth/profile authority; no raw Better Auth identity or email reaches profile output.

## Profile read

| Field | Current contract |
| --- | --- |
| Entry | `src/routes/_public/_profile/users/$username.tsx`; Activity is default, `tab` accepts `activity`, `reviews`, or `favorites`. |
| Input | Normalized username, validated tab, authenticated viewer, optional lane cursor. |
| Validation | `ProfileLayout` requires complete auth; `profiles:resolveProfileAccess` lowercases username and uses `users.by_username_key`; missing/invalid visibility fails explicitly. |
| Transform | `profiles:getByUsername` returns header projection for a non-owner private viewer, otherwise full projection. Full output adds four progress counts and ten newest favorites. URLs resolve through Convex Storage. |
| Storage | `users`, `userAnimeProgress`, `userAnimeEntries` + `by_user_favorite_at`, `animeSummaries`, `reviews`, and active `feedCards`. Profile content queries reuse `reviews:listForProfile`, `feed:listForProfile`, and `userAnime:listProfileFavorites`. |
| External calls | None for profile records; Storage URL reads are Convex-owned. |
| Retry | Convex query retry/reactivity. Profile page lanes own cursor retry and load-more; no stale or synthetic content fallback. |
| Error | `PROFILE_NOT_FOUND`, `PROFILE_VISIBILITY_CORRUPT`, `PROFILE_PRIVATE`, missing Anime summary, or lane-specific query errors render explicit states. Private non-owners see header, bio, and privacy notice only. |
| Output | Typed header/full profile, or independently paginated Activity, Reviews, and Favorites UI. |
| Owner | `convex/profiles.ts`, `convex/feed.ts`, `convex/reviews.ts`, `convex/userAnime.ts`; route/UI under `src/features/profile` and `src/routes/_public/_profile`. |

`useProfilePages` isolates state by `username:tab`, binds cursors to username/viewer/lane in Convex, deduplicates merged rows, and keeps Activity, Reviews, and Favorites failures independent. It exposes Retry and Load more/end states; IntersectionObserver only requests a next page when no error exists.

## User Search

Username completion and profile name edits call `upsertUserSearchDocument` in the same Convex mutation boundary as the user write. The projection stores only normalized display-name + username text in `userSearchDocuments`; `search_users` is the full-text index and `by_user` detects duplicates. `userSearch:searchPreview` (five rows) powers eligible Quick Search Users. `userSearch:search` requires a complete profile and returns identity-only pages of 20 rows. `userSearch:backfillProfiles` and `verifyProfiles` are internal bounded maintenance functions; current schema requires `users.profileVisibility`.

The dedicated `/search/users` route canonicalizes query whitespace, prompts below two characters, preserves overlong input as an explicit error, and uses a TanStack Query infinite cache keyed by query. Rows are deduplicated by user ID. Auth failure, malformed cursor, provider/Convex failure, Retry, empty, and end states stay visible; no email/auth ID is exposed.

## Owner profile edit

`EditProfileDialog` validates display name (1–50), bio (0–300), and `public|private` Profile Visibility with Zod. `profiles:update` requires the owner profile, normalizes fields, patches `users`, rereads the row, and refreshes its search projection atomically. `PROFILE_EDIT_INVALID` includes field errors; write/index failures raise explicit errors. Cancel performs no mutation.

## Avatar/banner media

1. `profile-image-cropper.tsx` accepts JPEG/PNG/WebP up to 10 MiB, uses `react-easy-crop`, and renders a cropped WebP: avatar 512×512 or banner 1600×400, capped at 2 MiB.
2. `profileMedia:generateUploadUrl` requires the owner. The browser POSTs the cropped bytes to Convex Storage, then immediately calls `registerPending`; registration checks Storage existence, purpose, ownership, and unclaimed state, with a one-hour expiry.
3. `profileMedia:finalize` runs `prepareFinalize` → bounded Storage fetch (three attempts, 50/100 ms delays with warnings) → static WebP signature/chunk/dimension/size validation → `commitFinalize`. Commit swaps the owned `users` reference and removes the pending row; the replaced asset is deleted only after no current or pending claim remains.
4. Failed finalization cleans the pending candidate and reports `PROFILE_MEDIA_*`; cleanup failure is explicit. `profileMedia:remove` clears only the owner’s reference and deletes the asset when unclaimed. Scheduled cleanup scans expired registered uploads only and rechecks claims.

The direct-upload → pending-registration interruption window is real; cleanup never deletes an unregistered or unrelated Storage object. Crop output, upload, finalize, remove, progress, cancellation, and retry errors remain visible in the dialog.

## Verification gaps

- [ ] Browser fixture for a second account viewing a private profile.
- [ ] Real media upload/crop/replace/remove browser flow.
- [ ] Injected provider/storage failure browser flow.
- [ ] Deep pagination beyond the exercised page.
