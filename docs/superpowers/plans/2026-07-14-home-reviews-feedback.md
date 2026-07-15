# Phase 5 Home And Review Discovery Feedback Implementation Plan

Status: COMPLETE and integrated on `dev`. Unchecked steps below preserve historical execution sequence; they are not open product work. Current closure is tracked in `TODO.md` and `design-qa.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use fresh orchestration workers only for disjoint owned files; integrate generated files once.

**Goal:** Restore the approved Home desktop utility column, reuse Discover Seasonal data, align feed cards with the approved Home reference, and add indexed Review discovery at `/reviews`.

**Architecture:** Keep AniList traffic in the existing TanStack Start Discover server flow. Add indexed Convex Review discovery and a small per-user List Progress projection. Public and viewer-owned non-public Review lanes merge through opaque cursors. Route files stay thin; domain UI lives under `src/features`.

**Tech Stack:** TanStack Start/Router/Query, React, Convex queries and mutations, Zod, Base UI-backed shadcn components, Tailwind, Vitest, Sonner. No new production dependency, Convex action, AniList transport, external search service, or production deployment.

## Global Constraints

- Use direct `base-nova` registry items; never replace Base UI surfaces with new Radix-backed components.
- Reuse existing Select, Dialog, Sonner, and `AsyncButton`; do not add duplicate primitives or Spinner.
- Require zero `package.json` or `pnpm-lock.yaml` change from shared component generation.
- Preserve approved visual references, responsive behavior, keyboard access, touch behavior, dark-theme hover/open states, and Home feed infinite pagination.
- Keep TanStack route files thin, use directory `route.tsx` for shared/protected ownership, and regenerate route tree once.
- Use Convex indexed queries/mutations only; no actions, table-filter scans, client AniList endpoint, or production deployment.
- No production fixture endpoint. Real QA account data stays dev-only and secrets never enter repository evidence.

---

**Branch:** Continue on `jeff-cx/phase-5-feed-reviews`. Preserve the unrelated generated change in `src/routeTree.gen.ts`; regenerate and integrate it once in Task 10.

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
- Signed-in all-search lane order is deterministic: My Followers, then My Private, then Public. Cursor state advances each lane independently; relevance scores never merge across lanes.
- List Progress counts only Watching, Completed, Plan to Watch, and Dropped. Rewatched and unset entries are excluded.
- `userAnimeProgress` stays sparse: one indexed row for users with list-status activity or migrated entries. Untouched users have no row and read as explicit zeros.

## Task 1: Add Base UI Shadcn Foundations

**Owner:** shared UI worker

**Files:**

- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/card.tsx`
- Create: `src/components/ui/badge.tsx`
- Create: `src/components/ui/skeleton.tsx`
- Create: `src/components/ui/empty.tsx`
- Create: `src/components/ui/progress.tsx`
- Create: `src/components/ui/dropdown-menu.tsx`
- Create: `src/components/ui/input.tsx` (Input Group registry dependency)
- Create: `src/components/ui/textarea.tsx` (Input Group registry dependency)
- Create: `src/components/ui/input-group.tsx`
- Reuse unchanged: `src/components/ui/select.tsx`
- Reuse unchanged: `src/components/ui/dialog.tsx`
- Reuse unchanged: `src/components/ui/sonner.tsx`

**Interfaces:**

- Produces shared `Button`, `Card`, `Badge`, `Skeleton`, `Empty`, `Progress`, `DropdownMenu`, `Input`, and `InputGroup` exports for Tasks 6–8.
- Existing `Select`, `Dialog`, and `Toaster` remain authoritative. Do not create duplicates.

**Steps:**

1. Refresh local registry context and official component docs before applying source:

```powershell
pnpm dlx shadcn@latest info --json
pnpm dlx shadcn@latest docs button input-group card badge skeleton empty progress dropdown-menu
```

Expected: TanStack Start, Tailwind v4, `#/components/ui` alias, Lucide icons. Current `components.json` may report Radix; this does not override AnimeX's Base UI requirement.

