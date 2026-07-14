# Phase 5 Editor, Post Media, And Feed Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use fresh orchestration workers only for disjoint owned files; integrate schema and generated files once.

**Goal:** Improve Review media editing and spoiler toggling, replace Post file uploads with one safe external image/video URL, simplify feed activity cards and owner menus, align Home utility cards, and remove only Discover's main-column Genres section.

**Architecture:** Lexical owns Review selection, block insertion, node selection, deletion, and history. Shared social media validation owns safe external URL contracts used by both browser and Convex. Posts store one nullable structured media value. A two-stage, resumable Convex migration deletes only legacy file-image Posts and their owned storage before upload schema and code are removed. Existing feed projection remains authoritative.

**Tech Stack:** TanStack Start, React, Lexical, Convex indexed queries/mutations, Zod, Base UI-backed shadcn components, Tailwind, Sonner, Vitest, Testing Library. No new production dependency, Convex action, AniList request, production deployment, or automatic merge.

## Global Constraints

- Continue on `jeff-cx/phase-5-feed-reviews`; preserve unrelated user changes.
- Follow `docs/superpowers/specs/2026-07-14-phase-5-editor-post-feed-feedback-design.md`.
- Preserve current feed pagination, visibility, auth, idempotency, feed-time, Review validation, and Anime Detail behavior.
- Use Convex indexed queries and mutations only. Do not add actions, scans, arbitrary server media fetches, OpenGraph requests, iframes, video playback, or client AniList access.
- Do not add a dependency or modify `package.json`/`pnpm-lock.yaml`.
- Keep route files unchanged. Domain logic stays under `src/features`; Convex authorization stays server-side through `requireProfile`.
- Keep files focused, named exports, explicit parameter handling, strict types, no silent fallback, and no new default parameter values.
- Write failing user-visible/integration tests before behavior changes. Run focused tests after each task, then one full validation cycle after integration.
- `image-taste-frontend` is not required: this is approved technical interaction feedback using existing AnimeX surfaces, not a new visual redesign.

---

## Locked Interfaces

```ts
type PostMedia =
  | {
      type: 'image'
      url: string
      description: string | null
    }
  | {
      type: 'video'
      url: string
      provider: 'youtube' | 'vimeo' | 'external'
      label: string | null
    }

type ActivityAnime = {
  anilistId: number
  slug: string
  title: string
  coverImage: string | null
  seasonYear: number | null
  format: string | null
}

type LegacyPostMigrationPage = {
  continueCursor: string
  isDone: boolean
  processedCount: number
  deletedPostCount: number
  preservedPostCount: number
  deletedFeedCardCount: number
  deletedImageRowCount: number
  deletedStorageCount: number
}

type LegacyPostMigrationVerification = {
  legacyPostIds: string[]
  postImageIds: string[]
  orphanFeedCardIds: string[]
}
```

- Post media count is zero or one.
- Image description and video label are nullable. Empty image description renders `Image attached to post by {username}`.
- Safe media URLs require HTTPS, no credentials, and at most 2,048 characters.
- User explicitly chooses Image or Video. Type is never inferred from extension.
- Review media insertion restores a saved Lexical RangeSelection. A valid collapsed caret inserts there; selected content is replaced; missing/stale selection inserts at document top.
- Completed/Rewatched metadata renders `${seasonYear ?? 'TBA'} · ${format ?? 'Anime'}`.

## Ownership And Lock Order

1. Controller locks shared contracts in Task 1.
2. Review editor worker may own Task 2 after Task 1 without touching Convex/schema/feed files.
3. Convex migration worker owns Tasks 3 and 4 sequentially; `convex/schema.ts`, `convex/posts.ts`, `convex/feed.ts`, and generated Convex files stay locked to that lane.
4. Post UI worker owns Task 5 only after Task 4 releases the final Post contract.
5. Feed UI worker owns Task 6; Home/Discover worker owns Task 7. These may run in parallel after contract lock release because write sets are disjoint.
6. Controller owns integration, generated files, tracker, docs, migration execution, review, and QA.

Workers must not edit `TODO.md`, dependencies, generated files, shared contracts, schema, or another worker's owned files unless assigned. No worker may revert unrelated changes.

---

## Task 1: Lock Shared External Media And Feed Contracts

**Owner:** controller or contracts worker

**Files:**

