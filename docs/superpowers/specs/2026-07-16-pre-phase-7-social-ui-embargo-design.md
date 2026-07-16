# Pre-Phase 7 Social UI Embargo Design

Status: DESIGN APPROVED. Written spec reviewed and approved. Detailed implementation plan is awaiting review.

## Goal

Remove active social interaction UI before Phase 7 without deleting social storage, authorization, or backend contracts needed by Phase 9.

## Approach

Use active UI contraction:

- Remove social branches from active client render and navigation.
- Normalize stale social URL state at route boundaries.
- Keep Convex schemas, validators, queries, mutations, authorization, and stored values.
- Do not add global feature flag.
- Reintroduce functional social UI deliberately in Phase 9.

## UI Removed From DOM

- Following feed tab, empty state, and active client query path.
- Feed-card Like and Comment controls.
- Review Like control.
- Follow and Unfollow controls.
- Follower and following counts.
- Comment, Comment Reply, Reply Tag, and Comment Like surfaces.
- Social counts and activity footers.
- Followers-only choices in creation, editing, owner actions, Review discovery, and privacy UI.
- Disabled or phase-labeled social placeholders.
- Followers visibility badges, labels, and selected markers.

No CSS-only hiding. No disabled replacements.

## UI Retained

- Home and Global feed views.
- Post and Review creation.
- Post and Review editing.
- Public and Private visibility choices.
- Owner edit, visibility-change, activity-removal, and deletion actions.
- Public content browsing.
- Owner-readable legacy Followers-only content.

Private visibility labels remain visible. Followers visibility labels do not.

## Route Canonicalization

| Input | Result | History |
| --- | --- | --- |
| `/home?feed=following` | `/home`, Home feed | Replace |
| `/reviews?visibility=followers`, signed in | `/reviews` with `All` default | Replace |
| `/reviews?visibility=followers`, signed out | `/reviews` with `Public` default | Replace |

Canonicalization happens before affected feed or discovery query starts. Hidden Following or Followers-filter queries must not run.

## Visibility Rules

### New Content

Active client visibility type contains `public | private`.

| Stored account default | Effective new-content default |
| --- | --- |
| `public` | `public` |
| `private` | `private` |
| `followers` | `private` |

Mapping changes new-content default only. Stored account value remains untouched.

### Existing Followers-Only Content

- Remains stored as `followers`.
- Remains owner-only under current authorization policy.
- Remains discoverable by owner in Home and signed-in `All` Review discovery.
- Shows no Followers badge, label, or selected state.
- Direct owner detail links remain available.
- Unrelated content edits preserve `followers`.
- Owner may explicitly change visibility to Public or Private.
- No automatic migration or silent rewrite.

Legacy editor behavior:

- Keep original three-state visibility internally.
- Show `Change visibility` when original visibility is `followers`.
- Offer Public and Private only.
- No selection preserves original Followers visibility.
- Explicit selection sends chosen Public or Private value.

Owner action menus follow same rule. Legacy Followers content shows Public and Private actions without current-state marker.

## Client Boundaries

### Feed

Primary files:

- `src/features/feed/feed-page.tsx`
- `src/features/feed/feed-card.tsx`
- `src/features/feed/feed-list.tsx`
- `src/features/feed/use-feed-pages.ts`
- `src/routes/_public/home.tsx`

Client feed view contracts become Home or Global only. `convex/feed.ts:listFollowing` remains unchanged and receives no active client call.

### Visibility

Create one typed client embargo policy near existing social visibility code:

- Active visibility options.
- Effective creation-default mapping.
- Legacy edit resolution.
- Followers-label suppression.

Do not narrow shared backend `Visibility` contracts. Client UI types may exclude `followers`.

Primary consumers:

- Post composer.
- Review editor.
- Feed owner actions.
- Review detail owner actions.
- Review discovery filters and URL state.
- Published Review visibility badge.

### Review Discovery

Visible filter choices:

- All for signed-in users.
- Public.
- Private for signed-in users.

