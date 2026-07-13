# Task 2 Backend Report

Status: DONE

## Changed Files

- `convex/schema.ts`: indexed Posts, images, Reviews, feed projections, follow read model, Review aggregates.
- `convex/users.ts`: optional authenticated viewer profile helper.
- `convex/posts.ts`: authenticated upload claims, metadata checks, owned attachment lifecycle, projection sync.
- `convex/reviews.ts`: Draft/Publish lifecycle, shared document validation, visibility, metrics, sorting, deletion.
- `convex/feed.ts`: Global/Home/Following reads, source hydration, composite cursors, milestone activity operations/backfill.
- `convex/socialPolicy.ts`, `convex/feedPolicy.ts`: pure visibility, upload, aggregate, ordering, cursor policy.
- `convex/userAnime.ts`: atomic Completed/Rewatched feed projection create, bump, rollback, suppression.
- Focused sibling tests: policy, Convex social integration, milestone projection integration.

## RED Evidence

- `pnpm test -- convex/socialPolicy.test.ts convex/feedPolicy.test.ts`
  - Failed: missing `socialPolicy` and `feedPolicy` modules.
- `pnpm test -- convex/social.integration.test.ts`
  - Failed: missing `reviews` and `posts` Convex modules.
- Request-ID tracer failed with `assertRequestId is not a function` before implementation.

## GREEN Evidence

- Focused backend tests: 4 files, 12 tests passed.
- `pnpm test`: 50 files passed, 2 skipped; 380 tests passed, 3 skipped.
- `pnpm exec tsc --noEmit`: exit 0.
- `pnpm exec convex dev --once --codegen disable --typecheck enable`: functions ready; exit 0.
- `pnpm exec fallow audit --base HEAD --gate new-only --format json --quiet`: PASS; zero introduced dead code, complexity, or duplication.
- Forbidden-pattern scan: no action, table `.filter`, or unbounded `.collect` in new backend modules.
- `git diff --check`: exit 0.

## Self-review

- All public mutations derive owner from `requireProfile`; no client user IDs.
- Followers/private content remains author-only in Phase 5.
- Shared Review validators and 2:1 merge helper are imported, not copied.
- Feed and Review reads use compound indexes and bounded reads.
- Source rows remain authoritative; projection edits do not bump settled timestamps.

## Concerns

- Generated Convex API files intentionally excluded; controller integration must regenerate once all workers finish.
- `convex-test` lacks `storageGetMetadata`; upload metadata policy is pure-tested and live bundle/push passed, but real registration syscall was not invoked by integration test.
- Controller-owned one-line shared validator compatibility fix was required for Convex typecheck and is excluded from this commit.
