# Phase 4 Anime Controls Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Match the approved control reference while preserving auth gates and autosave, and atomically apply Watching on the first score only when Status is unset.

**Architecture:** Keep visual/input behavior in `src/features/anime-detail/ui/`. Keep the score/status invariant inside the existing Convex `setScore` mutation so one transaction owns the write. Do not change routes, schemas, AniList transport, caches, tabs, or page content.

**Tech Stack:** TanStack Start, React, Base UI, Convex, Vitest, Tailwind CSS.

---

### Task 1: Lock regression behavior

**Files:**
- Modify: `src/features/anime-detail/ui/anime-user-controls.test.ts`
- Modify: `convex/userAnime.integration.test.ts`

- Add failing tests for default visual score `0`, one-decimal typed scores, no Clear action, exact Status labels, and the reference control geometry.
- Add failing integration coverage for first-score Watching and preservation of existing Status.

### Task 2: Make first-score Status atomic

**Files:**
- Modify: `convex/userAnime.ts`
- Test: `convex/userAnime.integration.test.ts`

- Patch Score and conditional Status in the existing authenticated mutation transaction.
- Set Watching only for stored Score `null` to non-null when stored Status is `null`.
- Preserve all existing Status values and mutation validation.

### Task 3: Rebuild the control row

**Files:**
- Modify: `src/features/anime-detail/ui/anime-user-controls.tsx`
- Modify: `src/features/anime-detail/ui/use-anime-autosave.ts`
- Test: `src/features/anime-detail/ui/anime-user-controls.test.ts`

- Match the approved dark card controls and desktop row.
- Render exact Status labels instead of enum values.
- Display `0` for an unset score without persisting on mount.
- Accept at most one decimal while retaining `0.5` button and keyboard steps.
- Remove Clear and use stacked chevrons.
- Preserve public redirect facades, private query boundary, debounce, Sonner, error, and retry behavior.

### Task 4: Validate and close

**Files:**
- Modify: `TODO.md`
- Create/update: `design-qa.md`

- Run focused tests, Convex sync, full tests, TypeScript, build, Fallow, and diff check.
- Compare the approved image and browser capture at the same state.
- Run locator-driven desktop hover/open/focus QA plus tablet/mobile responsive and console checks.
- Obtain fresh review and QA verdicts, then commit the verified feedback fix.

