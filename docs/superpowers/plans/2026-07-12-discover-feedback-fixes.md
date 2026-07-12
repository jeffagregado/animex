# Discover Feedback Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Theme Discover selects, add one-step filter clearing, and add reusable controlled horizontal rails without changing current cards or data flow.

**Architecture:** Keep URL state in existing route/page callback. Extract a reusable themed select inside filter module and a reusable `HorizontalRail` component for poster rows. Native overflow remains source of truth; buttons call viewport-relative `scrollBy` and derive boundary state from scroll metrics.

**Tech Stack:** React 19, TypeScript, TanStack Router, Tailwind CSS 4, Lucide React, Vitest, Testing Library.

## Global Constraints

- No production dependency changes.
- Preserve current poster sizes, card styling, responsive layout, and noninteractive card behavior.
- Clear filters preserves query and resets Genre, Format, Season, Year, and Sort to `relevance`.
- Reuse one rail for Trending, Seasonal, and Popular Recommendations.
- TDD required. Browser QA at 390, 768, and 1280 pixels.
- No AniList, Convex, cache, server-function, or Phase 4 changes.

---

### Task 1: Themed selects and filter clearing

**Files:**
- Modify: `src/features/discover/ui/discover-search-filters.tsx`
- Test: `src/features/discover/ui/discover-search-filters.test.tsx`

**Interfaces:**
- Consumes: `DiscoverUrlSearchState`, `DiscoverSearchStateChange`.
- Produces: existing `DiscoverSearchFilters` API unchanged.

- [x] **Step 1: Write failing behavior tests**

Add assertions that selects use `appearance-none`, render themed chevrons, and `Clear filters` appears only with active filters. Click must emit:

```ts
expect(onStateChange).toHaveBeenCalledWith({
  query: 'frieren',
  genre: null,
  format: null,
  season: null,
  year: null,
  sort: 'relevance',
}, 'push')
```

- [x] **Step 2: Verify RED**

Run: `pnpm test src/features/discover/ui/discover-search-filters.test.tsx`

Expected: FAIL because themed chevrons and `Clear filters` do not exist.

- [x] **Step 3: Implement minimal themed controls**

Use one internal select component with `appearance-none`, dark/cyan hover classes, and `ChevronDown`. Add:

```ts
const hasActiveFilters = searchState.genre !== null
  || searchState.format !== null
  || searchState.season !== null
  || searchState.year !== null
  || searchState.sort !== 'relevance'

const clearFilters = (): void => onStateChange({
  ...searchState,
  genre: null,
  format: null,
  season: null,
  year: null,
  sort: 'relevance',
}, 'push')
```

- [x] **Step 4: Verify GREEN**

Run: `pnpm test src/features/discover/ui/discover-search-filters.test.tsx`

Expected: all filter tests PASS.

### Task 2: Reusable horizontal rail controls

**Files:**
- Create: `src/features/discover/ui/horizontal-rail.tsx`
- Create: `src/features/discover/ui/horizontal-rail.test.tsx`
- Modify: `src/features/discover/ui/discover-section.tsx`
- Test: `src/features/discover/ui/discover-section.test.tsx`

**Interfaces:**
- Produces: `HorizontalRail({ children, label }: { children: ReactNode; label: string })`.
- Consumes: poster cards as children; no anime-domain dependency.

- [x] **Step 1: Write failing rail tests**

Cover accessible previous/next buttons, initial previous disabled state, `scrollBy` on next, state updates after scroll, and resize recalculation. Mock element metrics directly; do not mock component behavior.

- [x] **Step 2: Verify RED**

Run: `pnpm test src/features/discover/ui/horizontal-rail.test.tsx`

Expected: FAIL because module does not exist.

- [x] **Step 3: Implement minimal rail**

Use a ref, one metric updater, passive scroll listener, resize listener, and viewport-relative scrolling:

```ts
const distance = Math.max(viewport.clientWidth * 0.8, 240)
viewport.scrollBy({ left: direction * distance, behavior: 'smooth' })
```

Render native `overflow-x-auto`, `snap-x`, and accessible controls. Hide/disable controls only from measured boundaries; keep touch and trackpad behavior.

- [x] **Step 4: Wire all poster sections**

Replace ready-state row only:

```tsx
<HorizontalRail label={title}>
  {state.section.items.map(...)}
</HorizontalRail>
```

Add `snap-start` to poster cards. Keep loading/error/empty states unchanged.

- [x] **Step 5: Verify GREEN**

Run: `pnpm test src/features/discover/ui/horizontal-rail.test.tsx src/features/discover/ui/discover-section.test.tsx`

Expected: rail and section tests PASS.

### Task 3: Integration and QA

**Files:**
- Modify: `TODO.md`
- Modify: `docs/superpowers/plans/2026-07-12-discover-feedback-fixes.md`
- Modify only if defects require it: assigned Discover UI/tests above.

**Interfaces:**
- No new public API beyond `HorizontalRail`.

- [x] **Step 1: Run automated gates**

```powershell
pnpm test
pnpm exec tsc --noEmit
pnpm build
pnpm exec fallow audit --base HEAD --gate new-only --format json --quiet
git diff --check
```

Expected: tests/type/build/diff PASS; Fallow has no introduced error findings.

- [x] **Step 2: Run browser QA**

At 390, 768, and 1280 pixels verify select hover/focus remains dark, Clear filters preserves query and removes filter URL keys, rail arrows scroll, touch/native overflow remains, boundary buttons disable, no page overflow, keyboard focus works, console stays clean.

- [x] **Step 3: Review and close trackers**

Run independent findings-first review. Fix every P1/P2, rerun affected gates, update checkboxes and `TODO.md` with current state.

- [x] **Step 4: Commit implementation**

```powershell
git add TODO.md docs/superpowers/plans/2026-07-12-discover-feedback-fixes.md src/features/discover/ui
git commit -m "fix: improve discover filters and rails"
```
