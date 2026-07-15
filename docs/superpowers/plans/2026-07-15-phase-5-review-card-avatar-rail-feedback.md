# Phase 5 Review Card, Avatar, And Rail Feedback Implementation Plan

Status: COMPLETE on `jeff-cx/phase-5-feed-reviews`. Unchecked steps preserve historical execution sequence; they are not open product work. Current closure is tracked in `TODO.md`, `design-qa.md`, and `docs/architecture/review-discovery-data-flow.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use fresh orchestration workers from the repository TOML files, with no model or reasoning overrides. Integrate shared contracts, schema, and generated files once.

**Goal:** Unify published Review cards, make Review activity bodies directly navigable, replace activity icons with a reusable author Avatar, simplify Review spoiler/rating behavior, and equalize anime-card heights within each horizontal rail.

**Architecture:** Rename the persisted Review warning flag only after a verified, bounded cleanup removes all existing Reviews and Review-derived projections. Keep the feed projection authoritative. Promote one published Review card into shared Review UI, centralize Avatar and spoiler-badge primitives, and fix equal-height behavior at the shared rail/poster boundary.

**Tech Stack:** TanStack Start, React, Convex indexed queries and mutations, Zod, Base UI-backed shadcn components, Tailwind, Sonner, Vitest, Testing Library. No new production dependency, route, AniList request, Convex action, production deployment, or automatic merge. Tasks 2–4 intentionally sync the current development Convex deployment.

## Global Constraints

- Continue on `jeff-cx/phase-5-feed-reviews`; preserve unrelated user changes.
- Follow `docs/superpowers/specs/2026-07-15-phase-5-review-card-avatar-rail-feedback-design.md` and the approved visual placement reference.
- Delete only Reviews, drafts, Review feed activities, and Review-derived aggregate rows during migration. Preserve Posts, Post media, Completed/Rewatched activities, accounts, profiles, anime state/cache, and unrelated feed cards.
- Keep Review visibility, sorting, pagination, one-Review-per-user/anime, feed timestamps, activity-only deletion semantics, and rich-text spoiler blocks unchanged.
- `containsSpoiler` is warning metadata. It never hides Summary or ordinary body content.
- Use Convex functions and indexed queries/mutations for app behavior. The bounded operator-only cleanup may paginate the Review table because no existing index spans every draft and visibility; it must not become a public read path.
- Do not add dependencies or modify `package.json`/`pnpm-lock.yaml`.
- Do not add or change routes. Do not regenerate `src/routeTree.gen.ts` unless an unrelated route change is discovered and explicitly approved.
- Keep route files thin. Domain UI stays under `src/features`; app-wide Avatar stays under `src/components`.
- Write RED user-visible/integration tests before behavior changes. Run focused tests after each task, then one full validation and browser-QA cycle.
- Workers must not edit `TODO.md`, docs, generated files, dependencies, schema, or shared contracts unless the task assigns them.

---

## Locked Interfaces

```ts
type ReviewWarning = {
  containsSpoiler: boolean
}

type UserAvatarSize = 'sm' | 'md' | 'lg'

type UserAvatarProps = {
  avatarUrl: string | null
  displayName: string
  label: string
  size: UserAvatarSize
}

