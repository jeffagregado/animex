# Task 6: Discover Navigation

Status: complete

## Result

- Rails, search results, This Week rows, and Upcoming rows use typed TanStack `Link` navigation.
- Every link targets `/anime/$anilistId/$slug` with existing AniList ID and canonical slug.
- Whole card or row is keyboard-focusable with visible focus ring.
- Existing layout, content, score badges, filters, responsive branches, and retry controls remain unchanged.

## TDD Evidence

- RED: focused link tests failed 6 times because no link roles existed; 13 existing tests passed.
- GREEN: `pnpm test -- src/features/discover/ui/discover-section.test.tsx src/features/discover/ui/discover-search-results.test.tsx src/features/discover/ui/discover-weekly-list.test.tsx src/features/discover/ui/discover-upcoming-list.test.tsx` — 19 passed.
- Discover UI: `pnpm test -- src/features/discover/ui` — 36 passed.
- Types: `pnpm exec tsc --noEmit` — passed.
- Diff: `git diff --check -- <owned Discover files>` — passed.

## Risk

- Browser QA remains integration Task 7 scope.
