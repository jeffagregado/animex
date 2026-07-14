# Phase 5 Home And Review Discovery Feedback Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Use fresh orchestration workers only for disjoint owned files; integrate generated files once.

**Goal:** Restore the approved Home desktop utility column, reuse Discover Seasonal data, align feed cards with the approved Home reference, and add indexed Review discovery at `/reviews`.

**Architecture:** Keep AniList traffic in the existing TanStack Start Discover server flow. Add indexed Convex Review discovery and a small per-user List Progress projection. Public and viewer-owned non-public Review lanes merge through opaque cursors. Route files stay thin; domain UI lives under `src/features`.

**Tech Stack:** TanStack Start/Router/Query, React, Convex queries and mutations, Zod, Base UI-backed shadcn components, Tailwind, Vitest, Sonner. No new production dependency, Convex action, AniList transport, external search service, or production deployment.

**Branch:** Continue on `jeff-cx/phase-5-feed-reviews`. Preserve the unrelated generated change in `src/routeTree.gen.ts`; regenerate and integrate it once in Task 9.

**Approved references:**

- `docs/superpowers/specs/2026-07-14-home-reviews-feedback-design.md`
- `docs/visual/home/home-desktop-feed.png`
- `docs/visual/discover/discover-desktop.png`
- `docs/visual/reviews/reviews-list-desktop.png`
- `docs/visual/reviews/reviews-list-mobile.png`

## Locked Interfaces

```ts
type ReviewDiscoverySort = 'newest' | 'rating-high' | 'rating-low'
type ReviewRatingBand = '90-100' | '80-89' | '70-79' | '60-69' | '50-59' |
  '40-49' | '30-39' | '20-29' | '10-19' | '0-9'
type ReviewDiscoveryVisibility = 'all' | 'public' | 'followers' | 'private'
type StoredReviewRatingBand = ReviewRatingBand | 'none'

interface ReviewDiscoveryInput {
  query: string | null
  sort: ReviewDiscoverySort
  ratingBand: ReviewRatingBand | null
  visibility: ReviewDiscoveryVisibility
  cursor: string | null
}

interface ReviewDiscoveryPage {
  items: ReviewListItem[]
  cursor: string | null
  hasMore: boolean
}

interface UserAnimeProgress {
  watching: number
  completed: number
  planned: number
  dropped: number
}
```

- Discovery pages contain at most 12 items. Home Latest Reviews contains at most five Public items.
- `none` is storage-only for unrated drafts. It is never accepted as a public filter and published Reviews always store one of the ten real bands.
- Search is bounded to normalized anime title plus author display name/username. Summary and body are excluded.
- Active search uses Convex relevance order. Empty search uses the selected sort.
- Public users always normalize visibility to `public`. Signed-in `all` includes Public plus only the viewer's Followers/Private Reviews.
- Signed-in all-search places viewer-owned non-public lanes before Public because Convex does not expose comparable scores across separate search queries.
- List Progress counts only Watching, Completed, Plan to Watch, and Dropped. Rewatched and unset entries are excluded.

## Task 1: Lock Review Discovery And Progress Contracts

**Owner:** contracts worker

**Files:**

- Create: `src/features/reviews/shared/review-discovery-contracts.ts`
- Create: `src/features/reviews/shared/review-discovery-contracts.test.ts`
- Modify: `src/features/social/shared/social-contracts.ts`
- Modify: `convex/userAnimePolicy.ts`
- Modify: `convex/userAnimePolicy.test.ts`

**Steps:**

1. Write failing tests for query trimming, two-character minimum, 100-character maximum, sort/rating/visibility parsing, public visibility normalization, 12-item page bounds, and strict cursor/result schemas.
2. Write failing pure-policy tests for progress deltas across unset, Watching, Completed, Plan to Watch, Dropped, and Rewatched transitions.
3. Add the locked types, Zod schemas, constants, and a pure `applyProgressTransition(previous, next, counts)` helper.
4. Reuse `ReviewListItem`; do not fork author/anime/review DTOs.
5. Run:

```powershell
pnpm exec vitest run src/features/reviews/shared/review-discovery-contracts.test.ts convex/userAnimePolicy.test.ts
```

6. Commit:

```powershell
git add src/features/reviews/shared/review-discovery-contracts.ts src/features/reviews/shared/review-discovery-contracts.test.ts src/features/social/shared/social-contracts.ts convex/userAnimePolicy.ts convex/userAnimePolicy.test.ts
git commit -m "test: lock review discovery contracts"
```