- Create: `src/features/social/shared/external-media.ts`
- Create: `src/features/social/shared/external-media.test.ts`
- Modify: `src/features/social/shared/social-contracts.ts`
- Modify: `src/features/social/shared/social-contracts.test.ts`
- Modify: `src/features/social/shared/review-document.ts`
- Modify: `src/features/social/shared/review-document.test.ts`

**Steps:**

- [ ] Write RED tests for HTTPS enforcement, credential rejection, 2,048-character limit, YouTube/Vimeo/external provider parsing, nullable descriptions/labels, one-media maximum, and media-only Posts.
- [ ] Write RED schema tests proving legacy `imageIds` input is not accepted by the final Post contract and `media` accepts only the locked discriminated union.
- [ ] Extract existing Review-safe URL/provider logic into `external-media.ts`; keep Review validation behavior and error text stable.
- [ ] Export strict Zod and TypeScript contracts for `PostMedia`, plus small pure helpers for URL validation, provider detection, and safe linked-card labels.
- [ ] Add feed-only `ActivityAnime` with nullable `seasonYear` and `format`; do not widen Review discovery/detail anime DTOs.
- [ ] Run RED, implement minimal contract, then GREEN:

```powershell
pnpm exec vitest run src/features/social/shared/external-media.test.ts src/features/social/shared/social-contracts.test.ts src/features/social/shared/review-document.test.ts
pnpm exec tsc --noEmit
git diff --check
```

Expected: focused tests and TypeScript pass; no dependency or lockfile diff.

- [ ] Commit:

```powershell
git add src/features/social/shared/external-media.ts src/features/social/shared/external-media.test.ts src/features/social/shared/social-contracts.ts src/features/social/shared/social-contracts.test.ts src/features/social/shared/review-document.ts src/features/social/shared/review-document.test.ts
git commit -m "refactor: share external media contracts"
```

## Task 2: Insert And Remove Review Media At The Editing Selection

**Owner:** Review editor worker

**Files:**

- Modify: `src/features/reviews/ui/review-toolbar.tsx`
- Modify: `src/features/reviews/ui/review-toolbar.test.tsx`
- Modify: `src/features/reviews/ui/review-editor.tsx`
- Create: `src/features/reviews/ui/review-media-editing-plugin.tsx`
- Create: `src/features/reviews/ui/review-media-editing-plugin.test.tsx`
- Modify: `src/features/reviews/lexical/review-image-node.tsx`
- Modify: `src/features/reviews/lexical/review-video-node.tsx`
- Modify: `src/features/reviews/lexical/review-nodes.test.ts`
- Modify: `src/features/reviews/lexical/spoiler-node.tsx`
- Modify: `src/features/reviews/ui/review-document-renderer.test.tsx`
- Modify: `src/features/reviews/ui/review-preview.test.tsx`

**Steps:**

- [ ] Write RED Lexical integration tests for collapsed-caret insertion, selected-text replacement, missing/stale-selection top insertion, image/video parity, valid caret after insertion, and one-step Undo/Redo.
- [ ] Write RED tests for click-select cyan media outline, Backspace/Delete on a selected media node, Backspace at the start of the following block, Delete at the end of the preceding block, caret recovery, and one-step history restoration.
- [ ] Capture a cloned RangeSelection before opening Image/Video dialogs. On submit, restore it only when its keys still exist; use `selection.insertNodes([node])`. When invalid, insert as the first root child. Never append as the fallback.
- [ ] Add one editor plugin that registers Lexical selection and deletion commands. Keep image/video nodes as block DecoratorNodes; do not add arbitrary inline HTML.
- [ ] Write RED spoiler tests for wrap, cursor-inside unwrap, multi-wrapper unwrap, mixed-selection behavior, preserved headings/lists/quotes/inline formatting/media, no nesting, and Undo/Redo.
- [ ] Implement spoiler toggle: unwrap selected/touched spoiler wrappers when any exist; otherwise wrap selected top-level blocks. Preserve child nodes and selection.
- [ ] Confirm Preview and published renderer still use identical validated structured data; no `dangerouslySetInnerHTML`.
- [ ] Run:

```powershell
pnpm exec vitest run src/features/reviews/ui/review-toolbar.test.tsx src/features/reviews/ui/review-media-editing-plugin.test.tsx src/features/reviews/lexical/review-nodes.test.ts src/features/reviews/ui/review-preview.test.tsx src/features/reviews/ui/review-document-renderer.test.tsx
pnpm exec tsc --noEmit
git diff --check
```

