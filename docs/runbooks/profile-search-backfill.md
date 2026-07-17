# Profile Search Backfill

Owner: controller. Run after additive schema/functions deploy. Never narrow
`users.profileVisibility` before verification returns zero mismatches.

## Deploy Additive State

```powershell
pnpm exec convex dev --once
```

Confirm `profileVisibility` remains optional and `userSearchDocuments` plus
`search_users` exist.

## Backfill

Start:

```powershell
pnpm exec convex run userSearch:backfillProfiles '{"paginationOpts":{"numItems":100,"cursor":null}}'
```

Repeat with the exact returned `continueCursor` until `isDone` is `true`.
Record aggregate `processedCount`, `visibilityPatchedCount`, and
`searchUpsertedCount`. Do not record user IDs.

Stop on any error. `USER_SEARCH_CORRUPT` means one user has multiple search
documents. Investigate before retrying. Do not delete an arbitrary row.

## Verify

Start:

```powershell
pnpm exec convex run userSearch:verifyProfiles '{"paginationOpts":{"numItems":100,"cursor":null}}'
```

Repeat with the exact returned `continueCursor` until `isDone` is `true`.
Every page must have empty:

- `missingVisibilityIds`
- `missingSearchIds`
- `duplicateSearchUserIds`
- `mismatchedSearchUserIds`

Stop if any list is non-empty. Fix the exact mismatch, restart verification
from a null cursor, and require zero mismatches on every page.

## Narrow

Only after complete zero-mismatch verification:

1. Make only `users.profileVisibility` required.
2. Keep `bio` and `bannerStorageId` optional.
3. Deploy and type-check.

```powershell
pnpm exec convex dev --once
pnpm exec tsc --noEmit
```

Keep the projection and migrated visibility values during rollback. Revert
readers or entry points instead of deleting additive data.
