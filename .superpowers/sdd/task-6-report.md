# Task 6: Home Desktop Utility Column

Status: complete

## Result

- Desktop Home now uses feed plus 320 px utility column; column stays hidden below `lg`.
- Public order: Latest Reviews, This Week, Upcoming.
- Complete signed-in order: List Progress, Latest Reviews, This Week, Upcoming.
- Public composition never mounts private List Progress query.
- Latest Reviews shows cover, author, relative time, compact spoiler-aware Summary, Detail link, and `/reviews` link. Rating stays absent.
- List Progress shows Watching, Completed, Plan to Watch, and Dropped counts with proportional bars.
- Latest Reviews and List Progress have scoped loading, empty, error, retry, and refresh states. Loaded content survives refresh failure.
- Home reuses existing This Week and Upcoming components and Task 5 Discover states.
- Community feed and What are you watching were removed. Create Post and feed tabs remain.
- Review Summary requires explicit detail or compact two-line list behavior at every callsite.
- Latest Reviews rejects drafts and missing publish timestamps before shared DTO parsing. Rows use only `publishedAt`; no update-time fallback exists.

## TDD Evidence

- RED: Review Summary list test failed because detail classes rendered.
- GREEN: Review Summary suite passed 5 tests.
- RED: sidebar suite failed because three Task 6 modules did not exist.
- GREEN: sidebar suite passed 5 tests after order, query isolation, row, refresh-error, and progress behavior landed.
- RED: Home suite failed on missing utility modules and retained placeholders.
- GREEN: Home suite passed 14 tests after composition integration.
- RED: malformed draft rendered through update time; malformed published data surfaced only generic schema output.
- GREEN: both malformed cases now enter scoped Latest Reviews error UI and render no row.
- RED: required Summary variant produced compiler failures at Detail and Preview.
- GREEN: every Detail, Preview, Summary, and list callsite now chooses behavior explicitly.

## Validation

- Review fix: `pnpm exec vitest run src/features/home/home-sidebar.test.tsx src/features/home/home-page.test.tsx src/features/reviews/ui/review-summary.test.tsx src/features/reviews/ui/review-detail-page.behavior.test.tsx src/features/reviews/ui/review-detail-page.test.ts src/features/reviews/ui/review-preview.test.tsx` - 31 passed.
- Types: `pnpm exec tsc --noEmit` - passed.
- Diff: scoped `git diff --check` - passed.
- Fallow: `pnpm exec fallow audit --base HEAD --gate new-only --format json --quiet` - blocked by concurrent Task 8 test files importing three discovery modules that are not present yet. Task 6 files produced zero introduced complexity or duplication findings. One inherited `react-dom` placement finding and the existing node_modules detection warning remain.

## Review

- React check: hooks unconditional; effects cancel stale responses; semantic controls and links; stable list keys; explicit image alternatives; no speculative memoization.
- Thermo check: requested Summary variant justified; no generic helper, dependency, route, Convex, or generated-file change; all new files below 100 lines.

## Remaining QA

- Browser responsive, interaction, console, and network QA remains integration Task 11 scope after Tasks 7-10 land.
