# Phase 2 Formal Closure Validation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `orchestrating-coding-work` with read-only role boundaries. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revalidate Phase 2 auth behavior, implementation quality, runtime flows, and closure evidence before formal acceptance.

**Architecture:** Run independent read-only audits for requirement coverage, security/edge cases, maintainability, and command validation. Controller integrates findings, runs browser checks against completed app state, and closes Phase 2 only when no blocking gap remains.

**Tech Stack:** TanStack Start, React 19, Better Auth, Convex, TanStack Form, Zod, Vitest, Fallow, Vite.

**Status:** Complete. Phase 2 closed on `dev` at commit `f7e0c58`.

## Global Constraints

- No application edits during audit.
- No dependency, schema, generated-file, environment, or remote deployment changes.
- Findings require file-and-line or command evidence.
- Phase 2 closure requires fresh typecheck, test, build, Fallow, browser, responsive, and console evidence.
- Blocking findings keep closure open and become scoped follow-up tasks.

---

### Task 1: Scope And Requirement Trace

**Files:**
- Read: `PLAN.md`
- Read: `TODO.md`
- Read: `CONTEXT.md`
- Read: `src/features/auth/**`
- Read: `src/routes/auth/**`
- Read: `src/routes/api/auth/**`
- Read: `src/routes/api/profile/**`
- Read: `convex/auth*.ts`
- Read: `convex/authEmails.ts`
- Read: `convex/passwordResets.ts`
- Read: `convex/users.ts`

- [x] Trace every Phase 2 requirement to concrete implementation or test evidence.
- [x] Report missing, partial, contradictory, or stale requirements with priority and file lines.

### Task 2: Security And Edge-Case Review

**Files:**
- Read: Phase 2 auth files and tests from Task 1.

- [x] Review auth-state transitions, verification, username uniqueness, OAuth completion, reset links, redirect safety, request validation, rate limits, email disclosure, and private-surface guards.
- [x] Report only actionable gaps with smallest acceptable fix.

### Task 3: Maintainability And Framework Review

**Files:**
- Read: `src/features/auth/**`
- Read: `src/routes/auth/**`
- Read: `src/lib/auth-*.ts`
- Read: `src/lib/server-auth-proxy.ts`
- Read: `convex/auth*.ts`
- Read: `convex/users.ts`

- [x] Check TanStack Start server/client boundaries, SSR safety, explicit errors, types, duplication, component size, shared helpers, and wrong-layer logic.
- [x] Return findings-first thermo verdict.

### Task 4: Fresh Automated Validation

**Files:**
- Read only: repository source, tests, config, and generated outputs.

- [x] Run `pnpm exec tsc --noEmit` and record exit code.
- [x] Run `pnpm test` and record test counts.
- [x] Run `pnpm build` and record exit code plus warnings.
- [x] Run `pnpm exec fallow audit --format json --quiet --gate all` and record verdict/findings.
- [x] Run `git diff --check` and confirm audit caused no source changes.

### Task 5: Browser And Console QA

**Files:**
- Read only: running local application.

- [x] Start app using existing project script.
- [x] Check sign-in, sign-up, forgot-password, reset-password missing-token, verify-email, username completion, and signed-out home behavior.
- [x] Check desktop and mobile layouts, keyboard-visible controls, console errors, failed network requests, and SSR response health.

### Task 6: Closure Decision

**Files:**
- Modify only after PASS: `TODO.md`
- Modify only after PASS: `PLAN.md`

- [x] Integrate agent evidence and controller checks.
- [x] Resolve Phase 2 P1/P2 findings and the reproduced malformed verification-email route failure before closure.
- [x] Mark formal Phase 2 closure after every required gate passed; list residual P3 risks explicitly.
