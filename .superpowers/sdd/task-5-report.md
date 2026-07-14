# Task 5 Post URL Media Report

Status: complete

Implementation commit: `37df5dc`

## Result

- Replaced Post file uploads with one explicit Image or Video HTTPS URL attachment.
- Kept invalid URL drafts visible with inline and Sonner errors.
- Supports text-only, media-only, text-plus-media, edit, replace, and remove flows.
- Images use lazy loading, no-referrer requests, contextual alt text, and fixed unavailable geometry.
- Videos render safe external links only. Valid YouTube IDs receive thumbnails. No iframe, playback, server fetch, or metadata request exists.
- Whole-Post spoiler reveal still covers text and media with card-local state.
- Removed upload, compression, pending cleanup, reorder, four-image grid, and browser file-input code.

## TDD Evidence

RED:

- `pnpm exec vitest run src/features/feed/use-post-composer.test.tsx src/features/feed/post-media-card.test.tsx`
- Result: 2 files failed. Four hook behavior tests failed against legacy image-array state; media-card import failed because component did not exist.
- `pnpm exec vitest run src/features/feed/post-composer.test.tsx src/features/feed/feed-card.test.tsx src/features/feed/post-media-card.test.tsx src/features/feed/use-post-composer.test.tsx`
- Result: 5 tests failed against legacy file-picker and `imageUrls` rendering.

GREEN:

- `pnpm exec vitest run src/features/feed/post-composer.test.tsx src/features/feed/use-post-composer.test.tsx src/features/feed/post-media-card.test.tsx src/features/feed/feed-card.test.tsx src/features/social/shared/feed-ranking.test.ts src/features/feed/feed-list.test.tsx src/features/feed/feed-owner-actions.test.tsx src/features/feed/feed-state.test.ts`
- Result: 8 files passed, 35 tests passed.
- `pnpm exec tsc --noEmit`
- Result: passed.
- `pnpm exec fallow audit --format json --quiet --base 3354c34`
- Result: passed with zero introduced findings. Existing `react-dom` dependency placement and `usePostComposer` complexity warnings remain inherited.
- `git diff --check`
- Result: passed.

## Changed Files

- `src/features/feed/post-composer.tsx`
- `src/features/feed/post-composer.test.tsx`
- `src/features/feed/use-post-composer.ts`
- `src/features/feed/use-post-composer.test.tsx`
- `src/features/feed/feed-card.tsx`
- `src/features/feed/feed-card.test.tsx`
- `src/features/feed/post-media-card.tsx`
- `src/features/feed/post-media-card.test.tsx`
- `src/features/social/shared/feed-ranking.test.ts`
- `src/features/feed/feed-list.test.tsx`
- `src/features/feed/feed-owner-actions.test.tsx`
- `src/features/feed/feed-state.test.ts`
- `src/features/feed/post-composer-dialog.tsx`

Deleted:

- `src/features/feed/post-image-grid.tsx`
- `src/features/feed/process-post-image.ts`
- `src/features/feed/process-post-image.test.ts`

## Self-review

- Shared media schema and provider helpers remain source of validation truth.
- Media type is user-selected; URL extensions never determine Image versus Video.
- Submission failure does not clear draft state.
- External links use `target="_blank"` and `rel="noreferrer noopener"`.
- No dependency, generated file, Convex file, route, TODO, or unrelated product behavior changed.

## Risks

- Browser QA remains controller-owned after integration.
- Remote image and YouTube thumbnail availability is external; UI exposes truthful unavailable or linked states without fallback fetching.