## Task 2: Add Migration-Safe Review Discovery Storage

**Owner:** Convex Review worker

**Files:**

- Modify: `convex/schema.ts`
- Create: `convex/reviewDiscoveryPolicy.ts`
- Create: `convex/reviewDiscoveryPolicy.test.ts`
- Modify: `convex/reviews.ts`
- Modify: `convex/social.integration.test.ts`

**Steps:**

1. Write failing integration tests for:
   - latest five Public Reviews in newest order;
   - no Followers/Private leak to public viewers;
   - signed-in own Followers/Private visibility;
   - newest/highest/lowest sort;
   - all ten rating bands and decimal boundaries;
   - anime-title, display-name, and username search;
   - composite cursor continuation, deduplication, retry-safe cursor reuse, and terminal state;
   - Review deletion and visibility changes updating discovery immediately.
2. Add optional migration fields to `reviews` first:

```ts
searchText: v.optional(v.string())
ratingBand: v.optional(storedReviewRatingBandValidator)
```

3. Add one search index with `searchText` as the single search field and equality filter fields for state, visibility, user, and rating band. Add bounded database indexes for each empty-search sort, with public and owner variants and rating-band variants. No `.filter()` scans.
4. Implement pure cursor encode/decode and deterministic lane merge in `reviewDiscoveryPolicy.ts`. Scope cursors to viewer identity, normalized query, sort, rating band, and visibility so a cursor cannot be replayed under wider access.
5. Update Review publish/update/visibility/delete paths so discovery fields and order keys remain atomic with the source Review.
6. Add:
   - `reviews.listLatestPublic({ limit: 5 })` with a hard server cap of five;
   - `reviews.listDiscovery(input)` with a hard page size of 12;
   - resumable `internal.reviews.backfillDiscoveryFields`;
   - resumable `internal.reviews.verifyDiscoveryBackfill`.
7. Hydrate each result through existing author/anime helpers. Missing source data raises an explicit error; do not fabricate metadata.
8. Run focused tests:

```powershell
pnpm exec vitest run convex/reviewDiscoveryPolicy.test.ts convex/social.integration.test.ts
```

9. Do not tighten optional fields yet. Task 8 owns live backfill and final required-schema transition.
10. Commit:

```powershell
git add convex/schema.ts convex/reviewDiscoveryPolicy.ts convex/reviewDiscoveryPolicy.test.ts convex/reviews.ts convex/social.integration.test.ts
git commit -m "feat: add indexed review discovery"
```

## Task 3: Add Atomic List Progress Projection

**Owner:** Convex user-anime worker

**Files:**

- Modify: `convex/schema.ts`
- Modify: `convex/userAnime.ts`
- Modify: `convex/userAnimePolicy.ts`
- Modify: `convex/userAnime.integration.test.ts`

**Steps:**

1. Write failing integration tests for zero state, each counted status, excluded unset/Rewatched states, first-score auto-Watching, repeated idempotent writes, status replacement, rewatch transition, and rewatch rollback.
2. Add `userAnimeProgress` with one indexed row per user and the four nonnegative counts.
3. Add `userAnime.getMyProgress`; it must derive identity through `requireProfile` and return explicit zeros when no aggregate row exists.
4. Apply the pure transition helper atomically in every status-changing mutation path:
   - `setStatus`;
   - `setScore` when first score changes unset status to Watching;
   - `recordRewatch`;
   - `removeLatestRewatch`.
5. Add resumable, idempotent internal backfill and verification mutations. Recompute a user's counts from indexed `userAnimeEntries` reads, then replace the aggregate rather than incrementing an unknown partial state.
6. Run:

```powershell
pnpm exec vitest run convex/userAnimePolicy.test.ts convex/userAnime.integration.test.ts
```

7. Commit:

```powershell
git add convex/schema.ts convex/userAnime.ts convex/userAnimePolicy.ts convex/userAnime.integration.test.ts
git commit -m "feat: add list progress projection"
```

## Task 4: Reuse Discover Data On Home

**Owner:** Home data-flow worker

**Files:**

- Modify: `src/routes/_public/home.tsx`
- Modify: `src/features/home/home-page.tsx`
- Modify: `src/features/home/home-page.test.tsx`
- Create: `src/features/discover/ui/use-discover-section-refresh.ts`
- Modify: `src/features/discover/ui/discover-page.tsx`
- Delete: `src/features/home/home-data.ts`
- Delete: `src/features/home/seasonal-rail.tsx`

