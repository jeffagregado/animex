# Phase 2 Auth Closure Fix

## Goal

Close all Phase 2 P1/P2 auth blockers and directly touched P3 cleanup. Preserve settled AnimeX auth UX. Add no production dependency.

## Task 1: Shared Auth Contracts

- Add typed Better Fetch result/error handling. Caller success requires `data` and no `error`.
- Add stable auth error codes and settled user copy.
- Make `/api/profile/state` return discriminated `signedOut`, `emailUnverified`, `needsProfile`, or `complete` states. `needsProfile` includes signup method. `complete` includes typed profile and owned avatar URL.
- Centralize `returnTo`: allow one leading slash; preserve path, query, hash; reject protocol-relative, backslash, credentials, external origin, and `/auth/*`. Missing target goes Home. Invalid/unavailable target shows `This content is unavailable.`
- Remove unchecked auth-state and generic route casts touched by this work.
- TDD: failing contract/error/return tests first, then minimum implementation.

## Task 2: Durable Auth Security

- Add Convex `authRateLimits`, `otpSendLimits`, and `pendingOauthSignups` tables plus indexes. Add user avatar storage ID and password-reset expiry index.
- Implement atomic Better Auth `customStorage`; do not use adapter database rate-limit storage.
- Limits: sign-in/signup/OAuth 3 per IP/path per 10 seconds; reset 3 per 60 seconds with generic response; OTP endpoint 5 per 60 seconds; successful subject send cooldown 60 seconds.
- Hash email/account limiter subjects. Failed sends release subject cooldown.
- Resend: inspect `{ data, error }`; retry only 429/5xx; three attempts total; delays 500ms then 1000ms; stable idempotency keys; 400/422 fail immediately.
- Keep password reset session revocation independent from security-notice delivery. Queue notice internally and log final failure.
- Reset eligible only for completed profile or credential account. Pending OAuth receives generic response and no token/email.
- TDD each policy and error path before production changes.

## Task 3: OAuth Lifecycle And Owned Avatars

- Disable implicit email linking.
- Require Google verified email before identity persistence. Missing/unverified email uses `Google sign-in couldn’t continue. Try another sign-in method.`
- Existing email conflict uses `Email already in use. Sign in instead.` No auto-link or duplicate identity.
- Track fresh OAuth identity as pending. Resume by provider account ID. Remove pending row atomically after profile completion.
- Weekly cleanup Sunday 03:00 UTC. Remove only no-profile identities with no active session and last session expiry older than 24 hours. Use lease, bounded pagination, eligibility recheck, idempotent delete, and explicit logs.
- Import Google avatar into Convex storage during profile completion. HTTPS and approved Google host only; validate every redirect; timeout; 5 MiB maximum; JPEG/PNG/WebP signatures. Never persist provider hotlink. On approved non-critical import failure, log and use initials avatar.
- Widen schema, deploy, backfill pending rows and legacy avatars, verify, then remove legacy avatar field.

## Task 4: Password, OTP, Reset, And OAuth UX

- Password signup creates signed-in unverified identity. Verification leads to username completion.
- Unverified password sign-in resumes verification.
- Verification page reads authoritative email from auth state; malformed query cannot crash or override it.
- Email correction sends one OTP to corrected email. Valid code updates identity, verifies it, and proceeds directly to username. No second OTP.
- OTP copy: `Verification code is invalid.`, `Verification code expired. Request a new code.`, `Too many incorrect codes. Request a new code.`, and `Verification email couldn’t be sent. Try again.`
- Reset request always says `If an account exists, reset instructions were sent.` Reset email includes 30-minute preheader, button, and visible raw URL. Success revokes all sessions and returns to sign-in. Security notice says password was reset.
- Google callback routes linked users Home/valid return, pending users username completion, and conflict/provider failures to settled messages.
- Remove unused reset-token check route and regenerate route tree.

## Task 5: QA And Closure

- Run Convex generation/deploy, TypeScript, Vitest, build, Fallow, diff, and status gates.
- Browser QA at 390, 768, and 1280 px. Check keyboard, focus, loading/error states, console, and network.
- Resend sandbox: unique `delivered+animex-p2-<flow>-<runid>@resend.dev` labels. Inspect Preview/CLI subject, status, events, preheader, fallback URL, and settled copy. Record no OTP, token, key, body, or request payload.
- Live Google sequence uses exact dev identity `jeffagregado@gmail.com`: password flow; OAuth conflict; exact AnimeX identity cleanup; fresh OAuth pending/completion/avatar; returning OAuth; final exact AnimeX cleanup. Never delete Google/Resend account or OAuth grant.
- Close every P1/P2 and touched P3 TODO only after evidence passes.
- Final handoff summarizes current signup, OTP, email correction, sign-in, reset, OAuth, profile, guard, redirect, sign-out, limit, and error UX. State sandbox-only email-delivery limitation.

## Orchestration

- Controller owns shared contracts, integration, migrations, deploy, and final state.
- Worker owns only assigned files; test-first; no dependency, generated-file, unrelated, or TODO edits unless assigned.
- Reviewer runs spec and thermo review after each worker slice.
- QA runs after integration. Production edits serialize when contracts/files overlap.