Followers choice stays absent. Signed-in All may include owner legacy Followers records through preserved backend lanes.

## Data Flow

### New Post Or Review

1. Public auth context supplies stored account visibility.
2. Client embargo policy maps `followers` to `private`.
3. Composer/editor displays Public and Private.
4. Existing validation runs.
5. Existing Convex mutation receives selected value.
6. Mutation error uses current explicit error/toast path.

### Legacy Edit

1. Existing query returns stored `followers`.
2. Editor keeps original value internally.
3. UI shows no Followers label.
4. No visibility selection preserves original value.
5. Public or Private selection replaces original value.
6. Existing mutation remains backend authority.

### Stale URL

1. Route parses legacy search value.
2. Route or feature boundary resolves canonical allowed value.
3. Router replace navigation removes stale query.
4. Query starts only with canonical Home, All, or Public state.

## Error Handling

- Route normalization failures surface through existing route error handling.
- Visibility mutation failures keep current explicit toast/error behavior.
- Missing auth state blocks auth-dependent Review normalization until auth resolves.
- No silent fallback to Followers.
- No automatic record migration.
- No catch-all suppression.

## Backend Preservation

Keep unchanged unless implementation evidence proves a required compatibility fix:

- Convex schemas and generated contracts.
- `followers` validators.
- Following query.
- Visibility mutations.
- Review discovery Followers lane.
- Owner-only Followers read policy.
- Existing integration coverage for Followers records.

No Convex push required when implementation changes only client files.

## Validation

### Focused Behavior Checks

- Following tab absent for signed-in users.
- `/home?feed=following` becomes `/home` through replace navigation.
- No Following query runs.
- Feed cards contain no Like, Comment, or social footer DOM.
- Review detail contains no Like control.
- Public/Private are only visible creation and owner-action choices.
- Stored Followers account default produces Private new-content default.
- Legacy edit without visibility selection preserves Followers.
- Explicit Public/Private migration succeeds.
- Followers badge and label remain absent.
- Legacy owner content remains discoverable in Home and signed-in All.
- Followers Review filter remains absent.
- Direct Followers filter URL canonicalizes by auth state before query.

### Full Gates

- Focused Vitest files.
- Full `pnpm test`.
- `pnpm exec tsc --noEmit`.
- `pnpm run generate-routes`.
- Client and SSR build through `pnpm build`.
- React Doctor changed-scope regression check.
- Fallow changed-code audit with resolved comparison base.
- `git diff --check`.

### Browser QA

Cover signed-in and signed-out desktop/mobile:

- Home and Global tabs.
- Direct stale Home and Review URLs.
- Post and Review creation.
- Legacy Followers record discovery.
- Legacy edit preservation.
- Explicit Public/Private migration.
- Keyboard and focus behavior.
- Console and failed-network requests.
- Responsive overflow and touch targets.

Use real app behavior. No mock-only browser acceptance.

## Documentation

Implementation closure updates:

- `TODO.md`.
- `PLAN.md` if phase routing changes.
- `CONTEXT.md` for temporary signed-out/social visibility semantics.
- `docs/superpowers/specs/2026-07-16-phase-7-9-feature-sequencing.md`.
- `design-qa.md`.

No ADR. No separate data-flow document.

## Non-Goals

- No Phase 7 User Profile or Quick Search work.
- No Phase 8 notifications, privacy settings, reports, moderation, or Block work.
- No Phase 9 social functionality.
- No schema migration.
- No data migration.
- No production dependency.
- No visual redesign or generated asset.
- No deployment.

## Acceptance

- Social interaction UI absent from DOM.
- Followers choices and labels absent from active UI.
- Stale social URLs canonicalized with replace navigation.
- New content cannot silently use stored Followers default.
- Legacy Followers records remain intact, owner-readable, discoverable, editable, and explicitly convertible.
- Backend social contracts remain ready for Phase 9.
- Required automated and browser gates pass.

## Planning Boundary

Written-spec review is complete. Source implementation remains unauthorized until the detailed plan is approved.
