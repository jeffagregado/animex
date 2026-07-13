# Feed Milestone Backfill

Dev-only runbook. Projects authoritative `animeMilestones` into `feedCards`. Mutation idempotent. Removed activity stays inactive.

## Run

Push current Convex code:

```powershell
pnpm exec convex dev --once
```

Start with null cursor:

```powershell
pnpm exec convex run feed:projectMilestones '{"paginationOpts":{"numItems":100,"cursor":null}}'
```

Expected shape:

```json
{
  "continueCursor": "...",
  "isDone": false,
  "processedCount": 100,
  "verifiedCount": 100
}
```

Repeat with exact returned `continueCursor`:

```powershell
pnpm exec convex run feed:projectMilestones '{"paginationOpts":{"numItems":100,"cursor":"PASTE_RETURNED_CURSOR"}}'
```

Stop only when `isDone` is `true`.

## Validate Counts

For every response, require `processedCount === verifiedCount`. Sum both fields across all calls. Final totals must match. This total is exact `animeMilestones` source count traversed by cursor.

Do not mutate milestones during run. If data changed, restart from null cursor and recompute totals. Any missing or mismatched projection fails transaction with `MILESTONE_PROJECTION_INVALID`; fix cause, then retry same cursor.
