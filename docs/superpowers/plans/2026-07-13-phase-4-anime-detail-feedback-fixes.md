# Phase 4 Anime Detail Feedback Fixes

Status: COMPLETE. Implementation, review, automated gates, and hover-focused browser QA passed.

## Goal

Match canonical Staff desktop shell. Preserve approved tabs and data flow. Fix public auth gates. Autosave Status and Score with explicit feedback.

## Locked Behavior

- Canonical desktop reference owns taller image-led banner, lower-gradient poster/title/meta/controls, compact sidebar, spacing, and hover theme.
- Public users see redirect facades for Status, Score, and Favorite. Unresolved auth shows disabled facades. Real Select, NumberField, private query, and mutation stay unmounted in public/unresolved modes.
- Write Review stays Phase 5. Rewatch History stays owner-only.
- Score range stays 0 to 10. Step is 0.5. Clear saves null.
- Status and Score use 500 ms trailing debounce. Blur or Enter flushes valid pending value.
- Favorite saves immediately. Sonner confirms success and shows errors with Retry.
- Sonner is sole new production dependency. No `next-themes` or Radix additions.

## Data Flow

- Entry: Anime Detail route loads shared shell and user-control boundary.
- Input: AniList ID plus optional signed-in Status, Score, Favorite, or Rewatch action.
- Validation: Zod contracts enforce ID, status, score range, and nullable score before mutation; Base UI NumberField enforces 0.5 UI steps.
- Transform: UI maps public auth state to redirect/disabled facades; signed-in values map to Convex mutation inputs.
- Storage: Convex stores user anime state and rewatch entries; AniList detail stays in server/cache flow.
- External calls: TanStack Start server transport fetches AniList; Convex handles private reads/writes.
- Retry: Sonner Retry re-invokes failed user mutation and reports another failure.
- Error: explicit auth, validation, upstream, or mutation error; no silent fallback.
- Output: updated control state plus Sonner success/error feedback; public mode remains facade-only.
- Owner: route/shell owns layout; controls worker owns auth gates/autosave; Convex owns persistence; controller/reviewer/QA own final validation.

## Tasks

- [x] Add RED/GREEN behavior tests for public facades, autosave, score stepping, notifications, and shell structure.
- [x] Rebuild taller image-led hero and compact sidebar from canonical reference.
- [x] Build auth-mode controls, Base UI NumberField, and root Toaster.
- [x] Update layout consistency spec and tracker.
- [x] Run focused tests, full suite, TypeScript, build, Fallow, diff check, review, and hover-focused browser QA.