Expected: all selection/deletion/spoiler cases pass; existing Review document limits remain green.

- [ ] Commit:

```powershell
git add src/features/reviews/ui/review-toolbar.tsx src/features/reviews/ui/review-toolbar.test.tsx src/features/reviews/ui/review-editor.tsx src/features/reviews/ui/review-media-editing-plugin.tsx src/features/reviews/ui/review-media-editing-plugin.test.tsx src/features/reviews/lexical/review-image-node.tsx src/features/reviews/lexical/review-video-node.tsx src/features/reviews/lexical/review-nodes.test.ts src/features/reviews/lexical/spoiler-node.tsx src/features/reviews/ui/review-document-renderer.test.tsx src/features/reviews/ui/review-preview.test.tsx
git commit -m "feat: edit review media at cursor"
```

## Task 3: Add Transitional Post Schema And Resumable Cleanup

**Owner:** Convex migration worker

**Files:**

- Modify: `convex/schema.ts`
- Create: `convex/postMediaMigration.ts`
- Create: `convex/postMediaMigration.integration.test.ts`
- Modify: `convex/social.integration.test.ts`
- Modify: `convex/socialValidators.test.ts`

**Transitional contract:** `posts` accepts legacy `imageIds` plus nullable `media`; `postImages` remains until cleanup verification passes.

**Steps:**

- [ ] Write RED integration tests proving migration deletes only Posts with nonempty legacy `imageIds`, their Post feed projection, corresponding `postImages`, and referenced Convex Storage objects.
- [ ] Add RED cases proving text-only Posts remain with `media: null`, pending/orphan `postImages` are deleted, repeated/resumed pages are idempotent, unrelated feed cards/storage remain, and missing required source/storage references fail explicitly.
- [ ] Add an indexed inspection query and resumable internal mutation using Convex pagination options. Return exact processed/deleted/preserved/storage counts.
- [ ] Add verification query/mutation returning all remaining legacy image Post IDs, `postImages` IDs, and orphan Post feed-card IDs. Require empty arrays before Task 4.
- [ ] Push only transitional schema/functions:

```powershell
pnpm exec convex dev --once
```

Expected: schema sync succeeds while old client/server code still works.

- [ ] Run focused tests:

```powershell
pnpm exec vitest run convex/postMediaMigration.integration.test.ts convex/social.integration.test.ts convex/socialValidators.test.ts
pnpm exec tsc --noEmit
git diff --check
```

- [ ] Run migration inspection first and record counts in private execution notes. Then run 50-row migration pages until `isDone: true`; never continue after any explicit failure:

```powershell
pnpm exec convex run postMediaMigration:inspectLegacyPostMedia --push
pnpm exec convex run postMediaMigration:migrateLegacyPostMedia --push '{"paginationOpts":{"numItems":50,"cursor":null}}'
```

Use each returned `continueCursor` in the next call. Do not publish credentials, Post contents, or storage URLs.

- [ ] Run verification pages until complete. Require zero legacy Post IDs, zero `postImages` IDs, and zero orphan Post feed-card IDs before proceeding.
- [ ] Commit transitional migration code only after dev verification:

```powershell
git add convex/schema.ts convex/postMediaMigration.ts convex/postMediaMigration.integration.test.ts convex/social.integration.test.ts convex/socialValidators.test.ts
git commit -m "chore: migrate legacy post images"
```

## Task 4: Replace Post Backend Storage Contract With External Media

**Owner:** Convex migration worker; continues schema lock

**Files:**

- Modify: `convex/schema.ts`
- Modify: `convex/posts.ts`
- Modify: `convex/socialPolicy.ts`
- Modify: `convex/socialPolicy.test.ts`
- Modify: `convex/feed.ts`
- Modify: `convex/social.integration.test.ts`
- Delete after verified migration: `convex/postMediaMigration.ts`
- Delete after verified migration: `convex/postMediaMigration.integration.test.ts`
- Generated later by controller: `convex/_generated/*`

**Steps:**

