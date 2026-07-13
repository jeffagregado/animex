# Task 4 Feed Frontend Report

Status: implemented. Controller integration still owns generated route tree.

## Changed

- Replaced mock Home feed/sidebar metrics with strict live Global, Home, Following feeds.
- Added manual opaque cursor paging, ID dedupe, retry, loading, empty, terminal states.
- Added Post, Review, Completed, Rewatched cards; spoiler reveals; owner actions; Phase 6 disabled controls.
- Added direct feed-card route and typed Home feed/composer search state.
- Added responsive Post dialog/mobile sheet, edit flow, dirty navigation guard, Sonner states.
- Added browser image validation, resize/re-encode, GIF pass-through, upload claim/register/discard cleanup.
- Added complete-user mobile Create entry. No Profile destination.
- Removed fake feed records, counts, favorites, and private metrics.

## Validation

- `pnpm test -- src/features/feed/feed-state.test.ts src/features/feed/process-post-image.test.ts src/features/feed/feed-card.test.tsx src/features/home/home-page.test.tsx src/features/shell/public-shell.test.tsx src/features/social/shared/feed-ranking.test.ts` — 6 files, 20 tests passed.
- `pnpm exec tsc --noEmit` — passed.
- `git diff --check` — passed; PowerShell emitted line-ending warnings only.

## Integration Notes

- Shared contract blocker resolved by controller commit `c09dda0`: Post feed DTO now provides `postId` and ordered `imageIds`.
- `src/routeTree.gen.ts` changed through TanStack route discovery but remains controller-owned and excluded from this task commit.
- Browser QA not run in worker slice. Controller QA should verify 390/768/1280 layouts, focus/touch, console, upload, and live Convex mutations.

## Residual Risk

- Canvas encoding and EXIF orientation depend on browser `createImageBitmap` support; helper fails explicitly when unavailable.
- Upload lifecycle uses real signed URLs and needs live browser/Convex verification.
- Following stays truthful empty until Phase 6.