**Steps:**

1. Write failing Home tests proving Seasonal comes from the Home loader's Discover payload and preserves loading, retry, empty, image-error, and rail controls.
2. Extract the existing section refresh behavior into one reusable Discover hook; keep provider loading/rate-limit behavior unchanged.
3. Add a Home route loader using `getDiscoverPage()` and pass its hydrated data to `HomePage`.
4. Render Seasonal through `DiscoverSectionRail`. Remove the static Home dataset and component.
5. Do not add a second AniList query, endpoint, server function, or Convex action.
6. Run:

```powershell
pnpm exec vitest run src/features/home/home-page.test.tsx src/features/discover/ui/discover-page.test.tsx src/features/discover/ui/discover-section.test.tsx
```

7. Commit:

```powershell
git add src/routes/_public/home.tsx src/features/home src/features/discover/ui/use-discover-section-refresh.ts src/features/discover/ui/discover-page.tsx
git commit -m "refactor: reuse discover seasonal on home"
```

## Task 5: Restore The Home Desktop Utility Column

**Owner:** Home UI worker

**Files:**

- Create: `src/features/home/home-sidebar.tsx`
- Create: `src/features/home/home-list-progress.tsx`
- Create: `src/features/home/home-latest-reviews.tsx`
- Create: `src/features/home/home-sidebar.test.tsx`
- Modify: `src/features/home/home-page.tsx`
- Modify: `src/features/home/home-page.test.tsx`
- Modify: `src/features/feed/feed-page.tsx`

**Steps:**

1. Write failing tests for exact public order: Latest Reviews, This Week, Upcoming.
2. Write failing tests for exact signed-in order: List Progress, Latest Reviews, This Week, Upcoming.
3. Prove public rendering does not issue `getMyProgress` and the sidebar is hidden below `lg`.
4. Build scoped loading, empty, error, and retry states for Latest Reviews and List Progress. Preserve loaded content on a retryable refresh error.
5. Latest Reviews rows show cover, author, relative timestamp, two-line Summary, no Rating, Review Detail link, and `See more` to `/reviews`.
6. Reuse `DiscoverWeeklyList` and `DiscoverUpcomingList`; do not copy their markup.
7. Remove `Community feed` and signed-in `What are you watching?`. Keep the Create Post button and existing feed tabs.
8. At desktop, use the approved main/feed plus compact right-column geometry. At 390/768, render no utility column and no unreachable modules after the infinite feed.
9. Run:

```powershell
pnpm exec vitest run src/features/home/home-sidebar.test.tsx src/features/home/home-page.test.tsx
```

10. Commit:

```powershell
git add src/features/home src/features/feed/feed-page.tsx
git commit -m "feat: restore home utility column"
```

## Task 6: Align Feed Cards With The Approved Home Reference

**Owner:** feed-card UI worker

**Files:**

- Modify: `src/features/feed/feed-card.tsx`
- Modify: `src/features/feed/feed-card.test.tsx`
- Modify: `src/features/feed/feed-list.tsx`
- Modify when separation is needed: `src/features/feed/post-image-grid.tsx`
- Modify when separation is needed: `src/features/feed/feed-owner-actions.tsx`

**Steps:**

1. Write failing behavior/structure tests for coral Post accent, cyan Review/Completed/Rewatched accent, compact activity header, owner menu, timestamp, Review anime cover/title/Rating/Summary, and responsive image framing.
2. Restyle with Tailwind to match `home-desktop-feed.png` while retaining current DTO truth.
3. Preserve Post spoiler reveal, Review Summary spoiler reveal, direct activity links, Review Detail links, owner edit/visibility/delete, and disabled Phase 6 Like/Comment labels.
4. Assert absent fake reaction counts, bookmarks, milestone Score/descriptions, and Post anime attachment.
5. Test hover, focus-visible, pending, disabled, spoiler-covered, spoiler-revealed, image-error, and owner-menu-open class states.
6. Run:

```powershell
pnpm exec vitest run src/features/feed/feed-card.test.tsx src/features/feed/feed-card-detail-page.test.tsx src/features/feed/feed-owner-actions.test.tsx
```

7. Commit:

```powershell
git add src/features/feed
git commit -m "style: align home feed cards"
```

## Task 7: Build The Public `/reviews` Route

**Owner:** Review discovery UI worker

**Files:**