- [ ] Write RED backend integration tests for create/update/remove using `media: PostMedia | null`, image/video validation, media-only Post, replace/remove media, idempotent request IDs, ownership, visibility, and feed source truth.
- [ ] Add RED tests proving upload URL generation, image registration/discard, `imageIds`, and `postImages` are absent from the final public contract.
- [ ] Update create/update to validate media server-side with the shared locked rules. Keep Post text max 280, spoiler, visibility, timestamps, idempotency, and atomic feed projection unchanged.
- [ ] Update feed hydration to return stored external media directly. Never request the URL from Convex/TanStack servers.
- [ ] Remove upload mutations, storage cleanup paths, legacy `imageIds`, and `postImages` table only after Task 3 verification is empty.
- [ ] Remove migration functions only after final schema no longer needs legacy tables/fields. Preserve verification result in current-state docs, not executable production endpoints.
- [ ] Push final schema and regenerate Convex types:

```powershell
pnpm exec convex dev --once
```

Expected: final schema sync succeeds with no `postImages` table or Post `imageIds` field.

- [ ] Run:

```powershell
pnpm exec vitest run convex/social.integration.test.ts convex/socialPolicy.test.ts convex/socialValidators.test.ts
pnpm exec tsc --noEmit
git diff --check
```

- [ ] Commit:

```powershell
git add convex/schema.ts convex/posts.ts convex/socialPolicy.ts convex/socialPolicy.test.ts convex/feed.ts convex/social.integration.test.ts convex/postMediaMigration.ts convex/postMediaMigration.integration.test.ts convex/_generated
git commit -m "feat: store external post media"
```

## Task 5: Replace Post File Picker With One URL Media Attachment

**Owner:** Post UI worker

**Files:**

- Modify: `src/features/feed/post-composer.tsx`
- Modify: `src/features/feed/post-composer.test.tsx`
- Modify: `src/features/feed/use-post-composer.ts`
- Modify: `src/features/feed/use-post-composer.test.tsx`
- Modify: `src/features/feed/feed-card.tsx`
- Modify: `src/features/feed/feed-card.test.tsx`
- Create: `src/features/feed/post-media-card.tsx`
- Create: `src/features/feed/post-media-card.test.tsx`
- Delete: `src/features/feed/post-image-grid.tsx`
- Delete: `src/features/feed/process-post-image.ts`
- Delete: `src/features/feed/process-post-image.test.ts`

**Steps:**

- [ ] Write RED composer tests for explicit Image/Video choice, one HTTPS URL, optional description/label, inline validation, media-only submission, edit/replace/remove, retained invalid draft, and Sonner success/error.
- [ ] Remove file input, drag/drop, browser compression, upload progress, pending upload cleanup, and four-image grid state.
- [ ] Add one media dialog/section using existing Base UI/shadcn form controls. It must never infer media type from URL extension.
- [ ] Render image media with `loading="lazy"`, `referrerPolicy="no-referrer"`, explicit broken-image geometry, user description or contextual `Image attached to post by {username}` alt text.
- [ ] Render video as safe linked preview: YouTube validated thumbnail when available; Vimeo/provider and external-domain cards otherwise. Use `target="_blank"` and `rel="noreferrer noopener"`; no playback or iframe.
- [ ] Keep whole-Post spoiler cover behavior over both text and media. Reveal state remains local to card instance.
- [ ] Run:

```powershell
pnpm exec vitest run src/features/feed/post-composer.test.tsx src/features/feed/use-post-composer.test.tsx src/features/feed/post-media-card.test.tsx src/features/feed/feed-card.test.tsx
pnpm exec tsc --noEmit
git diff --check
```

- [ ] Commit:

```powershell
git add src/features/feed/post-composer.tsx src/features/feed/post-composer.test.tsx src/features/feed/use-post-composer.ts src/features/feed/use-post-composer.test.tsx src/features/feed/feed-card.tsx src/features/feed/feed-card.test.tsx src/features/feed/post-media-card.tsx src/features/feed/post-media-card.test.tsx src/features/feed/post-image-grid.tsx src/features/feed/process-post-image.ts src/features/feed/process-post-image.test.ts
git commit -m "feat: attach post media by url"
```

## Task 6: Simplify Activity Metadata And Owner Menus

**Owner:** Feed UI worker

**Files:**

- Modify: `convex/feed.ts`
- Modify: `convex/feedMilestones.integration.test.ts`
- Modify: `src/features/feed/feed-card.tsx`
- Modify: `src/features/feed/feed-card.test.tsx`
- Modify: `src/features/feed/feed-owner-actions.tsx`
- Modify: `src/features/feed/feed-owner-actions.test.tsx`

