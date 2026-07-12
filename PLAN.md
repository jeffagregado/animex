# AnimeX MVP Implementation Plan

## Summary

Build AnimeX as phased MVP on TanStack Start, React, Tailwind v4, Convex, Better Auth, shadcn/ui, and Resend. Implementation must stop after each phase for review; no one-shot multi-phase execution.

Approved new production dependencies:
- `@convex-dev/better-auth`
- `resend`

If any other production package is needed, pause and request approval first.

## Key Routes And Interfaces

- `/` redirects to `/home`.
- `/home` public/signed-in feed.
- `/discover` cached AniList browse page.
- `/anime/$anilistId/$slug` anime detail page.
  - Example: `/anime/182255/Frieren-Beyond-Journeys-End-Season-2`
  - `anilistId` is canonical.
  - `slug` is generated from AniList metadata title.
  - If slug is missing or stale, route redirects to canonical slug URL.
- `/u/$username` user profile.
- `/reviews/$reviewId` review detail.
- Auth routes:
  - `/auth/sign-in`
  - `/auth/sign-up`
  - `/auth/verify-email`
  - `/auth/username`
  - `/auth/forgot-password`
  - `/auth/reset-password`
- Settings routes:
  - `/settings/account`
  - `/settings/privacy`
- `/notifications` notification history.

Convex env already available:
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_TEST_MODE`
- `RESEND_TEST_RECIPIENT`
- `RESEND_WEBHOOK_SECRET`
- `SITE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

## Phase Plan

### Phase 1: Foundation

- Fix current TypeScript unused-import errors.
- Initialize Fallow.
- Install approved dependencies only.
- Add needed shadcn/ui components.
- Replace starter route/CSS with AnimeX app shell and Tailwind v4 dark theme.
- Build desktop top nav and mobile bottom nav.
- Stop after validation and wait for approval.

### Phase 2: Auth And User Records

- Wire Better Auth to Convex using `@convex-dev/better-auth`.
- Configure Google OAuth from Convex env.
- Configure Resend SDK email sender from Convex env.
- Implement sign-up, sign-in, email OTP verification, verified-account username completion, link-based password reset, and pending OAuth username completion.
- Preserve typed username capitalization for display while enforcing case-insensitive uniqueness.
- Keep password sign-up to Account Email, password, and confirm password only.
- Require verified password users and provider-verified OAuth users to complete a unique username before private access.
- Use concise Convex user field names: `authId`, `username`, `usernameKey`, `name`, `avatar`, and `visibility`.
- Add shared helpers for auth state, verified-user checks, profile checks, and private route/feature redirects.
- Add header auth action: signed-out users see `Sign in`; signed-in and pending users see `Sign out`.
- Keep Better Auth identity separate from AnimeX `users` profile record.
- Keep `/home` public; gate private account surfaces and signed-in-only actions through auth/profile guards.
- Phase 2 Auth Closure:
  - Use the Verify Email reference as the shared container for missing auth pages.
  - Keep the shared AnimeX header with Home and Discover only.
  - Add password visibility toggles to sign-in, sign-up, and set-new-password forms.
  - Add verification resend and mistyped-email change flow for email-unverified users.
  - Use generic forgot-password success copy and absolute reset redirect URL.
  - Add set-new-password valid, invalid, and reset-success states with the locked copy.
  - Redirect signed-in auth-page users by state: complete to `/home`, unverified to `/auth/verify-email`, and profile-pending to `/auth/username`.
  - Hide private Home surfaces from signed-out, email-unverified, and username-pending users.
  - Header rules: complete users see Search, Notifications, Profile, and Sign out; pending users see Search and Sign out; signed-out users see Search and Sign in.
  - Keep TanStack devtools adapter present but hidden.
  - Extract repeated Convex Better Auth proxy/env helpers from API routes.
- Phase 2 Auth Form Refactor:
  - Migrate auth forms to installed `@tanstack/react-form`.
  - Back auth input validation with installed `zod`.
  - Preserve current auth UI, copy, route redirects, and security behavior.
  - Use Zod in app-owned server/API request parsing only where it reduces malformed-input risk without complicating Better Auth proxy behavior.
  - Keep Convex validators and auth/profile checks as final authority.
- Stop after validation and wait for approval.

### Phase 3: AniList And Discover

- Add server-only TanStack Start AniList GraphQL helpers. Never call AniList from browser or Convex actions.
- Add metadata normalization, canonical numeric `anilistId`, and Unicode-safe title slugs.
- Store lightweight anime summaries and ordered Discover caches through Convex queries/mutations only.
- Cache Trending for 3 hours, Upcoming for 6 hours, and Seasonal/Recommendations for 24 hours.
- Add public `/discover` under shared `_public/route.tsx` layout.
- Build approved desktop/mobile Trending, Seasonal, Genres, Popular Recommendations, This Week, Upcoming, Top Genres desktop module, and future Manga placeholder.
- Add inline anime-only AniList search with genre, format, season, year, sort, and infinite pagination.
  - Keep cards non-interactive until Phase 4 anime detail routes exist.
  - Run schema push, route generation, automated gates, review, and responsive browser QA.
  - Stop after validation and wait for approval.

Phase 3 status: COMPLETE on `dev`; final integrated review PASS with no findings. Validation: 212 tests pass / 2 skipped; TypeScript, build, route generation, Convex dev push, Fallow new-only audit, client endpoint scan, two live AniList tests, and responsive browser QA pass. Phase 4 remains paused until approval.

### Phase 4: Anime Detail

- Build `/anime/$anilistId/$slug`.
- Hydrate full anime metadata by AniList `id` on first page open.
- Redirect stale/missing slug to canonical slug.
- Add Overview, Reviews, Characters, Staff tabs.
- Add Status, Score, Favorite, Review button, and owner-only Rewatch History.
- Stop after validation and wait for approval.

### Phase 5: Feed, Posts, Reviews

- Build Home, Following, Global feed views.
- Add Post Composer.
- Support one optional attached anime per Post.
- Support up to four compressed images, max 5MB each after compression.
- Add Review creation from anime detail only.
- Generate Review activity cards with current Review Rating and Review Summary.
- Stop after validation and wait for approval.

### Phase 6: Profile And Social

- Build User Profile from locked design.
- Add Review tab, latest favorites, anime stats, visible profile activity.
- Add Follow/Unfollow.
- Add likes for posts, reviews, activity cards, comments.
- Add comments and flat comment replies.
- Stop after validation and wait for approval.

### Phase 7: Notifications, Privacy, Moderation

- Add notification preview and notification page.
- Add account default visibility and bulk visibility tools under Privacy Settings.
- Add block/unblock.
- Add reports for posts, reviews, comments, and comment replies.
- Do not allow reports for generated anime status activity cards.
- Stop after validation and wait for approval.

## Test Plan

Each phase must run only relevant checks, then stop:
- `pnpm exec tsc --noEmit`
- `pnpm test`
- `pnpm build`
- `pnpm exec fallow --format compact`
- Browser QA for changed UI paths, desktop and mobile.
- Console check for UI phases.
- Convex validation for schema/function phases.
- `pnpm exec convex dev --once` after Convex changes to push to the Convex dev deployment.

## Assumptions

- AniList `id` is canonical anime identity.
- Slug is display/SEO only and can be regenerated from AniList metadata.
- Local app env is stored in `.env.local`; Convex server env such as `SITE_URL`, Resend, and Google OAuth stays in Convex dashboard.
- AniList image URLs may be stored as external URLs in MVP.
- User uploads use Convex storage.
- Manga remains future placeholder.
- No phase continues automatically into the next phase.
