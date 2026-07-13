# Task 1 Contracts Report

Status: DONE

## Changed Files

- `src/features/social/shared/social-contracts.ts`: constants, strict exported DTO/input schemas, exact Review sorts, generic cursor page.
- `src/features/social/shared/review-document.ts`: Lexical JSON allowlist, security/size validation, provider derivation, rating stats.
- `src/features/social/shared/feed-ranking.ts`: stable 2:1 merge, dedupe, fill, cursor-safe consumed counts.
- Sibling focused tests: 22 contract, boundary, and security checks.

## RED Evidence

- `pnpm test -- src/features/social/shared`
- Result before production files: 3 failed suites. Missing `social-contracts`, `review-document`, and `feed-ranking` modules.
- Review-fix RED: 5 focused failures for sorts, cursor page, exported schemas, Lexical alignment/indent, and invisible publish text.

## GREEN Evidence

- `pnpm test -- src/features/social/shared`: 3 files passed, 22 tests passed.
- `pnpm exec tsc --noEmit`: exit 0.
- `git diff --check`: exit 0.

## Risks

- Shared contracts only. Backend/UI integration remains controller-owned.
- `followers` remains data visibility value only. No public-read equivalence encoded.