- Create: `src/routes/_public/reviews/index.tsx`
- Create: `src/routes/_public/reviews/-review-search.test.ts`
- Create: `src/features/reviews/discovery/review-discovery-page.tsx`
- Create: `src/features/reviews/discovery/review-discovery-filters.tsx`
- Create: `src/features/reviews/discovery/review-discovery-card.tsx`
- Create: `src/features/reviews/discovery/review-discovery-state.ts`
- Create: `src/features/reviews/discovery/use-review-discovery-pages.ts`
- Create: `src/features/reviews/discovery/review-discovery-page.test.tsx`
- Create: `src/features/reviews/discovery/use-review-discovery-pages.test.tsx`
- Reuse: `src/features/reviews/ui/review-summary.tsx`

**Steps:**

1. Write route-state tests for invalid value normalization, public visibility locking, signed-in visibility options, and URL replace navigation.
2. Add the path using the existing directory route convention. Keep `index.tsx` thin: validate search, normalize auth-aware visibility, render the feature page.
3. Implement 300 ms trailing search debounce. Query text under two characters does not reach Convex. Clearing restores selected sort.
4. Active search disables the sort Select and labels it `Relevance`; rating and visibility remain active.
5. Build a scope/epoch-isolated cursor hook following `useFeedPages`: ignore stale auth/filter responses, dedupe IDs, retain loaded cards during pagination failure, retry the failed cursor, and prevent duplicate in-flight requests.
6. Use `IntersectionObserver` for 12-item infinite pages. Provide skeleton, empty, retry, and terminal rows that preserve list geometry.
7. Card fields: anime cover/title, Rating, Summary, author, timestamp, visibility where owner-only content needs disclosure, spoiler reveal, and Review Detail action. Never render the full body.
8. Match the approved desktop/mobile references. Use AnimeX shell navigation rather than older reference-only navigation.
9. Run:

```powershell
pnpm exec vitest run src/routes/_public/reviews/-review-search.test.ts src/features/reviews/discovery/review-discovery-page.test.tsx src/features/reviews/discovery/use-review-discovery-pages.test.tsx
```

10. Commit:

```powershell
git add src/routes/_public/reviews src/features/reviews/discovery
git commit -m "feat: add review discovery page"
```

## Task 8: Execute And Verify Convex Backfills

**Owner:** controller; no parallel schema edits

**Files:**

- Modify: `convex/schema.ts` after successful verification
- Modify: `TODO.md`
- Record current state: `docs/architecture/review-discovery-data-flow.md`

**Steps:**

1. Push the migration-safe optional schema and functions:

```powershell
pnpm exec convex dev --once
```

2. Run Review discovery backfill repeatedly using its returned cursor until `isDone: true`. Then run its verification mutation and require zero missing/mismatched published Reviews.
3. Run List Progress backfill repeatedly until `isDone: true`. Then run verification and require every user aggregate to match indexed entries.
4. If verification fails, stop with the exact offending IDs/counts. Do not tighten the schema or invent fallback data.
5. Change `searchText` and the storage band (`none` for unrated drafts, a real band for published Reviews) to required only after the Review verification passes. Push again:

```powershell
pnpm exec convex dev --once
```

6. Document final indexes, cursor lanes, projection ownership, backfill result counts, and failure behavior as current state. Do not record credentials or test content.
7. Commit:

```powershell
git add convex/schema.ts docs/architecture/review-discovery-data-flow.md TODO.md
git commit -m "docs: record review discovery data flow"
```

## Task 9: Integrate Routes, Generated Types, And Full Automated Gates

**Owner:** controller, then fresh reviewer and QA agents

**Files:**

- Generated: `convex/_generated/*`
- Generated: `src/routeTree.gen.ts`
- Modify: `TODO.md`

**Steps:**

1. Integrate worker commits once. Resolve overlaps against current source; never overwrite unrelated user work.
2. Generate once after all source routes and Convex contracts are stable:

```powershell
pnpm generate-routes
pnpm exec convex dev --once
```

3. Run affected focused tests, then the full gates once:

```powershell
pnpm test
pnpm exec tsc --noEmit
pnpm build
pnpm exec fallow audit --base HEAD --gate new-only --format json --quiet
git diff --check
```

4. Scan built client assets for `graphql.anilist.co`; require no match.
5. Run a fresh read-only reviewer for access control, cursor correctness, migration safety, source-truth rendering, and UI regressions. Fix findings before QA.
6. Commit only verified generated and tracker changes:

