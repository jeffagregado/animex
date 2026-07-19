# Agent Improvements

## Audit Target

AnimeX React maintainability instructions, 2026-07-19.

## Files Inspected

- `AGENTS.md`
- `src/routes/_public/home.tsx`
- `src/routes/_public/-home.test.tsx`

## Findings

- Evidence: user reported ignored one-component rule after React Doctor found two `no-multi-comp` warnings in `home.tsx`; active `AGENTS.md` allows one main component plus 1–3 small local helpers.
  Problem: written helper allowance permits the exact three-component shape that React Doctor flags, while user expects stricter separation.
  Improvement: clarify whether one component per file is absolute or whether small private helpers remain allowed below React Doctor's threshold.
  Proposed edits: `AGENTS.md`.
  Status: proposed.

## Validation

- Static `HomeRouteCanonicalizing` moved into one focused component file; route hooks and pending behavior remain in `home.tsx`.
- Focused Home route tests, TypeScript, production build, Fallow, and responsive browser QA pass.
- React Doctor `no-multi-comp` findings: 2 before, 0 after.
- No source instruction edit made; user approval required.
