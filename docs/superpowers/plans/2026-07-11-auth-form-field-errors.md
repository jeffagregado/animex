# Auth Form Field Errors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` and `superpowers:test-driven-development`. Steps use checkbox syntax for tracking.

**Goal:** Add accessible, field-level validation and safe server-error mapping across AnimeX auth forms.

**Architecture:** TanStack Form owns validation timing and field metadata. Existing Zod schemas remain validation and transformation source of truth. Shared auth helpers own presentation, focus, and explicit server-code classification; pages own workflow intent and API calls.

**Tech Stack:** React, TanStack Form, Zod Standard Schema, Vitest, Testing Library, CSS.

**Status:** Complete. Focused and full validation, mandatory review, and responsive browser QA passed. Task checklists below remain implementation procedure, not open work.

## Global Constraints

- Blur validates initially; change validates only after submission.
- Submit shows every invalid field and focuses first editable invalid field.
- Blur/change validation never moves focus.
- Render first error per field with `aria-invalid` and `aria-describedby`.
- Form failures use `role="alert"`; success and instructions use `role="status"`.
- Map only explicit safe codes/statuses: email conflict to `email` or `newEmail`; invalid, expired, or attempt-limited OTP to `otp`; unavailable or taken username to `username`.
- Rate-limit, credentials, network, session/auth-state, and unknown failures remain form-level.
- Editing a field clears its mapped server error.
- Explicitly parse each successful value with its Zod schema before API calls so transformed email output is preserved.
- Keep `confirmPassword` schema path.
- Email-change send validates `newEmail`; confirm validates `newEmail` and `otp`.
- Read-only email and background username checks never receive or steal focus.
- No dependencies, backend, Convex, generated files, routes, Resend, OAuth, policy, redirect, security-copy, or redesign changes.
- Preserve every unrelated dirty hunk.

---

### Task 1: Failing Auth Integration Specification

**Files:**
- Create: `src/features/auth/auth-field-errors.test.tsx`
- Modify only if test harness requires: `src/features/auth/auth-pages.test.tsx`

**Interfaces:**
- Consumes existing auth pages and user-visible DOM.
- Produces regression coverage for validation timing, all-field submit errors, focus order, ARIA links, safe server mapping and clearing, notice roles, read-only email, `confirmPassword`, and transformed email API values.

- [ ] Write user-visible integration tests for each required behavior.
- [ ] Run `pnpm test src/features/auth/auth-field-errors.test.tsx`.
- [ ] Confirm failures describe missing field-error behavior, not setup defects.

### Task 2: Shared Validation And Presentation Contract

**Files:**
- Modify: `src/features/auth/auth-form.ts`
- Modify: `src/features/auth/auth-page-shell.tsx`
- Modify: `src/features/auth/password-field.tsx`
- Modify: `src/features/auth/username-field.tsx`
- Modify: `src/features/auth/auth-actions.ts`
- Modify: `src/features/auth/profile-actions.ts`
- Modify: `src/features/auth/auth.css`
- Modify only if required: `src/lib/auth-schemas.ts`

**Interfaces:**
- Produces typed field-error, notice, focus, and explicit error-classification helpers used by all auth pages.
- Field inputs receive one displayed error, stable description ID, invalid state, and mapped-error clearing callback.

- [ ] Add minimal typed helpers needed by failing tests.
- [ ] Keep error classification based on explicit codes/statuses; never unknown-message substrings.
- [ ] Add shared accessible field-error and notice presentation.
- [ ] Add invalid-state styles without visual redesign.
- [ ] Run focused auth integration tests and confirm shared-contract cases pass.
- [ ] Release shared-contract lock after controller inspection.

### Task 3: Standard Auth Pages

**Files:**
- Modify: `src/features/auth/sign-in-page.tsx`
- Modify: `src/features/auth/sign-up-page.tsx`
- Modify: `src/features/auth/forgot-password-page.tsx`
- Modify: `src/features/auth/reset-password-page.tsx`

**Interfaces:**
- Consumes Task 2 shared contract.
- Produces schema-driven field errors, submit focus, mapped-server clearing, and transformed API values for standard forms.

- [ ] Configure `revalidateLogic` and form-level Zod validators on each form.
- [ ] Parse valid submissions with same Zod schema before API calls.
- [ ] Wire first field error, ARIA state, mapped server errors, and edit clearing.
- [ ] Preserve submit, redirect, copy, and native POST behavior.
- [ ] Run focused integration and existing auth-page tests.

### Task 4: Verification And Username Pages

**Files:**
- Modify: `src/features/auth/verify-email-page.tsx`
- Modify: `src/features/auth/username-page.tsx`

**Interfaces:**
- Consumes Task 2 shared contract.
- Produces intent-aware email-change validation and authoritative username-submit errors without background focus changes.

- [ ] Configure verification and username forms with required validation timing.
- [ ] Keep Send code validation limited to `newEmail`.
- [ ] Validate `newEmail` plus `otp` for Confirm.
- [ ] Exclude read-only email from invalid focus.
- [ ] Keep background username availability informational; map authoritative submit failures only.
- [ ] Run focused integration and existing auth-page tests.

### Task 5: Integration, Review, QA, Current-State Docs

**Files:**
- Modify after QA only: `TODO.md`
- Modify as execution tracker: this plan.

- [ ] Run focused integration tests and existing auth tests.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm exec tsc --noEmit`.
- [ ] Run `pnpm build`.
- [ ] Run Fallow and inspect findings.
- [ ] Run `git diff --check` and scoped diff review.
- [ ] Run findings-first spec review and mandatory auth thermo review.
- [ ] Browser QA at 390, 768, and 1280 widths: blur/change timing, mouse and keyboard submit, focus order and no stealing, inline versus form errors, ARIA, console, and network.
- [ ] Update TODO current state only after QA passes.

## Ownership And Locks

- Controller: plan, TODO, integration test, integration, final state.
- Shared worker: Task 2 files; lock blocks page workers until release.
- Standard worker: Task 3 files after lock release.
- Complex worker: Task 4 files after lock release.
- Reviewer: read-only findings-first spec and thermo reviews.
- QA: read-only commands and browser evidence.
- Docs mapper: plan/TODO current-state updates only after QA.

## Rollback And Deployment

- Rollback only scoped frontend/test/doc hunks from this task; preserve Phase 2 closure work.
- No deployment or Convex push expected because backend and Convex are forbidden.
- Image generation not applicable: accessibility behavior change, no visual redesign or missing asset.
