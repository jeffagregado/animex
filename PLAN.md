# AnimeX MVP Implementation Plan

## Summary

Build AnimeX as phased MVP on TanStack Start, React, Tailwind v4, Convex, Better Auth, shadcn/ui, and Resend. Implementation must stop after each phase for review; no one-shot multi-phase execution.

Approved new production dependencies:
- `@convex-dev/better-auth`
- `resend`

If any other production package is needed, pause and request approval first.

## Key Routes And Interfaces

- `/` public Quiet Signal landing page.
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
  - Link cards and list rows to canonical Phase 4 anime detail routes.
  - Run schema push, route generation, automated gates, review, and responsive browser QA.
  - Stop after validation and wait for approval.

Phase 3 status: COMPLETE on `dev`; final integrated review PASS with no findings. Validation: 212 tests pass / 2 skipped; TypeScript, build, route generation, Convex dev push, Fallow new-only audit, client endpoint scan, two live AniList tests, and responsive browser QA pass.

### Phase 4: Anime Detail

- Build `/anime/$anilistId/$slug`.
- Hydrate full anime metadata by AniList `id` through a server-only 24-hour Convex cache.
- Redirect stale/missing slug to canonical slug.
- Add Overview, Reviews, Characters, Staff tabs.
- Add Status, Score, Favorite, and owner-only Rewatch History; review creation remains Phase 5.
- Limit Related Anime and Recommendations to five; load Characters and Staff in explicit 24-item pages.
- Persist Completed/Rewatched milestones for Phase 5 feed use.
- Stop after validation and wait for approval.

Phase 4 status: COMPLETE on `jeff-cx/phase-4-anime-detail`; automated gates, Convex push, live AniList smoke, responsive browser QA, final QA, and integrated review pass.

### Phase 5: Feed, Posts, Reviews

Status: COMPLETE and integrated on `dev`; closure details and latest validation live in `TODO.md` and `design-qa.md`.

- Build Home, Following, Global feed views.
- Add Post Composer.
- Posts currently accept zero or one safe external HTTPS image/video URL. Post anime attachment remains optional backlog, not implemented in Phase 5.
- Add Review creation from anime detail only.
- Generate Review activity cards with current Review Rating and Review Summary.
- Stop after validation and wait for approval.

### Phase 6: Quiet Signal Landing

Status: COMPLETE. Approved landing and AnimeX favicon set are implemented and validated.

- `/` shows the Quiet Signal landing to signed-out and signed-in visitors.
- Dedicated composition reuses `SiteHeader` and auth controls without `PublicShell` or mobile bottom navigation.
- Hero copy and single `/discover` action match the accepted design contract.
- Desktop/tablet use CSS rings and outlined `AX`; widths below `768px` use content-only layout.
- Native CSS ambient motion becomes static under reduced-motion preference.
- Shared root head publishes AnimeX SVG, ICO, Apple touch, and manifest assets derived from the existing logo mark.
- Phase 6 validation and responsive browser QA are complete.
- Stop after validation and wait for approval.

### Pre-Phase 7: Social UI Embargo Cleanup

Status: COMPLETE. Implementation, review, responsive browser QA, cleanup, and Convex dev redeploy pass.

- Active Home views are Home and Global. Direct stale Following selection replaces to Home before a Following query can mount.
- Active Post and Review visibility choices are Public and Private. A stored Followers account default maps to Private for new content.
- Active Review discovery choices are All, Public, and My Private. A stale Followers URL replaces before discovery queries mount.
- Legacy Followers Posts and Reviews stay owner-readable. Unrelated edits preserve Followers; explicit Public/Private selection migrates the record.
- Social controls, counts, labels, Followers choices, and phase placeholders are absent from active UI.
- Backend schemas, stored Followers data, authorization, and Phase 9 social contracts remain intact. No migration ran.
- Historical boundary satisfied: Phase 7 started only after validation and explicit approval.

### Phase 7: User Profile, Catalog People, And Quick Search

Status: COMPLETE AND CLOSED. Implemented, validated, and merged locally into `dev` at `9fdfc6b`; approved visual contract shipped, final feedback reviewer PASS, and current-state docs synced. Second-account private-profile, real media lifecycle, and injected Storage failure/retry verification are closed. User confirmed closure for deep pagination; Codex did not independently exercise that fixture. No production push or deploy is claimed.