type ReviewRatingDraft = string
```

- Replace every Review wire, Convex, form, preview, feed, detail, and discovery occurrence of `summaryHasSpoiler` with `containsSpoiler`.
- `ReviewRatingDraft` preserves focused text such as `''`, `9`, `9.`, and `9.5`; persistence converts only a complete valid value to `number | null`.
- Rating defaults to `50`, accepts `0–100`, and permits at most one decimal. Draft may persist `null`; Publish requires a valid number.
- Shared Avatar fallback is the first uppercase display-name character. Empty/whitespace display names use `?` as an explicit unavailable state.
- `/reviews` and Anime Detail Reviews consume the same `PublishedReviewCard` component and `ReviewListItem` contract.
- Review activity owner-menu label is `Delete`, but it continues to call `reviews.removeActivity` and retain activity-only confirmation/toast copy.

## Ownership And Lock Order

1. One Convex migration worker owns Task 1 only. The controller then owns Tasks 2–4 and keeps `convex/schema.ts`, `convex/reviews.ts`, `convex/feed.ts`, cleanup functions, and `convex/_generated` locked until writes reopen.
2. One contracts worker may prepare Task 3 source edits, but the controller alone deploys the narrowed schema and generated files.
3. Task 5 locks shared Avatar, Review Summary, spoiler badge, and writer behavior only after Task 4 reopens verified Review writes.
4. Feed/Latest worker owns Task 6; published-card/detail worker owns Task 7; rail worker owns Task 8. Tasks 6–8 may run in parallel only after Task 5 releases shared primitives.
5. Controller owns migration execution, integration, generated files, trackers, docs, review, and browser QA.
6. Every worker receives exact owned files and must not revert or format unrelated changes.

---

## Task 1: Build A Bounded Review Cleanup Tool

**Owner:** Convex migration worker

**Files:**

- Create: `convex/reviewCleanup.ts`
- Create: `convex/reviewCleanup.integration.test.ts`
- Modify: `convex/reviews.ts`
- Modify: `convex/social.integration.test.ts`

**Steps:**

- [ ] Write RED integration coverage that seeds published Reviews, drafts, linked and orphan Review feed cards, Review statistics, Posts, Post cards, Completed/Rewatched cards, profiles, and anime state.
- [ ] Add a bounded, cursor-driven internal inspection query for `reviews`, `feedCards(kind='review')`, and `animeReviewStats`; the controller derives counts page by page. Never return Review bodies or private user data.
- [ ] Add bounded, cursor-driven internal mutations:
  - `cleanupReviewsPage`: delete each Review and its `review:${reviewId}` feed card atomically.
  - `cleanupOrphanReviewCardsPage`: delete remaining `kind='review'` feed cards through `by_kind_source`.
  - `cleanupReviewStatsPage`: delete all `animeReviewStats` rows because every source Review is removed.
- [ ] Return cursor, `isDone`, processed count, and deleted count from each page. Empty and repeated runs must succeed with zero deletions.
- [ ] Assert Posts, non-Review feed cards, users, profiles, anime caches, user-anime entries, milestones, and rewatch rows are byte-for-byte preserved by the cleanup.
- [ ] Add a temporary explicit Review-write gate in `convex/reviews.ts`. While enabled, every public Review mutation fails with `Review maintenance is in progress. Try again shortly.` Internal cleanup mutations remain available.
- [ ] Test Save Draft, Publish, Update, visibility change, activity removal, and Review removal under the gate. Reads remain available.
- [ ] Run:

```powershell
pnpm exec vitest run convex/reviewCleanup.integration.test.ts
pnpm exec tsc --noEmit
git diff --check
```

Expected: bounded deletion, cascade scope, resume, and idempotency tests pass; no app schema or public contract changes yet.

- [ ] Commit the temporary operator tool separately:

```powershell
git add convex/reviewCleanup.ts convex/reviewCleanup.integration.test.ts convex/reviews.ts convex/social.integration.test.ts
git commit -m "chore: add review cleanup migration"
```

## Task 2: Freeze, Back Up, Execute, And Verify Review Cleanup

**Owner:** controller only

**Files:** no app-source edit during execution

**Steps:**

- [ ] Resolve `CONVEX_DEPLOYMENT` from `.env.local`. Require a `dev:` target and compare its deployment name with the approved AnimeX development deployment. Reject `prod`, an empty value, or any mismatch before a write command.
- [ ] Push the temporary write gate and cleanup functions using the same explicit environment file:

```powershell
pnpm exec convex dev --once --env-file .env.local
```

- [ ] Use the QA account to confirm a Review save is rejected with the maintenance error while public Review reads still work.
- [ ] Export the exact guarded development deployment, including file storage, to a timestamped ZIP under `$env:TEMP`. Compute and record its SHA-256 and deployment name, but never commit or print exported contents:

```powershell
pnpm exec convex export --deployment $deployment --include-file-storage --path $snapshot
Get-FileHash -LiteralPath $snapshot -Algorithm SHA256
```

- [ ] Run the bounded inspection query and record only aggregate counts in the implementation checkpoint.
- [ ] Run `cleanupReviewsPage` until `isDone=true`; persist and resume from each returned cursor.
- [ ] Run `cleanupOrphanReviewCardsPage` until `isDone=true`.
- [ ] Run `cleanupReviewStatsPage` until `isDone=true`.
- [ ] Re-run inspection. Require exactly zero Reviews, Review feed cards, and Review-stat rows.
- [ ] Repeat all three cleanup paths once to prove live idempotency.
- [ ] Query preserved Post and non-Review feed-card counts before/after through bounded indexed pages. Any unrelated delta is a hard stop; do not proceed to schema rename. Integration tests remain the proof that profiles, anime state/cache, and milestones cannot be targeted.
- [ ] Do not print Review bodies, account secrets, or QA credentials in terminal evidence.
- [ ] If any invariant fails, keep Review writes frozen and stop. Do not auto-import. The rollback is the verified ZIP with `convex import --replace --deployment $deployment`; run it only after confirming no unrelated post-snapshot writes and obtaining explicit user approval.

Expected: all Review sources and derived data are zero; unrelated source counts match the pre-cleanup snapshot.

## Task 3: Rename The Review Spoiler Contract After Cleanup

**Owner:** Review backend/contracts worker prepares source; controller owns sync and generated files

**Files:**

- Modify: `convex/schema.ts`
- Modify: `convex/reviews.ts`
- Modify: `convex/feed.ts`
- Modify: `convex/social.integration.test.ts`
- Modify: `src/features/social/shared/social-contracts.ts`
- Modify: `src/features/social/shared/social-contracts.test.ts`
- Modify: `src/features/reviews/shared/review-discovery-contracts.test.ts`
- Modify: `src/features/reviews/review-document-adapter.test.ts`
- Modify: every current `src/` file returned by `rg -l "summaryHasSpoiler" src`
- Keep unchanged and deployed: `convex/reviewCleanup.ts`
- Keep unchanged and deployed: `convex/reviewCleanup.integration.test.ts`

**Steps:**

- [ ] Write RED contract tests accepting `containsSpoiler` and rejecting the removed `summaryHasSpoiler` field.
- [ ] Rename the Review table field, validators, mutation arguments, intent comparisons, feed projection, list/detail wire shapes, and TypeScript types.
- [ ] Mechanically rename the field in every existing UI consumer and test fixture before behavior work. Do not change geometry, reveal behavior, links, or copy in this task.
- [ ] Preserve Summary, body JSON, visibility, rating, publication time, aggregate behavior, and Review activity behavior.
- [ ] Update Convex integration fixtures and assertions to the new field.
- [ ] Keep the Review-write gate enabled and keep cleanup functions deployed during the schema transition.
- [ ] Controller syncs the narrowed schema/functions and regenerates Convex types once:

```powershell
pnpm exec convex dev --once --env-file .env.local
pnpm exec vitest run src/features/social/shared/social-contracts.test.ts src/features/reviews/shared/review-discovery-contracts.test.ts src/features/reviews/review-document-adapter.test.ts convex/social.integration.test.ts
pnpm exec tsc --noEmit
git diff --check
```

Expected: narrowed schema is live, Review writes remain frozen, cleanup functions remain available, and bounded inspection still reports zero Review sources/projections/aggregates.

- [ ] Commit:

Stage only the exact Task 3 files plus generated Convex files; never stage the whole `src/features` or `convex` directory.

```powershell
git commit -m "refactor: use review spoiler warning"
```

## Task 4: Remove The Cleanup Tool And Reopen Review Writes

**Owner:** controller only

**Files:**

- Modify: `convex/reviews.ts`
- Modify: `convex/social.integration.test.ts`
- Delete: `convex/reviewCleanup.ts`
- Delete: `convex/reviewCleanup.integration.test.ts`
- Modify generated Convex files only through the final sync

**Steps:**

- [ ] Re-run bounded inspection under the narrowed schema. Require zero Reviews, Review feed cards, and Review aggregate rows.
- [ ] Remove the temporary write gate and its maintenance-only tests.
- [ ] Delete cleanup functions/tests and sync again:

```powershell
pnpm exec convex dev --once --env-file .env.local
pnpm exec vitest run convex/social.integration.test.ts
pnpm exec tsc --noEmit
git diff --check
```

- [ ] Confirm cleanup functions are absent from generated/public/internal function references and cannot be invoked.
- [ ] With the stored QA account, save a Draft, resume it, publish it, edit it, and verify `containsSpoiler` round-trips. This is the post-deployment write smoke; leave the final QA Review available for later UI checks.
- [ ] If any post-deployment smoke fails, immediately restore the maintenance gate in `convex/reviews.ts`, run `pnpm exec convex dev --once --env-file .env.local`, and verify the QA save is rejected. Keep the cleanup tool absent. Only after the re-freeze is confirmed may the controller assess the verified snapshot rollback with the user.

Expected: cleanup surface is gone, Review writes work only with the final contract, and deployment/schema/data are stable.

- [ ] Commit:

```powershell
git add convex/reviews.ts convex/social.integration.test.ts convex/reviewCleanup.ts convex/reviewCleanup.integration.test.ts convex/_generated
git commit -m "chore: finish review cleanup migration"
```

## Task 5: Lock Shared Avatar, Spoiler Badge, Summary, And Writer Fields

**Owner:** shared Review UI worker

**Files:**

- Create: `src/components/user-avatar.tsx`
- Create: `src/components/user-avatar.test.tsx`
- Create: `src/features/reviews/ui/review-spoiler-badge.tsx`
- Create: `src/features/reviews/ui/review-spoiler-badge.test.tsx`
- Modify: `src/features/reviews/ui/review-summary.tsx`
- Modify: `src/features/reviews/ui/review-summary.test.tsx`
- Modify: `src/features/reviews/ui/review-editor-page.tsx`
- Modify: `src/features/reviews/ui/review-editor-page.test.tsx`
- Modify: `src/features/reviews/ui/review-preview.tsx`
- Modify: `src/features/reviews/ui/review-preview.test.tsx`
- Modify: `src/features/reviews/review-validation.ts`
- Modify: `src/features/reviews/review-validation.test.ts`

**Steps:**

- [ ] Re-run `rg` for an existing shared Avatar. Create `UserAvatar` only if no suitable shared component exists.
- [ ] Write RED Avatar tests for image, missing URL, image failure, URL reset, uppercase fallback, empty-name unavailable state, accessible label, and all supported sizes.
- [ ] Implement one round, cover-cropped Avatar with stable geometry. Error fallback must reset when `avatarUrl` changes.
- [ ] Write RED badge tests for destructive visual semantics and non-interactive accessible text.
- [ ] Simplify `ReviewSummary` to always render Summary text. Remove reveal state, reveal buttons, and `hasSpoiler` input.
- [ ] Write RED writer tests proving:
  - the Rating field is `type='text'` with decimal input mode and no spin buttons;
  - default is `50`;
  - partial focused strings remain unchanged;
  - only `0–100` with at most one decimal persists;
  - empty Draft persists `null`, while empty/invalid Publish is rejected;
  - the checkbox says `Review contains spoiler` and occupies a full-width right-aligned row below Rating/Summary/Visibility.
- [ ] Store Rating edit text separately from parsed persistence value. Do not coerce on each keystroke or silently clamp invalid input.
- [ ] Update Save Draft, Publish, Update, dirty-state comparison, existing-review hydration, and Preview to use `containsSpoiler`.
- [ ] Preview always shows Summary and renders the Spoiler badge when flagged; structured spoiler blocks remain covered independently.
- [ ] Run:

```powershell
pnpm exec vitest run src/components/user-avatar.test.tsx src/features/reviews/ui/review-spoiler-badge.test.tsx src/features/reviews/ui/review-summary.test.tsx src/features/reviews/ui/review-editor-page.test.tsx src/features/reviews/ui/review-preview.test.tsx src/features/reviews/review-validation.test.ts
pnpm exec tsc --noEmit
git diff --check
```

- [ ] Commit:

```powershell
git add src/components/user-avatar.tsx src/components/user-avatar.test.tsx src/features/reviews/ui/review-spoiler-badge.tsx src/features/reviews/ui/review-spoiler-badge.test.tsx src/features/reviews/ui/review-summary.tsx src/features/reviews/ui/review-summary.test.tsx src/features/reviews/ui/review-editor-page.tsx src/features/reviews/ui/review-editor-page.test.tsx src/features/reviews/ui/review-preview.tsx src/features/reviews/ui/review-preview.test.tsx src/features/reviews/review-validation.ts src/features/reviews/review-validation.test.ts
git commit -m "feat: refine review warning and author avatar"
```

## Task 6: Update Feed Review And Latest Review Cards

**Owner:** feed/Home UI worker

**Files:**

- Modify: `src/features/feed/feed-card.tsx`
- Modify: `src/features/feed/feed-card.test.tsx`
- Modify: `src/features/feed/feed-owner-actions.tsx`
- Modify: `src/features/feed/feed-owner-actions.test.tsx`
- Modify: `src/features/home/home-latest-reviews.tsx`
- Modify: `src/features/home/home-sidebar.test.tsx`

**Steps:**

- [ ] Write RED feed tests proving every activity kind renders author `UserAvatar` and no activity-kind Lucide icon remains.
- [ ] Preserve activity-type left-border accent and existing header/footer/owner-menu geometry.
- [ ] Make the Review body one non-nested link to `/reviews/$reviewId`. Its accessible name must include anime title and author.
- [ ] Keep owner menu, timestamp, and footer controls outside the body link hit area.
- [ ] Render anime title, destructive Spoiler badge below title, Rating, and always-visible Summary. Remove anime-cover link and visible `Read Review` text.
- [ ] Change only the Review activity owner menu label from `Remove` to `Delete`; preserve `reviews.removeActivity`, activity-only confirmation, and activity-only Sonner messages.
- [ ] Write RED Latest Reviews tests for anime title, author, timestamp, visible compact Summary, optional top-right Spoiler badge, whole-row Review link, and absence of `Read review`.
- [ ] Preserve five-item Public limit, `See more`, retained data during refresh errors, loading, empty, and image-error states.
- [ ] Run:

```powershell
pnpm exec vitest run src/features/feed/feed-card.test.tsx src/features/feed/feed-owner-actions.test.tsx src/features/home/home-sidebar.test.tsx
pnpm exec tsc --noEmit
git diff --check
```

- [ ] Commit:

```powershell
git add src/features/feed/feed-card.tsx src/features/feed/feed-card.test.tsx src/features/feed/feed-owner-actions.tsx src/features/feed/feed-owner-actions.test.tsx src/features/home/home-latest-reviews.tsx src/features/home/home-sidebar.test.tsx
git commit -m "feat: link review activity cards"
```

## Task 7: Share One Published Review Card Across Review Listings

**Owner:** Review listing/detail UI worker

**Files:**

- Create: `src/features/reviews/ui/published-review-card.tsx`
- Create: `src/features/reviews/ui/published-review-card.test.tsx`
- Modify: `src/features/reviews/discovery/review-discovery-page.tsx`
- Modify: `src/features/reviews/discovery/review-discovery-page.test.tsx`
- Modify: `src/features/reviews/ui/anime-reviews-panel.tsx`
- Modify: `src/features/reviews/ui/anime-reviews-panel.behavior.test.tsx`
- Modify: `src/features/reviews/ui/review-detail-page.tsx`
- Modify: `src/features/reviews/ui/review-detail-page.behavior.test.tsx`
- Delete: `src/features/reviews/discovery/review-discovery-card.tsx`
- Delete: `src/features/reviews/ui/review-card.tsx`

**Steps:**

- [ ] Promote the current `/reviews` discovery-card structure into `PublishedReviewCard` using `ReviewListItem`.
- [ ] Require published state, non-null Rating, and publish timestamp at the component boundary. Invalid data must raise an explicit development error instead of rendering a fake fallback.
- [ ] Preserve anime cover/title, author, timestamp, Rating, visible Summary, visibility badge, and Review Detail action. Add the top-right Spoiler badge.
- [ ] Render this exact component from both `/reviews` and Anime Detail Reviews. Keep each page's existing query, sorting, stats, infinite pagination, retry, and empty behavior.
- [ ] Delete the two old divergent card implementations after all consumers switch.
- [ ] Replace Review Detail inline avatar markup with `UserAvatar`; show the Review-level Spoiler badge near metadata and keep Summary/body visible.
- [ ] Update More Reviews summaries to remain visible and show a badge rather than substitute hidden text.
- [ ] Do not load Review body JSON into listing cards and do not add author avatars to `/reviews` cards that use the approved anime-cover design.
- [ ] Run:

```powershell
pnpm exec vitest run src/features/reviews/ui/published-review-card.test.tsx src/features/reviews/discovery/review-discovery-page.test.tsx src/features/reviews/ui/anime-reviews-panel.behavior.test.tsx src/features/reviews/ui/review-detail-page.behavior.test.tsx
pnpm exec tsc --noEmit
git diff --check
```

- [ ] Commit:

```powershell
git add src/features/reviews/ui/published-review-card.tsx src/features/reviews/ui/published-review-card.test.tsx src/features/reviews/discovery/review-discovery-page.tsx src/features/reviews/discovery/review-discovery-page.test.tsx src/features/reviews/discovery/review-discovery-card.tsx src/features/reviews/ui/anime-reviews-panel.tsx src/features/reviews/ui/anime-reviews-panel.behavior.test.tsx src/features/reviews/ui/review-detail-page.tsx src/features/reviews/ui/review-detail-page.behavior.test.tsx src/features/reviews/ui/review-card.tsx
git commit -m "refactor: share published review cards"
```

## Task 8: Equalize Anime Card Heights Within Each Rail

**Owner:** Discover rail UI worker

**Files:**

- Modify: `src/features/discover/ui/horizontal-rail.tsx`
- Modify: `src/features/discover/ui/horizontal-rail.test.tsx`
- Modify: `src/features/discover/ui/discover-section.tsx`
- Modify: `src/features/discover/ui/discover-section.test.tsx`

**Steps:**

- [ ] Write RED structural tests proving rail children stretch within the current row and `AnimePoster` link/article fill available height.
- [ ] Stretch direct rail children without a fixed pixel height or global cross-rail measurement.
- [ ] Make poster link and article `h-full`; make the metadata panel a column that grows and keeps year/format aligned at the bottom.
- [ ] Preserve fixed card width, cover ratio, title clamp, rank badge, snap positions, wheel/touch scrolling, arrow enablement, and responsive layout.
- [ ] Verify Trending, Seasonal, Recommendations, and Home Seasonal all inherit behavior through `DiscoverSectionRail`; do not patch individual consumers.
- [ ] Run:

```powershell
pnpm exec vitest run src/features/discover/ui/horizontal-rail.test.tsx src/features/discover/ui/discover-section.test.tsx
pnpm exec tsc --noEmit
git diff --check
```

- [ ] Commit:

```powershell
git add src/features/discover/ui/horizontal-rail.tsx src/features/discover/ui/horizontal-rail.test.tsx src/features/discover/ui/discover-section.tsx src/features/discover/ui/discover-section.test.tsx
git commit -m "fix: align anime rail card heights"
```

## Task 9: Integrate, Review, Document, And Run Full QA

**Owner:** controller, then fresh reviewer, QA, and docs-mapper agents

**Files:**

- Modify: `TODO.md`
- Modify: `docs/superpowers/specs/2026-07-15-phase-5-review-card-avatar-rail-feedback-design.md`
- Modify: `docs/architecture/review-discovery-data-flow.md`
- Modify other current-state docs only when final data flow proves they are stale

**Steps:**

- [ ] Search for stale contracts and UI copy:

```powershell
rg -n "summaryHasSpoiler|Summary contains spoilers|Read Review|Read review|Reveal Summary spoiler" src convex
```

Expected: zero old Review-contract or reveal-copy matches. Unrelated wording must not be mechanically changed.

- [ ] Confirm no duplicate avatar renderer remains on feed, Anime Reviews, or Review Detail.
- [ ] Confirm all Review-card consumers use `PublishedReviewCard` where locked and that no new route/dependency/generated-route diff exists.
- [ ] Use a fresh orchestration reviewer for behavior, data-deletion scope, accessibility, and exact shared-card verification. BLOCK on any unrelated deletion or stale aggregate.
- [ ] Use a fresh docs mapper to update only current-state data-flow truth and trackers.
- [ ] Run full gates once after integration:

```powershell
pnpm exec convex dev --once --env-file .env.local
pnpm test
pnpm exec tsc --noEmit
pnpm build
pnpm exec fallow audit --base HEAD --gate new-only --format json --quiet
Get-ChildItem -Path .output -Recurse -File | Select-String -Pattern 'graphql.anilist.co'
git diff --check
```

Expected: all gates pass; client AniList endpoint scan returns no match; Fallow has no introduced findings.

- [ ] Use the stored DPAPI-protected AnimeX QA account without exposing credentials. Create a fresh Draft and Published Review after the cleanup to validate the final contract.
- [ ] Prefer `browser:control-in-app-browser`; use Chrome/Playwright only if the in-app browser is unavailable or cannot inspect the required state.
- [ ] Browser QA at 390, 768, and 1280 px:
  - writer Rating partial typing, empty Draft, Publish validation, checkbox placement, Preview badge, Save/Publish/Edit, and structured spoiler-block independence;
  - Feed Post/Review/Completed/Rewatched author avatars, broken/missing-avatar fallback, Review whole-body navigation, owner `Delete` activity confirmation, and unaffected Post deletion;
  - `/reviews` and Anime Detail Reviews exact card parity, sorting/pagination retention, badge placement, visible Summary, Review Detail avatar/badge/body;
  - Latest Reviews title/author/time/Summary/badge, whole-row link, `See more`, and no CTA text;
  - equal heights within every visible Trending/Seasonal/Recommendation rail while different rails remain independently sized;
  - pointer hover, pointer exit restoration, keyboard focus-visible, touch/pressed state, loading/error/empty states, console, failed requests, hydration, layout shift, and horizontal page overflow.
- [ ] Update `TODO.md` with verified results and exact remaining blocker, if any.
- [ ] Commit focused integrated changes and stop for user review. Do not merge, deploy, or delete the feature branch.

## Final Acceptance Checklist

- [ ] Existing Review records, drafts, Review feed cards, and Review statistics were cleaned and verified; unrelated data stayed intact.
- [ ] Final schema and all clients use `containsSpoiler`; old field is absent.
- [ ] Summary remains visible on all Review cards regardless of warning flag.
- [ ] Writer Rating is spinner-free, preserves partial input, defaults to 50, and validates one decimal.
- [ ] Every feed activity uses shared author Avatar; fallback behavior is accessible and stable.
- [ ] Review feed body links Review Detail with no nested link or visible CTA.
- [ ] Review activity menu says `Delete` but removes only the activity.
- [ ] `/reviews` and Anime Detail Reviews render the exact same published card.
- [ ] Latest Reviews has approved metadata, visible Summary, badge, and no CTA text.
- [ ] Anime cards equalize only within each rail.
- [ ] Focused/full tests, Convex sync, TypeScript, build, Fallow, endpoint scan, diff check, and responsive authenticated browser QA pass.
- [ ] Work remains on `jeff-cx/phase-5-feed-reviews` for user review.