**Steps:**

- [ ] Write RED tests for Completed/Rewatched `${year} · ${format}`, `TBA · Anime`, and preservation of the whole anime-row detail link.
- [ ] Hydrate milestone cards from cached anime summary `seasonYear` and `format`; do not add AniList queries or change Review/anime detail DTOs.
- [ ] Write RED owner-menu tests for exact labels and actions:
  - Post source action: `Delete`, destructive.
  - Completed/Rewatched activity action: `Delete`, destructive.
  - Review activity action: `Remove`, destructive.
  - Review feed menu has no `Delete Review`.
- [ ] Keep current confirmation dialog titles/descriptions, mutations, ownership checks, and Sonner messages. Review source deletion remains only on Review Detail.
- [ ] Run:

```powershell
pnpm exec vitest run convex/feedMilestones.integration.test.ts src/features/feed/feed-card.test.tsx src/features/feed/feed-owner-actions.test.tsx
pnpm exec tsc --noEmit
git diff --check
```

- [ ] Commit:

```powershell
git add convex/feed.ts convex/feedMilestones.integration.test.ts src/features/feed/feed-card.tsx src/features/feed/feed-card.test.tsx src/features/feed/feed-owner-actions.tsx src/features/feed/feed-owner-actions.test.tsx
git commit -m "fix: simplify feed activity actions"
```

## Task 7: Align Home Utility Cards And Remove Main Discover Genres

**Owner:** Home/Discover worker

**Files:**

- Modify: `src/features/home/home-sidebar.tsx`
- Modify: `src/features/home/home-sidebar.test.tsx`
- Modify: `src/features/discover/ui/discover-page.tsx`
- Modify: `src/features/discover/ui/discover-page.test.tsx`

**Steps:**

- [ ] Write RED tests requiring Home This Week and Upcoming wrappers to use Discover's `rounded-lg border border-border bg-card p-4` surface.
- [ ] Reuse existing Discover weekly/upcoming components and data; do not add a Home fetch, sidebar on mobile, or responsive data-flow change.
- [ ] Write RED tests proving main-column Genres is absent while desktop Top Genres, genre filters, URL state, and genre selection remain.
- [ ] Remove only isolated main-column Genres markup. Keep `DISCOVER_GENRES` where Top Genres/filter behavior needs it.
- [ ] Run:

```powershell
pnpm exec vitest run src/features/home/home-sidebar.test.tsx src/features/discover/ui/discover-page.test.tsx
pnpm exec tsc --noEmit
git diff --check
```

- [ ] Commit:

```powershell
git add src/features/home/home-sidebar.tsx src/features/home/home-sidebar.test.tsx src/features/discover/ui/discover-page.tsx src/features/discover/ui/discover-page.test.tsx
git commit -m "fix: align home and discover surfaces"
```

## Task 8: Integrate, Update Current-State Docs, And Run Automated Gates

**Owner:** controller, then fresh reviewer and docs mapper

**Files:**

- Modify: `docs/architecture/review-discovery-data-flow.md`
- Modify: `docs/architecture/discover-data-flow.md`
- Modify: `TODO.md`
- Generated if changed: `convex/_generated/*`

**Steps:**

- [ ] Integrate task commits once. Resolve shared `feed-card.tsx`, `feed.ts`, and generated-file overlaps in controller context.
- [ ] Confirm `package.json` and `pnpm-lock.yaml` unchanged.
- [ ] Update Review/Post data-flow docs as current state: external Post media validation/storage/render path, no server fetch, no upload/storage table, migration verified. Remove stale upload edges.
- [ ] Update Discover docs to remove only main-column Genres while retaining Top Genres and filters.
- [ ] Run Convex sync once after final integration:

```powershell
pnpm exec convex dev --once
```

- [ ] Run focused affected tests, then full gates:

```powershell
pnpm test
pnpm exec tsc --noEmit
pnpm build
pnpm exec fallow audit --base HEAD --gate new-only --format json --quiet
git diff --check
```

Expected: all tests/type/build pass; Fallow reports no introduced blocking finding; diff check clean.