- Build User Profile from locked design.
- Use signed-in routes at `/users/:username` with Activity default plus Reviews and Favorites `tab` query states.
- Add Public/Private Profile Visibility separate from content-default visibility; Private shows header identity/bio only to non-owners.
- Add latest 10 favorites, full Favorites tab, completed/watching/planned/dropped stats, and viewer-allowed profile activity.
- Add profile editing with `react-easy-crop`, Convex Storage-backed 1:1 avatar and 4:1 banner media, explicit validation, replacement, removal, and cleanup.
- Build canonical Character and Staff detail destinations with Overview plus Anime pagination; legacy Staff `?tab=works` canonicalizes to `?tab=anime` without changing provider/cache identities.
- Build desktop Quick Search and mobile Search drawer from the locked visual references.
- Open Quick Search from the desktop header Search control for signed-out and signed-in visitors.
- Open the mobile Search drawer from the bottom Search tab, using the locked Base UI-backed drawer design with its search field pinned at the bottom.
- Add live grouped results capped at five per group for Anime, Characters, Staff, and signed-in Users; signed-out search omits Users.
- Route View all Anime to `/discover?q=...`, Characters to `/search/characters?q=...`, Staff to `/search/staff?q=...`, and signed-in Users to `/search/users?q=...`.
- Include loading, empty, error, keyboard, focus, scroll, dismissal, and responsive states without category-selection controls.
- Keep Discover separate from Quick Search and keep Manga as a future-only group.
- Omit Favorite Genres, Anime List, Follow actions, follower/following counts, Like actions/counts, Comment actions/counts, and social activity footers.
- Treat social elements in the locked profile reference as Phase 9 final-state elements.
- Use `docs/superpowers/specs/2026-07-17-phase-7-user-profile-quick-search-design.md` as the approved design source.
- Review `docs/superpowers/plans/2026-07-17-phase-7-user-profile-catalog-people-quick-search.md` before implementation.
- Record closure evidence accurately: second-account private-profile viewing, real media lifecycle, and injected Storage failure/retry are Codex-verified; deep pagination is closed by user confirmation without Codex-run evidence.

### Phase 7 Feedback Fixes

Status: COMPLETE. Final reviewer PASS after the keyboard Profile fix. Shared header auth state and avatar owner menu, server-first Profile auth/read facades, Profile SPA tabs, shared UserAvatar geometry, neutral Anime/Character/Staff layout, legacy Staff tab migration, and AnimeX root not-found UI are implemented and browser-verified.

- Complete accounts use one 44 px circular UserAvatar trigger with exactly Profile and Sign out; pending sign-out is guarded and success-only navigation reaches `/home`.
- Profile `beforeLoad` resolves auth before child DOM/query mount. Authenticated server facades own Profile/User Search reads; client Convex synchronization gates only identity-dependent mutations. There is no `Checking authentication` DOM.
- UserAvatar is shared across Quick Search, `/search/users`, Feed, and Profile. Quick Search/header use 44 px, User Search uses 64 px, and Profile uses 96 px mobile or 128 px tablet/desktop with scaled fallback glyphs.
- Character and Staff use shared neutral detail geometry and Overview/Anime only. Staff `?tab=works` replaces to `?tab=anime`; work provider/cache semantics are unchanged. Anime behavior remains Anime-specific inside shared geometry.
- Final QA: 131 test files passed / 2 skipped; 925 tests passed / 3 skipped (928 total); TypeScript and client + SSR build passed with the existing >500 kB warning; Fallow against `3fdda5c` passed with one pre-existing non-error finding, 0 complexity, and 0 duplication; React Doctor score 53, equal to baseline. Route-tree protected SHA-256 remained `14A6932D22316BF69AF6EA6C1E343EE0C4704DE66039C8A674888D11ABA92DDD`. No Convex source changed, so no `convex dev --once` was required.
- Browser QA passed with both named QA accounts at 390×844, 768×1024, and 1280×800: no horizontal overflow; avatar geometry; owner menu pointer/keyboard behavior including Profile Enter, Escape focus return, and outside close; Quick Search/User Search avatars; Profile tabs/back/forward/reload; Character/Staff Overview/Anime and Staff migration; private-profile cross-account visibility; signed-out server redirect; root not-found; clean final console/server logs. QA server stopped, port 3000 freed, viewport reset, and account signed out.
- No Phase 7 browser fixture remains open. Deep pagination closed by user confirmation without Codex-run evidence.

