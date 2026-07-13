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
- Gated private feeds and mutation UI on both complete public auth and Convex auth; feed scope reloads across auth changes.
- Hardened feed paging against stale view/auth responses, duplicate cursor requests, and destructive retry resets.
- Made upload cancellation explicit across claim, storage, and register stages with awaited cleanup and submit locking.
- Replaced browser confirmation with a themed Base UI discard dialog and blocked publishing errored images.
- Added deterministic timestamps and truthful malformed/private/not-found detail states.
- Added unmount/auth-loss cancellation for processing, uploading, and registered images with awaited backend cleanup and guarded state updates.
- Preserved returned storage IDs before cancellation cleanup, made rejected cleanup retryable, and surfaced cleanup failures through actionable toasts.
- Made refresh advance the feed request epoch so every older initial/load-more continuation is ignored without corrupting loading state.
- Made upload abort phase-aware: cancellation stops pre-response fetches but lets an arrived response body reveal its storage ID before deletion.
- Added a successful-save blocker bypass/reset so changed visibility cannot prevent the post-save close or navigation; failed saves remain dirty.
- Kept both client-navigation and before-unload guards dynamic so the saved bypass applies immediately without waiting for a rerender.

## Validation

- `pnpm test -- src/features/feed/feed-state.test.ts src/features/feed/use-feed-pages.test.tsx src/features/feed/process-post-image.test.ts src/features/feed/use-post-composer.test.tsx src/features/feed/post-composer.test.tsx src/features/feed/feed-card.test.tsx src/features/feed/feed-card-detail-page.test.tsx src/features/feed/feed-owner-actions.test.tsx src/features/home/home-page.test.tsx src/features/shell/public-shell.test.tsx src/features/social/shared/feed-ranking.test.ts` — 11 files, 51 tests passed.
- `pnpm exec tsc --noEmit` — passed.
- `git diff --check` — passed; PowerShell emitted line-ending warnings only.

## Integration Notes

- Shared contract blocker resolved by controller commits `c09dda0` and `e4d52f4`: Post DTO includes ordered image IDs; direct detail accepts string IDs and returns null for malformed IDs; milestone DTO includes visibility.
- `src/routeTree.gen.ts` changed through TanStack route discovery but remains controller-owned and excluded from this task commit.
- Browser QA not run in worker slice. Controller QA should verify 390/768/1280 layouts, focus/touch, console, upload, and live Convex mutations.

## Residual Risk

- Canvas encoding and EXIF orientation depend on browser `createImageBitmap` support; helper fails explicitly when unavailable.
- Upload lifecycle uses real signed URLs and needs live browser/Convex verification.
- Following stays truthful empty until Phase 6.