2. Dry-run direct Base Nova registry items. Never use bare component names because current project registry metadata points at Radix:

```powershell
pnpm dlx shadcn@latest add https://ui.shadcn.com/r/styles/base-nova/button.json https://ui.shadcn.com/r/styles/base-nova/input-group.json https://ui.shadcn.com/r/styles/base-nova/card.json https://ui.shadcn.com/r/styles/base-nova/badge.json https://ui.shadcn.com/r/styles/base-nova/skeleton.json https://ui.shadcn.com/r/styles/base-nova/empty.json https://ui.shadcn.com/r/styles/base-nova/progress.json https://ui.shadcn.com/r/styles/base-nova/dropdown-menu.json --dry-run
```

Expected: eight requested registry items and ten new UI source files because Input Group also owns Input and Textarea. No overwrite of Select, Dialog, Sonner, global styles, or configuration.

3. Inspect each registry source with `--view`. Require Base UI imports for Button, Progress, and Dropdown Menu. Require existing `#/lib/utils.ts` and Lucide aliases.

```powershell
pnpm dlx shadcn@latest add https://ui.shadcn.com/r/styles/base-nova/button.json --view button.tsx
pnpm dlx shadcn@latest add https://ui.shadcn.com/r/styles/base-nova/progress.json --view progress.tsx
pnpm dlx shadcn@latest add https://ui.shadcn.com/r/styles/base-nova/dropdown-menu.json --view dropdown-menu.tsx
```

4. Apply exact direct URLs only after dry-run/source inspection passes:

```powershell
pnpm dlx shadcn@latest add https://ui.shadcn.com/r/styles/base-nova/button.json https://ui.shadcn.com/r/styles/base-nova/input-group.json https://ui.shadcn.com/r/styles/base-nova/card.json https://ui.shadcn.com/r/styles/base-nova/badge.json https://ui.shadcn.com/r/styles/base-nova/skeleton.json https://ui.shadcn.com/r/styles/base-nova/empty.json https://ui.shadcn.com/r/styles/base-nova/progress.json https://ui.shadcn.com/r/styles/base-nova/dropdown-menu.json
```

5. Inspect `package.json` and `pnpm-lock.yaml` immediately. Existing `@base-ui/react`, `class-variance-authority`, `lucide-react`, and `radix-ui` satisfy current registry metadata. Require no dependency/version change. If either dependency file changes, stop and report exact diff before proceeding.
6. Preserve upstream component composition while adapting source to repository rules:
   - replace default parameter values with explicit `??` resolution;
   - keep named exports and files below 300 lines;
   - use AnimeX semantic tokens and fixed dark-theme behavior;
   - remove white/native hover, focus, selected, and popup surfaces;
   - use `cn()` and `gap-*`; no `space-*` utilities;
   - keep Base UI `render` composition and accessible labels/values;
   - keep every Dropdown Menu item inside `DropdownMenuGroup` and every Select item inside `SelectGroup` in new or modified consumers.
7. Use full Card composition in later consumers: Header/Title/Description/Content/Footer only where those regions exist. Do not wrap feed layouts in decorative nested Cards without purpose.
8. Run compile and existing shared-component consumers:

```powershell
pnpm exec tsc --noEmit
pnpm exec vitest run src/features/discover/ui/discover-search-filters.test.tsx src/features/feed/feed-owner-actions.test.tsx
git diff --check
```

Expected: PASS; no package/lock diff; no changes outside ten new UI files.

9. Commit:

```powershell
git add src/components/ui/button.tsx src/components/ui/card.tsx src/components/ui/badge.tsx src/components/ui/skeleton.tsx src/components/ui/empty.tsx src/components/ui/progress.tsx src/components/ui/dropdown-menu.tsx src/components/ui/input.tsx src/components/ui/textarea.tsx src/components/ui/input-group.tsx
git commit -m "feat: add base ui shadcn foundations"
```