```powershell
git add convex/_generated src/routeTree.gen.ts TODO.md
git commit -m "chore: integrate home review feedback"
```

## Task 10: Live Browser QA With A Real Signed-In Account

**Owner:** fresh QA agent plus controller cleanup

**Authorization:** The user explicitly approved creation of a dedicated dev test account and real test Post, Anime Detail state, and Review fixtures. This does not authorize production deployment or external sharing.

**Account safety:**

- Sign up through the real UI using a unique Resend sandbox address such as `delivered+animex-p5-home-<runid>@resend.dev` and a unique allowed username.
- Generate an ephemeral password. Never commit, print, screenshot, or report the password, OTP, session token, email body, API key, or request payload.
- Read only the verification value needed from the existing Resend preview/CLI flow; keep it out of repository evidence and chat.
- Complete email verification and profile creation. Retain the dev-only account if account deletion is unavailable; do not leave credentials in source, docs, shell history, or screenshots.

**Fixtures and lifecycle:**

1. Create a real text Post and a one-image Post through Composer. Verify publish, image upload, spoiler reveal, edit, visibility change, direct activity, and owner delete.
2. On Anime Detail pages, verify first-score auto-Watching, explicit Plan to Watch/Completed/Dropped transitions, Score editing, Favorite, Rewatch History eligibility, 750 ms autosave and focus preservation, Sonner states, and List Progress count changes.
3. Create and resume a Review draft, then publish one Review with Summary/body/spoiler/media-preview coverage. Verify edit, Public/Followers/Private visibility, Review Detail, Anime Reviews, Home Latest Reviews, and `/reviews` discovery.
4. Create enough Review records through normal authenticated UI across cached anime when practical to cross the 12-item boundary. If the dev dataset still cannot reach 13 visible Reviews, validate pagination with Convex integration tests and record browser pagination as data-blocked; do not add or retain a production QA seed endpoint.
5. Exercise deletion last so prior surfaces can be inspected. Remove created Posts/Review and reset Score/Favorite/status/rewatches where the product supports it. Record any intentionally retained dev-only state without credentials.

**Responsive and interaction matrix:**

- At 1280 px, verify signed-out and signed-in Home utility order, visible right column, Seasonal rail, feed cards, `/reviews`, and owner controls.
- At 390 and 768 px, verify the utility column is absent, feed remains reachable with infinite pagination, Reviews filters fit, touch states do not stick, and no horizontal overflow occurs.
- Use locator-driven pointer hover on feed cards, owner menus, Create Post, Review rows/cards, search, each Select trigger and every open option, retry controls, sidebar rows, rail arrows, and spoiler controls.
- Capture default/hover/open/focus/disabled/pending/error states. Inspect computed background, foreground, border, and icon colors. Require no white/native popup backgrounds, browser-blue leakage, disappearing borders, scrollbar-gutter shift, or layout movement.
- Separately verify keyboard focus, Arrow/Enter/Escape behavior, focus restoration, touch/pressed states, back/forward URL restoration, search debounce, relevance mode, rating/visibility filters, infinite-scroll continuation, retry, and terminal state.
- Check browser console, hydration, failed requests, auth redirects, network access, image failures, layout shift, and overflow at each width.

**Exit rule:** Stop after QA, cleanup, reviewer/QA PASS, and tracker update. Do not deploy or merge. If a real upstream/auth state blocks a scenario, record the exact blocker and completed evidence instead of claiming PASS.

## Orchestration Order

1. Task 1 locks contracts.
2. Tasks 2 and 3 may run in parallel after Task 1; schema ownership is coordinated by controller.
3. Tasks 4, 5, 6, and 7 may run in parallel only with the file ownership above.
4. Controller performs Tasks 8 and 9 once.
5. Fresh reviewer and QA perform Task 10 after all automated gates pass.

## Final Acceptance

- Home matches the approved public/signed-in desktop compositions and contains no removed placeholders.
- Seasonal, This Week, and Upcoming reuse the existing Discover cache/data flow.
- Feed cards match approved visual structure without fake Phase 6 data.
- `/reviews` access, search, sort, bands, visibility, cursors, retry, and infinite scroll are correct.
- List Progress stays atomic across every status-changing path and verified backfill.
- No private Review or progress data leaks to public viewers.
- No Convex action, client AniList endpoint, external search, new production dependency, production deploy, or automatic merge.
- Real signed-in browser QA covers Post, Anime Detail, Review, Home, and Review discovery flows with secrets excluded from evidence.
