# Catalog Hover Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Catalog biography links navigable while preventing hover preloads from exposing a stale mixed TanStack/Vite dependency graph.

**Architecture:** Pin every direct TanStack package that currently uses `latest` or a drifting router range to the committed lockfile resolution. Keep global intent preloading for normal app navigation, but opt generated biography links out because dense inline links should load only after activation.

**Tech Stack:** TanStack Start, TanStack Router, Vite 8, React 19, Vitest, pnpm.

## Global Constraints

- Preserve all existing dirty hunks.
- Add no dependency.
- Keep external biography links unchanged.
- Keep internal biography links keyboard and pointer navigable.
- Do not change global router preloading.
- Verify rapid repeated hover across multiple internal links in Chrome.

---

### Task 1: Disable Biography Hover Preloads

**Files:**
- Modify: `src/features/catalog-person/ui/catalog-person-page.test.tsx`
- Modify: `src/features/catalog-person/ui/catalog-person-description.tsx`

**Interfaces:**
- Consumes: TanStack Router `Link` and its `preload` option.
- Produces: Anime, Character, and Staff biography links with `preload={false}`.

- [ ] **Step 1: Write the failing regression assertions**

Extend the test `formats biography labels and replaces AniList entity links with AnimeX routes`. Make the `Link` test double expose its `preload` prop as `data-preload`, then assert all three internal entity links have `data-preload="false"`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
pnpm test -- src/features/catalog-person/ui/catalog-person-page.test.tsx
```

Expected: the biography formatting test fails because internal links do not pass `preload={false}`.

- [ ] **Step 3: Add the smallest production fix**

Pass `preload={false}` to the Anime, Character, and Staff `Link` elements in `catalog-person-description.tsx`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the same focused test. Expected: all Catalog Person page tests pass.

### Task 2: Pin The TanStack Toolchain

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: exact direct dependency resolutions already recorded in `pnpm-lock.yaml`.
- Produces: deterministic direct TanStack specifiers and a matching installed tree.

- [ ] **Step 1: Replace drifting TanStack specifiers**

Pin direct TanStack packages to these committed resolutions:

```text
@tanstack/react-devtools 0.10.8
@tanstack/react-form 1.33.1
@tanstack/react-query 5.101.2
@tanstack/react-query-devtools 5.101.2
@tanstack/react-router 1.170.17
@tanstack/react-router-devtools 1.167.0
@tanstack/react-router-ssr-query 1.167.1
@tanstack/react-start 1.168.27
@tanstack/router-plugin 1.168.18
@tanstack/devtools-vite 0.8.1
@tanstack/router-cli 1.167.17
```

- [ ] **Step 2: Synchronize lockfile and install offline**

Run:

```powershell
pnpm install --offline
```

Expected: package specifiers and direct links match the pinned versions without downloading or adding dependencies.

- [ ] **Step 3: Verify deterministic installation**

Run `pnpm install --frozen-lockfile --offline`, inspect direct package versions, and confirm no `latest` TanStack specifiers remain.

### Task 3: Validate And Stress Hover

**Files:**
- Modify: `TODO.md`

**Interfaces:**
- Consumes: integrated code and deterministic installed tree.
- Produces: automated, static-analysis, build, and live Chrome evidence.

- [ ] **Step 1: Run automated gates**

Run the focused test, full test suite, TypeScript check, production build, React Doctor changed-code scan, Fallow patch audit, `git diff --check`, and protected route-tree hash check.

- [ ] **Step 2: Run clean dev server**

Start the worktree server with fresh logs. Confirm startup does not emit `Invalid hook call`, `QueryClientProvider`, hydration, or preload errors.

- [ ] **Step 3: Stress-hover internal links**

On the Aoi Yuuki Staff page, rapidly move the pointer across at least five internal biography links for repeated passes. Confirm the page stays responsive, navigation targets remain correct, and no route preload requests or preload stack errors appear.

- [ ] **Step 4: Close QA resources**

Close the test browser, stop the test-created server, confirm port 3000 is clear, and mark the TODO section complete only after all gates pass.