## Task 2: Lock Review Discovery And Progress Contracts

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

## Task 3: Add Migration-Safe Review Discovery Storage

**Owner:** Convex Review worker

**Files:**

- Modify: `convex/schema.ts`
- Create: `convex/reviewDiscovery.ts`
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

3. Add exactly one `search_discovery` index with `searchText` as the single search field and equality filter fields `state`, `visibility`, `userId`, and `ratingBand`. For each of newest/high/low order keys, add four bounded indexes: Public; Public + rating band; owner + visibility; owner + visibility + rating band. Existing five plus these thirteen remain below Convex's 32-index table limit. No `.filter()` scans.
4. Implement pure cursor encode/decode and deterministic lane merge in `reviewDiscoveryPolicy.ts`. Scope cursors to version, viewer identity, normalized query, sort, rating band, and visibility so a cursor cannot be replayed under wider access. Empty-search cursors hold independent order-key anchors/completion flags. Search cursors hold independent Convex cursors and the fixed My Followers → My Private → Public phase.
5. Update Review publish/update/visibility/delete paths so discovery fields and order keys remain atomic with the source Review.
6. Add:
   - `reviews.listLatestPublic({ limit: 5 })` with a hard server cap of five;
   - `reviews.listDiscovery(input)` with a hard page size of 12;
   - resumable `internal.reviews.backfillDiscoveryFields` for every draft and published Review; published Reviews without a rating fail explicitly instead of receiving the draft-only `none` band;
   - resumable `internal.reviews.verifyDiscoveryBackfill` for every Review.
7. Hydrate each result through existing author/anime helpers. Missing source data raises an explicit error; do not fabricate metadata.
8. Run focused tests:

```powershell
pnpm exec vitest run convex/reviewDiscoveryPolicy.test.ts convex/social.integration.test.ts
```

9. Do not tighten optional fields yet. Task 9 owns live backfill and final required-schema transition.
10. Commit:

```powershell
git add convex/schema.ts convex/reviewDiscoveryPolicy.ts convex/reviewDiscoveryPolicy.test.ts convex/reviews.ts convex/social.integration.test.ts
git commit -m "feat: add indexed review discovery"
```

## Task 4: Add Atomic List Progress Projection

**Owner:** Convex user-anime worker

**Files:**

- Modify: `convex/schema.ts`
- Modify: `convex/userAnime.ts`
- Modify: `convex/userAnimePolicy.ts`
- Modify: `convex/userAnime.integration.test.ts`

**Steps:**

1. Write failing integration tests for zero state, each counted status, excluded unset/Rewatched states, first-score auto-Watching, repeated idempotent writes, status replacement, rewatch transition, and rewatch rollback.
2. Add sparse `userAnimeProgress` with one unique indexed row per user who has list-status activity and the four nonnegative counts. Untouched users intentionally have no row.
3. Add `userAnime.getMyProgress`; it must derive identity through `requireProfile` and return explicit zeros when no aggregate row exists.
4. Apply the pure transition helper atomically in every status-changing mutation path:
   - `setStatus`;
   - `setScore` when first score changes unset status to Watching;
   - `recordRewatch`;
   - `removeLatestRewatch`.
   During the optional-schema deployment window, a missing aggregate inside these mutations must first recompute that user's indexed entry truth before applying the transition; legacy users cannot underflow or receive partial counts while backfill is still running.
5. Add resumable, idempotent internal backfill and verification mutations. Page profiles, recompute each user's counts from indexed `userAnimeEntries` reads, then replace the aggregate rather than incrementing an unknown partial state. Do not create zero-only rows for untouched profiles.
6. Run:

```powershell
pnpm exec vitest run convex/userAnimePolicy.test.ts convex/userAnime.integration.test.ts
```

7. Commit:

```powershell
git add convex/schema.ts convex/userAnime.ts convex/userAnimePolicy.ts convex/userAnime.integration.test.ts
git commit -m "feat: add list progress projection"
```

## Task 5: Reuse Discover Data On Home