- [ ] Scan built client assets and require no `graphql.anilist.co` match.
- [ ] Run fresh spec review and thermo review. Require PASS for migration scope, auth/ownership, strict media validation, selection behavior, source-truth feed hydration, no duplicate helpers, and acceptable file size.
- [ ] Fix all blocking findings, rerun affected gates, update tracker, and commit:

```powershell
git add docs/architecture/review-discovery-data-flow.md docs/architecture/discover-data-flow.md TODO.md convex/_generated
git commit -m "docs: record post media data flow"
```

## Task 9: Authenticated Live Browser QA And Closure

**Owner:** fresh QA worker plus controller cleanup

**Account:** Use the stored DPAPI-protected AnimeX QA account. Never print, paste, commit, log, or screenshot credentials, OTPs, tokens, or decrypted values.

**Steps:**

- [ ] Start final integrated app and test real signed-in flows only after Convex sync and automated gates pass.
- [ ] At 1280 px, exercise full Review toolbar: H2/H3, quote, both list types, bold/italic/underline/strikethrough, image URL + alt, video URL, spoiler wrap/unwrap, Undo/Redo, Preview parity, draft resume, publish/edit, and published rendering.
- [ ] For both Review image and video, verify caret insertion, selected-text replacement, no-valid-selection top insertion, click selection, Backspace/Delete from selected and adjacent positions, caret recovery, and Undo restoration.
- [ ] Create text-only, media-only, image, and video Posts through real UI. Verify invalid URL retention, optional description/label, contextual image alt, linked video cards, broken-image state, spoiler reveal, edit/replace/remove media, visibility, owner delete, and Sonner states.
- [ ] Verify Review feed menu only shows destructive `Remove`; Post and milestone menus show destructive `Delete`; Review Detail still provides Review deletion with unchanged confirmation.
- [ ] Verify Completed/Rewatched metadata and fallback, whole-row navigation, Home This Week/Upcoming card surfaces, removed Discover main Genres, retained Top Genres, and functional genre filters.
- [ ] Use locator-driven hover at 1280 px on toolbar buttons, media nodes, dialogs, Post media controls/cards, feed rows, owner menus, destructive actions, Home utility rows, Top Genres, and filters. Capture default/hover/open/focus/selected/error states and inspect computed background, foreground, border, and icon colors.
- [ ] At 390 and 768 px, verify touch/pressed and keyboard-focus states, dialogs/sheets, Review media editing, Post media layout, feed cards, no sticky hover, no clipping, and no horizontal overflow.
- [ ] Check console, hydration, failed requests, unexpected media server requests, layout shift, scrollbar-gutter changes, and network errors at each width.
- [ ] Delete QA Posts/Review activity created for this pass where product controls support it. Keep reusable account; do not delete it.
- [ ] Run final affected tests after any QA fix, require reviewer/QA PASS, mark tracker complete, and commit verified closure. Do not deploy or merge.

---

## Orchestration Sequence

1. Task 1 locks shared contracts.
2. Task 2 may run while Task 3 begins because Review editor and Convex migration write sets are disjoint.
3. Tasks 3 and 4 remain sequential under one schema lock.
4. Task 5 starts only after final Post backend contract from Task 4.
5. Tasks 6 and 7 may run in parallel after shared contract release; controller owns overlap integration.
6. Task 8 integrates once and runs reviewer/docs gates.
7. Task 9 runs only against fully integrated, synced state.

## Final Acceptance

- Review image/video inserts at active selection, replaces selected content, inserts at top when selection is invalid, supports click selection and Backspace/Delete, and preserves Undo/Redo.
- Spoiler control wraps and unwraps without losing content/formatting or allowing nesting.
- Posts accept zero or one safe external image/video URL, including media-only Posts; no upload/file/image-processing path remains.
- Approved legacy file-image Posts, projections, image rows, and storage are deleted; text-only Posts survive; verification reports zero legacy remnants.
- Review activity menu cannot delete Review source. All requested menu labels and destructive styles are exact.
- Completed/Rewatched cards show year/format metadata without AniList changes.
- Home utility surfaces match Discover; only Discover main-column Genres is removed.
- No new dependency, Convex action, arbitrary server fetch, client AniList endpoint, production deployment, or automatic merge.
- Full tests, TypeScript, build, Fallow new-only, diff check, reviewer, authenticated browser QA, responsive, hover, keyboard, touch, console, hydration, and overflow checks pass.