### Phase 8: Notifications, Privacy, Moderation

- Add notification preview/page foundations and required moderation notifications.
- Add account default visibility and bulk visibility tools under Privacy Settings; expose Public and Private choices only until Phase 9.
- Add block/unblock.
- Add reports and moderation for Posts and Reviews.
- Do not allow reports for generated anime status activity cards.
- Defer Follow, Like, Comment, and Comment Reply notifications, preferences, deduplication, reports, moderation, and Block integrations to Phase 9.
- Keep all social interaction UI absent.
- Stop after validation and wait for approval.

### Phase 9: Social Interactions

Status: FINAL MVP PHASE.

- Add Follow/Unfollow, follower/following counts, Following feed behavior, and Followers-only visibility choices.
- Add Likes for Posts, Reviews, Activity cards, and Comments.
- Add text-only Comments, flat Comment Replies, and removable Reply Tags.
- Add Comment and Comment Reply reporting/moderation plus full Block enforcement across social mutations.
- Add social notification sources, preferences, target access, and deduplication.
- Unhide and enable all approved social UI across feed, Review, User Profile, notifications, privacy, Block, report, and moderation surfaces.
- Do not retain disabled social placeholders after functional UI is available.
- Stop after validation and wait for approval.

## Optional Future Features

### Metadata Image Proxy

Status: NOT SCHEDULED. This infrastructure feature is separate from the phased MVP and other optional product features.

- Replace client-visible AniList image URLs with provider-neutral URLs shaped as `/media/$entity/$id/$variant?v=$version`.
- Support `anime` cover/banner and Character/Staff portrait variants without naming AniList in the public route.
- Keep upstream image URLs server-only. Store URL metadata and a source-version fingerprint in Convex; do not store image bytes in Convex and do not use Convex actions.
- Resolve an image through an indexed internal Convex read. A proxy cache miss must fetch only the stored image URL and must never call AniList GraphQL.
- Preserve metadata cache policy independently: Trending 3 hours, Seasonal and Recommendations 24 hours, Upcoming 6 hours, and Anime Detail/people pages 24 hours.
- Cache image responses in the browser for 24 hours and shared CDN/reverse-proxy cache for 30 days, with a 7-day stale-while-revalidate window and no stale-if-error fallback. A changed source fingerprint creates a new public URL and cache key.
- Validate entity, ID, variant, version, HTTPS, upstream host, redirects, image content type, response size, and timeout. Do not accept a client-supplied source URL.
- Use the same TanStack Start server-route contract on Vercel or a VPS. Vercel uses response cache headers; VPS deployments place an equivalent Nginx/Caddy cache in front.
- Keep Post and Review external media outside this proxy contract.

## Test Plan

Each phase must run only relevant checks, then stop:
- `pnpm exec tsc --noEmit`
- `pnpm test`
- `pnpm build`
- `pnpm exec fallow audit --base <resolved-base> --format json --quiet`
- Browser QA for changed UI paths, desktop and mobile.
- Console check for UI phases.
- Convex validation for schema/function phases.
- `pnpm exec convex dev --once` after Convex changes to push to the Convex dev deployment.

## Assumptions

- AniList `id` is canonical anime identity.
- Slug is display/SEO only and can be regenerated from AniList metadata.
- Local app env is stored in `.env.local`; Convex server env such as `SITE_URL`, Resend, and Google OAuth stays in Convex dashboard.
- AniList image URLs may be stored as external URLs in MVP.
- Metadata Image Proxy remains optional and unimplemented; direct external AniList image URLs remain current MVP behavior until it is scheduled.
- Post media uses external HTTPS URLs; no Post file upload, compression, or first-party Post media storage exists. Other user-owned upload features may use Convex Storage under their own contract.
- Manga remains future placeholder.
- No phase continues automatically into the next phase.