**Owner:** Home data-flow worker

**Files:**

- Modify: `src/routes/_public/home.tsx`
- Modify: `src/features/home/home-page.tsx`
- Modify: `src/features/home/home-page.test.tsx`
- Create: `src/features/discover/ui/use-discover-sections.ts`
- Modify: `src/features/discover/ui/discover-page.tsx`
- Delete: `src/features/home/home-data.ts`
- Delete: `src/features/home/seasonal-rail.tsx`
- Create: `src/features/home/home-weekly-list.tsx`
- Modify only to remove the deleted rail import/render: `src/features/feed/feed-page.tsx`

**Steps:**

1. Write failing Home tests proving Seasonal comes from the Home loader's Discover payload and preserves loading, retry, empty, image-error, and rail controls.
2. Extract the existing section override/retry behavior into `useDiscoverSections`. Return resolved section states plus per-key retry props so Home and Discover share identical cache, loading, rate-limit, retry, and retry-error behavior.
3. Add a Home route loader using `getDiscoverPage()` and pass its hydrated data to `HomePage`.
   Add a real route `pendingComponent` using explicit loading section states so slow Discover hydration preserves Home geometry inside the shared public shell.
4. Render Seasonal through `DiscoverSectionRail`. Remove the static Home dataset and component.
5. Do not add a second AniList query, endpoint, server function, or Convex action.
6. Run:

```powershell
pnpm exec vitest run src/features/home/home-page.test.tsx src/features/discover/ui/discover-page.test.tsx src/features/discover/ui/discover-section.test.tsx
```

7. Add a This Week state adapter around `DiscoverWeeklyList`: loading/error/retry/empty states match Upcoming, ready state truncates Trending to five. Do not duplicate weekly row markup.
8. Commit:

```powershell
git add src/routes/_public/home.tsx src/features/home src/features/discover/ui/use-discover-sections.ts src/features/discover/ui/discover-page.tsx
git commit -m "refactor: reuse discover seasonal on home"
```

## Task 6: Restore The Home Desktop Utility Column

**Owner:** Home UI worker

**Files:**

- Create: `src/features/home/home-sidebar.tsx`
- Create: `src/features/home/home-list-progress.tsx`
- Create: `src/features/home/home-latest-reviews.tsx`
- Create: `src/features/home/home-sidebar.test.tsx`
- Modify: `src/features/home/home-page.tsx`
- Modify: `src/features/home/home-page.test.tsx`
- Modify: `src/features/feed/feed-page.tsx`
- Modify: `src/features/reviews/ui/review-summary.tsx`
- Modify: `src/features/reviews/ui/review-summary.test.tsx`
- Modify only for explicit `variant="detail"` call sites: `src/features/reviews/ui/review-detail-page.tsx`, `src/features/reviews/ui/review-preview.tsx`, and their focused tests

**Steps:**

1. Write failing tests for exact public order: Latest Reviews, This Week, Upcoming.
2. Write failing tests for exact signed-in order: List Progress, Latest Reviews, This Week, Upcoming.
3. Prove public rendering does not issue `getMyProgress` and the sidebar is hidden below `lg`.
4. Build scoped loading, empty, error, and retry states for Latest Reviews and List Progress. Preserve loaded content on a retryable refresh error.
5. Add explicit `detail | list` Review Summary variants. Both variants keep Summary visible; `list` adds compact typography and two-line clamping. Rich-text spoiler blocks retain independent reveal behavior.
6. Latest Reviews rows show cover, author, relative timestamp, compact `list` Summary, optional `containsSpoiler` badge, no Rating, Review Detail link, and `See more` to `/reviews`. Reject non-published or missing-`publishedAt` data into the scoped error state; never substitute `updatedAt`.
7. Reuse `DiscoverWeeklyList` and `DiscoverUpcomingList`; do not copy their markup.
8. Remove `Community feed` and signed-in `What are you watching?`. Keep the Create Post button and existing feed tabs.
9. At desktop, use the approved main/feed plus compact right-column geometry. At 390/768, render no utility column and no unreachable modules after the infinite feed.
10. Run:

```powershell
pnpm exec vitest run src/features/home/home-sidebar.test.tsx src/features/home/home-page.test.tsx src/features/reviews/ui/review-summary.test.tsx
```

11. Commit:

```powershell
git add src/features/home src/features/feed/feed-page.tsx src/features/reviews/ui/review-summary.tsx src/features/reviews/ui/review-summary.test.tsx
git commit -m "feat: restore home utility column"
```

## Task 7: Align Feed Cards With The Approved Home Reference

**Owner:** feed-card UI worker

**Files:**

- Modify: `src/features/feed/feed-card.tsx`
- Modify: `src/features/feed/feed-card.test.tsx`
- Modify: `src/features/feed/feed-list.tsx`
- Create: `src/features/feed/feed-list.test.tsx`
- Create: `src/features/feed/feed-cover-image.tsx`
- Modify when separation is needed: `src/features/feed/post-image-grid.tsx`
- Modify: `src/features/feed/feed-owner-actions.tsx`
- Modify: `src/features/feed/use-feed-pages.test.tsx`

**Steps:**

1. Write failing behavior/structure tests for coral Post accent, cyan Review/Completed/Rewatched accent, compact activity header, owner menu, timestamp, Review anime cover/title/Rating/Summary, and responsive image framing.
2. Restyle with Tailwind to match `home-desktop-feed.png` while retaining current DTO truth. Put coral/cyan accent on actual card articles and use compact contextual activity phrasing plus relative time.
3. Replace Eye-triggered owner Dialog entry with Base UI Dropdown Menu overflow trigger. Keep confirmations in accessible Dialogs, and keep edit/visibility/delete mutations unchanged.
4. Add explicit cover-image unavailable state using the existing Discover image-failure pattern. Preserve card geometry after failure.
5. Convert Home feed pagination to IntersectionObserver-driven infinite loading. Keep scoped retry/terminal rows and an accessible manual Load more fallback when IntersectionObserver is unavailable.
6. Preserve Post whole-Post spoiler reveal, Review-level `containsSpoiler` warning metadata, independent rich-text spoiler blocks, direct activity links, Review Detail links, owner edit/visibility/delete, and disabled Phase 7 Like/Comment labels.
7. Assert absent fake reaction counts, bookmarks, milestone Score/descriptions, and Post anime attachment.
8. Test hover, focus-visible, pending, disabled, spoiler-covered, spoiler-revealed, image-error, owner-menu-open, observer load, duplicate-intersection guard, retry, and terminal states.
9. Run:

```powershell
pnpm exec vitest run src/features/feed/feed-card.test.tsx src/features/feed/feed-card-detail-page.test.tsx src/features/feed/feed-owner-actions.test.tsx src/features/feed/feed-list.test.tsx src/features/feed/use-feed-pages.test.tsx
```

10. Commit:

```powershell
git add src/features/feed
git commit -m "style: align home feed cards"
```

## Task 8: Build The Public `/reviews` Route

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

