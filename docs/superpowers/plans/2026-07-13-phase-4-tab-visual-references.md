# Phase 4 Tab Visual References Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate six approved, implementation-ready Anime Detail tab references for desktop and mobile.

**Architecture:** Use approved Overview desktop/mobile images as style and layout references, not edit targets. Generate each tab and viewport as a fresh standalone UI mockup, inspect at original resolution, iterate only on concrete defects, then store final PNG files beside Overview references.

**Tech Stack:** Built-in OpenAI image generation, Codex image inspection, PNG assets, Git.

## Global Constraints

- Follow `docs/superpowers/specs/2026-07-13-phase-4-tab-visual-references-design.md`.
- Preserve Frieren page identity, AnimeX dark navy/cyan/coral system, full hero context, controls, tabs, and responsive shell.
- Desktop uses approved desktop composition; mobile uses approved portrait composition and bottom navigation.
- No source code, dependency, route, AniList, Convex, or schema changes.
- Save final images under `docs/visual/anime-details/` with exact approved names.
- No watermark, unrelated branding, clipped UI, overlapping UI, fake dashboard chrome, Community navigation, or Stats navigation.

---

### Task 1: Reviews references

**Files:**
- Reference: `docs/visual/anime-details/anime-details-desktop-frieren.png`
- Reference: `docs/visual/anime-details/anime-details-mobile-frieren.png`
- Create: `docs/visual/anime-details/anime-details-reviews-desktop-frieren.png`
- Create: `docs/visual/anime-details/anime-details-reviews-mobile-frieren.png`

**Interfaces:**
- Consumes: approved visual source and written spec.
- Produces: full-page Reviews desktop/mobile PNG pair.

- [ ] **Step 1: Generate fresh desktop Reviews reference**

Use case `ui-mockup`. Keep full Frieren page and activate Reviews. Show rating summary, score distribution, review count, sort control, and legible review cards with avatar, author, Review Rating, required summary, body preview, date, and helpful count.

- [ ] **Step 2: Inspect desktop at original resolution**

Verify active tab, readable content hierarchy, no clipping/overlap, matching palette and shell, and exact MVP navigation. Regenerate once with one targeted correction for each concrete defect found.

- [ ] **Step 3: Generate fresh mobile Reviews reference**

Keep portrait hero, controls, four tabs, bottom navigation, and touch-sized controls. Use single-column review content without horizontal overflow.

- [ ] **Step 4: Inspect mobile and save pair**

Verify tab content remains legible at mobile scale, then save both final PNG files at exact paths.

### Task 2: Characters references

**Files:**
- Reference: `docs/visual/anime-details/anime-details-desktop-frieren.png`
- Reference: `docs/visual/anime-details/anime-details-mobile-frieren.png`
- Create: `docs/visual/anime-details/anime-details-characters-desktop-frieren.png`
- Create: `docs/visual/anime-details/anime-details-characters-mobile-frieren.png`

**Interfaces:**
- Consumes: approved visual source and written spec.
- Produces: full-page Characters desktop/mobile PNG pair.

- [ ] **Step 1: Generate fresh desktop Characters reference**

Use case `ui-mockup`. Keep full Frieren page and activate Characters. Show roomy portrait grid with character portrait, name, story role, voice actor identity, and language label.

- [ ] **Step 2: Inspect desktop at original resolution**

Verify strong scan order, consistent card geometry, readable labels, correct active tab, and no nested container clutter. Regenerate only for concrete defects.

- [ ] **Step 3: Generate fresh mobile Characters reference**

Use readable two-column cards within portrait page. Preserve full hero context, controls, tabs, and bottom navigation.

- [ ] **Step 4: Inspect mobile and save pair**

Verify portrait crops, text sizes, and two-column spacing, then save both final PNG files at exact paths.

### Task 3: Staff references

**Files:**
- Reference: `docs/visual/anime-details/anime-details-desktop-frieren.png`
- Reference: `docs/visual/anime-details/anime-details-mobile-frieren.png`
- Create: `docs/visual/anime-details/anime-details-staff-desktop-frieren.png`
- Create: `docs/visual/anime-details/anime-details-staff-mobile-frieren.png`

**Interfaces:**
- Consumes: approved visual source and written spec.
- Produces: full-page Staff desktop/mobile PNG pair.

- [ ] **Step 1: Generate fresh desktop Staff reference**

Use case `ui-mockup`. Keep full Frieren page and activate Staff. Show roomy portrait grid with staff name and clear production role; use restrained grouping only when it improves scanning.

- [ ] **Step 2: Inspect desktop at original resolution**

Verify production roles remain readable, card hierarchy matches Characters family, active tab is correct, and no clipping or unrelated navigation appears. Regenerate only for concrete defects.

- [ ] **Step 3: Generate fresh mobile Staff reference**

Use readable two-column cards within portrait page. Preserve hero, controls, tabs, and bottom navigation.

- [ ] **Step 4: Inspect mobile and save pair**

Verify names and roles remain readable, then save both final PNG files at exact paths.

### Task 4: Integrated visual QA and closure

**Files:**
- Verify: `docs/visual/anime-details/*.png`
- Modify: `TODO.md`

**Interfaces:**
- Consumes: six generated PNG files.
- Produces: approved visual set and closed tracker.

- [ ] **Step 1: Inspect all six images side by side**

Confirm desktop/mobile pairs share hero identity, active-tab behavior, navigation, palette, typography, radii, spacing, and component language with Overview sources.

- [ ] **Step 2: Verify exact deliverables**

Run `git status --short` and verify all six exact filenames exist. Expected: six new PNG assets plus plan/tracker updates only.

- [ ] **Step 3: Close tracker**

Mark generation, inspection, asset-save, and commit items complete in `TODO.md`. Set status to `COMPLETE`.

- [ ] **Step 4: Validate repository diff**

Run `git diff --check`. Expected: exit code 0. Inspect `git diff --stat` and confirm no application source or dependency files changed.

- [ ] **Step 5: Commit**

Run:

```powershell
git add TODO.md docs/superpowers/plans/2026-07-13-phase-4-tab-visual-references.md docs/visual/anime-details/*.png
git commit -m "design: add phase 4 tab references"
```

Expected: focused commit containing six images and tracking documents.
