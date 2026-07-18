# Task 6 Report

Status: DONE

## Scope

- Added owner-only Profile media upload registration, finalization, removal, retry, and cleanup lifecycle.
- Added static WebP parser for VP8, VP8L, VP8X, exact dimensions, 2 MiB limit, and animation rejection.
- Added daily 03:15 UTC expired-upload cleanup using typed function references and `by_expiry` pagination.
- Kept `convex/profiles.ts`, schema, generated files, dependency files, routes, and parallel work untouched.

## TDD Evidence

RED:

```text
pnpm test -- convex/profileMediaPolicy.test.ts convex/profileMedia.integration.test.ts
2 failed files; policy module missing; 9 integration tests failed because profileMedia module missing.
```

GREEN:

```text
pnpm test -- convex/profileMediaPolicy.test.ts convex/profileMedia.integration.test.ts
2 files passed; 17 tests passed.
```

Integrated Profile validation:

```text
pnpm test -- convex/profileMediaPolicy.test.ts convex/profileMedia.integration.test.ts convex/profileEdit.integration.test.ts convex/profile.integration.test.ts
4 files passed; 29 tests passed.
```

Type check:

```text
pnpm exec tsc --noEmit
PASS.
```

## Review Fix

RED:

```text
pnpm test -- convex/profileMediaPolicy.test.ts
2 failed, 4 passed. Real static alpha VP8X+ALPH+VP8 rejected as duplicate header; bare VP8X incorrectly accepted.
```

GREEN:

- Accepts real encoded 512x512 static alpha extended WebP.
- Requires exactly one VP8/VP8L image-data chunk and matching VP8X canvas.
- Rejects missing/duplicate/mismatched headers, ANIM/ANMF, animation flag, malformed sizes, padding, and RIFF bounds.
- Covers cleanup continuation beyond 50 rows and cleanup-failure original category.

## Notes

- `convex dev --once` and codegen intentionally deferred to Task 15.
- All Task 6 source/test files remain below 500 lines.