1. Write route-state tests for absent versus invalid value normalization, public visibility locking, signed-in visibility options, auth-ready URL replacement, and URL replace navigation. Bare signed-in `/reviews` defaults to `all`; bare signed-out and invalid visibility normalize to `public`.
2. Add the path using the existing directory route convention. Keep `index.tsx` thin: shape-normalize search params and render the feature page. After public auth resolves, resolve the absent visibility default or replace an invalid/non-public public-viewer value before issuing discovery query; backend visibility isolation remains authoritative. Auth failure renders an explicit scoped error, never an empty result.
3. Implement 300 ms trailing search debounce. Query text under two characters does not reach Convex. Clearing restores selected sort.
4. Active search disables the sort Select and labels it `Relevance`; rating and visibility remain active.
5. Build a scope/epoch-isolated cursor hook following `useFeedPages`: ignore stale auth/filter responses, dedupe IDs, retain loaded cards during pagination failure, retry the failed cursor, and prevent duplicate in-flight requests.
6. Use `IntersectionObserver` for 12-item infinite pages and the existing Discover test shim pattern. Provide skeleton, empty, retry, and terminal rows that preserve list geometry.
7. Card fields: anime cover/title, Rating, compact `list` Summary, author, timestamp, optional `containsSpoiler` badge, visibility where owner-only content needs disclosure, and Review Detail action. Never render the full body.
8. Match the approved desktop/mobile references. Use a two-column mobile/tablet filter grid with Search and Visibility spanning both columns until `lg`; Sort and Rating stay paired. Use `min-w-0`, overflow containment, and mobile bottom-navigation clearance (`pb-28`). Use AnimeX shell navigation rather than older reference-only navigation.
9. Assert no horizontal overflow at 390 px and no discovery query before auth-ready visibility normalization.
10. Run:

```powershell
pnpm exec vitest run src/routes/_public/reviews/-review-search.test.ts src/features/reviews/discovery/review-discovery-page.test.tsx src/features/reviews/discovery/use-review-discovery-pages.test.tsx
```

11. Commit:

```powershell
git add src/routes/_public/reviews src/features/reviews/discovery
git commit -m "feat: add review discovery page"
```

## Task 9: Execute And Verify Convex Backfills

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

2. Run Review discovery backfill repeatedly using its returned cursor until `isDone: true`. Then run its verification mutation and require zero missing/mismatched Reviews across both draft and published states.
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

## Task 10: Integrate Routes, Generated Types, And Full Automated Gates

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

## Task 11: Live Browser QA With A Real Signed-In Account

**Owner:** fresh QA agent plus controller cleanup

**Authorization:** The user explicitly approved creation of a dedicated dev test account and real test Post, Anime Detail state, and Review fixtures. This does not authorize production deployment or external sharing.

**Account safety:**

- Sign up through the real UI using a unique Resend sandbox address such as `delivered+animex-p5-home-<runid>@resend.dev` and a unique allowed username.
- Generate an ephemeral password. Never commit, print, screenshot, or report the password, OTP, session token, email body, API key, or request payload.
- Read only the verification value needed from the existing Resend preview/CLI flow; keep it out of repository evidence and chat.
- Complete email verification and profile creation. Retain the dev-only account if account deletion is unavailable; do not leave credentials in source, docs, shell history, or screenshots.

**Fixtures and lifecycle:**

1. Create a real text Post and an external-image or external-video Post through Composer. Verify publish, external media validation/rendering, spoiler reveal, edit, visibility change, direct activity, and owner delete.
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

1. Task 1 adds shared UI foundations before frontend work.
2. Task 2 locks contracts.
3. Tasks 3 and 4 may run in parallel after Task 2; schema ownership is coordinated by controller.
4. Task 5 completes before Task 6 because both own Home composition and Discover section state.
5. Tasks 7 and 8 may run in parallel after Task 6 and required backend contracts exist; their write sets are disjoint.
6. Controller performs Tasks 9 and 10 once.
7. Fresh reviewer and QA perform Task 11 after all automated gates pass.

## Final Acceptance

- Home matches the approved public/signed-in desktop compositions and contains no removed placeholders.
- Seasonal, This Week, and Upcoming reuse the existing Discover cache/data flow.
- Feed cards match approved visual structure without fake Phase 7 data.
- `/reviews` access, search, sort, bands, visibility, cursors, retry, and infinite scroll are correct.
- List Progress stays atomic across every status-changing path and verified backfill.
- No private Review or progress data leaks to public viewers.
- Planned UI uses shared Base UI shadcn components; no duplicate primitives or Radix-backed replacement surfaces.
- No Convex action, client AniList endpoint, external search, new production dependency, production deploy, or automatic merge.
- Real signed-in browser QA covers Post, Anime Detail, Review, Home, and Review discovery flows with secrets excluded from evidence.
