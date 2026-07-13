# Phase 4 Anime Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Ship canonical Anime Detail routes, cached AniList metadata, user anime controls, rewatch history, stable responsive tabs, and Discover navigation.

**Architecture:** Public metadata flows through validated TanStack Start server functions into a 24-hour Convex query/mutation cache. Private user state uses authenticated Convex queries/mutations. One shared detail shell owns hero, controls, tabs, and sidebar; `tab` URL search changes content only.

**Tech Stack:** TanStack Start/Router/Query, React, Zod, Convex, Base UI, Tailwind v4, Vitest.

## Global Constraints

- Canonical desktop shell: `docs/visual/anime-details/anime-details-staff-desktop-frieren.png`.
- Route: `/anime/$anilistId/$slug`; tabs: Overview plus `?tab=reviews|characters|staff`.
- Use directory `route.tsx` files.
- No new production dependency.
- No Convex action for AniList, cache, or user-anime work.
- Detail and people-page cache TTL: 24 hours; no stale fallback.
- Related Anime and Recommendations: first five, no pagination.
- Characters and Staff: 24 initially, then 24 per explicit Load more until `hasNextPage` is false.
- Rewatch History: 20 per page.
- Reviews stay truthful empty/read-ready; creation remains Phase 5 and Write review stays hidden.
- All app-owned inputs validated. Auth/profile derived server-side.
- No browser AniList endpoint, fake content, silent fallback, layout shift, or unrelated edits.

---

### Task 1: Shared contracts

- [x] RED/GREEN tests for ID, tab, people-page, metadata, status, score, and serialized error contracts.
- [x] Add typed detail, Character/Staff page, user-anime, milestone, and rewatch shapes under `src/features/anime-detail/shared/`.
- [x] Lock caps: 5 related, 5 recommendations, 24 people/page, 20 rewatches/page.
- [x] Focused tests pass; release contract lock.

### Task 2: AniList transport and public detail cache

- [x] RED tests for full detail normalization, caps, pagination, retries, not-found, rate limit, malformed payload, and no stale fallback.
- [x] Extract reusable server-only AniList transport without changing Discover behavior.
- [x] Implement full detail and one-kind people-page AniList queries.
- [x] Add `animeDetails`, `animeDetailPeoplePages`, and generic detail cache leases.
- [x] Implement indexed Convex cache queries/mutations and server orchestration using existing cache token.
- [x] Base commit atomically upserts lightweight summary and full detail.
- [x] Focused server/cache tests pass.

### Task 3: User anime state and milestones

- [x] RED tests for score, favorite timestamps, completion uniqueness, rewatch bump/removal, and final Completed correction.
- [x] Add `userAnimeEntries`, `animeRewatchEntries`, and `animeMilestones` with required indexes.
- [x] Implement authenticated `getMine`, paginated history, status, score, favorite, record-rewatch, and remove-latest mutations.
- [x] Enforce verified profile, cached anime identity, atomic writes, one-decimal score, and settled milestone rules.
- [x] Focused policy/function tests pass.

### Task 4: Routes and stable detail shell

- [x] RED route tests for positive ID, missing/stale slug, tab normalization, preserved tab redirects, and back/forward-safe navigation.
- [x] Add `$anilistId/route.tsx`, missing-slug index redirect, and `$slug/route.tsx` shared page.
- [x] Use QueryClient hydration with 15-minute browser stale time.
- [x] Build canonical hero, metadata, controls, tab bar, sidebar, pending/error/not-found states.
- [x] Signed-out controls auth-gate with safe `returnTo`; pending users route to required completion step.
- [x] Focused route/shell tests pass.

### Task 5: Tab content and user controls

- [x] RED UI tests for Overview, empty Reviews, Character/Staff grids, Load more, retry, dedupe, and end state.
- [x] Build Overview, truthful Reviews empty state, Character grid, Staff grid, and stable mobile sidebar order.
- [x] Implement Status Select, Score save/clear, Favorite toggle, and owner-only Rewatch dialog/drawer.
- [x] Keep Character/Staff page failures local while retaining prior cards.
- [x] Focused UI tests pass.

### Task 6: Discover navigation

- [x] RED tests prove each visible Discover anime card/list row links to canonical detail route.
- [x] Add typed links without changing filters, rails, scores, cards, or responsive layout.
- [x] Focused Discover tests pass.

### Task 7: Integration, review, QA, docs

- [x] Integrate contracts/backend/routes/UI once; regenerate route tree once.
- [x] Run Convex schema push once.
- [x] Spec review and thermo review pass.
- [x] Full automated gates pass.
- [x] Live AniList detail and Character/Staff pagination smoke pass.
- [x] Client endpoint scan finds no AniList URL.
- [x] Browser QA passes at 390, 768, and 1280 for tabs, redirects, signed-out auth gates, pagination, failures, keyboard, overflow, hydration, network, and console; authenticated mutations are covered by integration tests.
- [x] Publish current anime-detail data-flow doc; sync `PLAN.md` and `TODO.md`.
- [x] Final integrated review passes; stop for user approval.

Status: COMPLETE on `jeff-cx/phase-4-anime-detail`; awaiting user review before integration.
