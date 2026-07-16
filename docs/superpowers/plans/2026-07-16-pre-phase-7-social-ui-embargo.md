# Pre-Phase 7 Social UI Embargo Implementation Plan

Status: SELF-REVIEWED. User approval pending; source implementation has not started.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use the repo-local `$orchestrating-coding-work` custom role agents from `.codex/agents/`; do not use generic bootstrap agents.

**Goal:** Remove every active social-interaction and Followers-only UI surface before Phase 7 while preserving backend social contracts and owner access to legacy Followers-only records.

**Architecture:** Add one typed client visibility policy in `src/features/social/visibility.ts`. Active UI consumes only Public/Private choices; legacy Followers values remain in shared wire contracts and are represented as a null client selection during edits. Home and Review discovery routes accept stale legacy search values only long enough to replace them with canonical URLs before hidden queries mount. Convex schemas, validators, queries, mutations, and stored records remain unchanged.

**Tech Stack:** TanStack Start, TanStack Router, React 19, TypeScript 6, Tailwind CSS v4, Base UI, Convex client, Vitest, Testing Library, React Doctor, Fallow, in-app browser QA.

## Global Constraints

- Accepted design: `docs/superpowers/specs/2026-07-16-pre-phase-7-social-ui-embargo-design.md`.
- Remove social UI from the DOM. Do not CSS-hide it and do not leave disabled placeholders.
- Active feed views: `home | global`.
- Active creation/edit visibility choices: `public | private`.
- Do not narrow `Visibility` in `src/features/social/shared/social-contracts.ts`.
- New content maps a stored Followers account default to Private.
- Existing Followers-only content stays stored as `followers`.
- Unrelated edits to legacy Followers content preserve `followers`.
- Explicit owner selection may migrate legacy content to Public or Private.
- Followers badges, labels, filters, selected markers, and options stay absent.
- `/home?feed=following` resolves to Home and removes `feed=following` through replace navigation before any Following query can run.
- `/reviews?visibility=followers` removes the visibility query through replace navigation before discovery mounts; signed-in state becomes All, signed-out state becomes Public.
- Signed-in All discovery may continue to include owner-readable legacy Followers records through the preserved backend lane.
- Keep `convex/feed.ts:listFollowing`, Followers discovery lanes, validators, schemas, and authorization unchanged.
- No production dependency, image, schema, migration, data rewrite, global feature flag, ADR, or deployment.
- No `convex dev --once` unless implementation evidence forces a Convex edit; a client-only implementation skips it.
- Keep changes responsive, keyboard-accessible, and consistent with existing Base UI controls.
- Comparison baseline: `e8e9fd7cf171b8d2ac7109460399f311874d8bc5`.

## File Map

| Area | Files |
| --- | --- |
| Visibility policy | `src/features/social/visibility.ts`, new `src/features/social/visibility.test.ts` |
| Home route/feed | `src/routes/_public/home.tsx`, `src/routes/_public/-home.test.tsx`, `src/features/feed/feed-page.tsx`, `src/features/feed/use-feed-pages.ts`, `src/features/feed/feed-list.tsx`, `src/features/feed/feed-card.tsx`, `src/features/feed/feed-card-detail-page.tsx`, related tests |
| Post visibility | `src/features/feed/use-post-composer.ts`, `post-composer.tsx`, `post-composer-dialog.tsx`, `feed-owner-actions.tsx`, related tests |
| Review visibility | `src/features/reviews/ui/review-editor-page.tsx`, `review-detail-page.tsx`, `published-review-card.tsx`, related tests |
| Review discovery | `src/features/reviews/discovery/review-discovery-state.ts`, `review-discovery-page.tsx`, `review-discovery-filters.tsx`, route/page tests |
| Closure docs | `TODO.md`, `PLAN.md`, `CONTEXT.md`, `docs/superpowers/specs/2026-07-16-phase-7-9-feature-sequencing.md`, `design-qa.md` |

## Execution And Ownership

Controller-led orchestration:

1. Task 1 locks `src/features/social/visibility.ts`.
2. After Task 1 is green, Tasks 2-5 may use separate `orchestration_worker` agents because their write sets are disjoint.
3. Workers treat the visibility policy as read-only after Task 1.
4. The controller integrates once, runs full gates, then requests `orchestration_reviewer` and `orchestration_qa`.
5. One `orchestration_docs_mapper` verifies and updates closure docs after implementation evidence is final.

| Task | Exclusive write ownership |
| --- | --- |
| 1 | `src/features/social/visibility.ts`, `src/features/social/visibility.test.ts` |
| 2 | Home route, feed view/query/list/card/detail files and their tests |
| 3 | Post composer/dialog, feed owner actions, and their tests |
| 4 | Review editor/detail/published-card files and their tests |
| 5 | Review discovery state/page/filter files and their tests |
| 6 | Integration fixes and closure docs; no concurrent writers |

Serialized locks:

- `src/features/social/visibility.ts` and its test are Task 1 exclusive until the focused contract tests pass.
- Controller exclusively owns `src/routeTree.gen.ts`; workers do not edit generated routes.
- Controller or `orchestration_docs_mapper` exclusively owns `TODO.md`, `PLAN.md`, `CONTEXT.md`, the phase sequencing spec, `design-qa.md`, and `docs/architecture/review-discovery-data-flow.md`.
- Forbidden source writes without a separately approved scope expansion: `convex/**`, `src/features/auth/auth-contracts.ts`, `src/features/social/shared/social-contracts.ts`, and `src/features/reviews/shared/review-discovery-contracts.ts`.
- Forbidden tooling/config writes: `package.json`, `pnpm-lock.yaml`, `skills-lock.json`, `.fallowrc*`, `fallow.toml`, `tsconfig*.json`, `vite.config.*`, and other package/build configuration.
- If a forbidden file changes mechanically, stop integration, identify the cause, and restore or request approval before proceeding.

---

### Task 0: Preflight, Baseline, And Legacy Fixture

**Files:**

- Read-only: `package.json`, `pnpm-lock.yaml`, `skills-lock.json`
- No committed source or data changes

- [ ] **Step 1: Confirm repository baseline**

```powershell
git status --short
git rev-parse HEAD
```

Expected: clean implementation worktree; HEAD is based on `e8e9fd7cf171b8d2ac7109460399f311874d8bc5` plus approved planning commits.

- [ ] **Step 2: Restore declared tooling if required**

Fallow is already a committed dev dependency from the repository baseline. It is not a new dependency.

```powershell
pnpm install --frozen-lockfile
pnpm exec fallow --version
```

Expected: install does not change `package.json` or `pnpm-lock.yaml`; Fallow prints a version. If it remains unavailable, stop and report the exact failure. Do not install it globally, edit `skills-lock.json`, or add another package.

- [ ] **Step 3: Prepare one development-only legacy acceptance fixture**

Before removing Followers creation UI, identify or create through existing app behavior:

- One completed account whose stored default visibility is `followers`.
- One owner-readable Followers Post.
- One owner-readable Followers Review.

Record only non-secret fixture identifiers in the execution checkpoint. Do not commit credentials, tokens, or fixture data. If no safe development account is available, stop browser acceptance and request user access; automated implementation may continue, but closure cannot pass.

- [ ] **Step 4: Run baseline contract checks**

```powershell
pnpm exec vitest run convex/social.integration.test.ts src/features/social/shared/social-contracts.test.ts src/features/reviews/shared/review-discovery-contracts.test.ts
```

Expected: PASS before client contraction starts.

---

### Task 1: Lock The Client Visibility Policy

**Files:**

- Modify: `src/features/social/visibility.ts`
- Create: `src/features/social/visibility.test.ts`
- Read-only: `src/features/social/shared/social-contracts.ts`

**Contract:**

```ts
import type { Visibility } from './shared/social-contracts'

export const activeVisibilityOptions = ['public', 'private'] as const
export type ActiveVisibility = typeof activeVisibilityOptions[number]
export type VisibilitySelection = ActiveVisibility | null

const activeVisibilityLabels: Record<ActiveVisibility, string> = {
  private: 'Private',
  public: 'Public',
}

/** Returns a label for an active Public/Private choice. */
export function getActiveVisibilityLabel(visibility: ActiveVisibility): string {
  return activeVisibilityLabels[visibility]
}

/** Hides legacy Followers wording while retaining Public/Private labels. */
export function getVisibleVisibilityLabel(visibility: Visibility): string | null {
  return visibility === 'followers' ? null : getActiveVisibilityLabel(visibility)
}

/** Creates an active selection while preserving legacy records when requested. */
export function getVisibilitySelection(
  original: Visibility,
  preserveOriginal: boolean,
): VisibilitySelection {
  if (original !== 'followers') return original
  return preserveOriginal ? null : 'private'
}

/** Resolves a nullable legacy edit selection back to the wire contract. */
export function resolveVisibilitySelection(
  original: Visibility,
  selection: VisibilitySelection,
): Visibility {
  return selection ?? original
}
```

- [ ] **Step 1: Write the red policy tests**

Create `src/features/social/visibility.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  activeVisibilityOptions,
  getActiveVisibilityLabel,
  getVisibilitySelection,
  getVisibleVisibilityLabel,
  resolveVisibilitySelection,
} from './visibility'

describe('social visibility embargo policy', () => {
  it('exposes Public and Private only', () => {
    expect(activeVisibilityOptions).toEqual(['public', 'private'])
    expect(getActiveVisibilityLabel('public')).toBe('Public')
    expect(getActiveVisibilityLabel('private')).toBe('Private')
  })

  it('maps a Followers account default to Private for new content', () => {
    expect(getVisibilitySelection('followers', false)).toBe('private')
  })

  it('preserves legacy Followers content until the owner selects a replacement', () => {
    expect(getVisibilitySelection('followers', true)).toBeNull()
    expect(resolveVisibilitySelection('followers', null)).toBe('followers')
    expect(resolveVisibilitySelection('followers', 'public')).toBe('public')
    expect(resolveVisibilitySelection('followers', 'private')).toBe('private')
  })

  it('suppresses Followers labels', () => {
    expect(getVisibleVisibilityLabel('followers')).toBeNull()
    expect(getVisibleVisibilityLabel('public')).toBe('Public')
    expect(getVisibleVisibilityLabel('private')).toBe('Private')
  })
})
```

- [ ] **Step 2: Verify the red state**

Run:

```powershell
pnpm exec vitest run src/features/social/visibility.test.ts
```

Expected: FAIL because the embargo policy exports do not exist.

- [ ] **Step 3: Replace the generic label map with the typed policy**

Implement the contract above in `src/features/social/visibility.ts`. Do not edit shared visibility schemas or generated Convex contracts.

- [ ] **Step 4: Verify the contract**

Run:

```powershell
pnpm exec vitest run src/features/social/visibility.test.ts src/features/social/shared/social-contracts.test.ts
pnpm exec tsc --noEmit
```

Expected: both test files PASS; TypeScript exits `0`; shared `followers` parsing remains valid.

- [ ] **Step 5: Commit the shared client contract**

```powershell
git add -- src/features/social/visibility.ts src/features/social/visibility.test.ts
git commit -m "refactor: add social visibility embargo policy"
```

---

### Task 2: Contract Home Feed And Remove Feed Social Controls

**Files:**

- Modify: `src/routes/_public/home.tsx`
- Modify: `src/routes/_public/-home.test.tsx`
- Modify: `src/features/feed/feed-page.tsx`
- Modify: `src/features/feed/use-feed-pages.ts`
- Modify: `src/features/feed/feed-list.tsx`
- Modify: `src/features/feed/feed-card.tsx`
- Modify: `src/features/feed/feed-card-detail-page.tsx`
- Modify: `src/features/feed/feed-card.test.tsx`
- Modify: `src/features/feed/feed-list.test.tsx`
- Modify: `src/features/home/home-page.test.tsx`
- Verify: `src/features/feed/use-feed-pages.test.tsx`
- Verify: `src/features/feed/feed-card-detail-page.test.tsx`

**Interfaces:**

```ts
export type FeedView = 'home' | 'global'
export interface HomeFeedSearch {
  feed: FeedView
  compose: boolean
}

interface HomeRouteSearch {
  feed?: FeedView | 'following'
  compose?: boolean
}

interface ResolvedHomeSearch {
  state: HomeFeedSearch
  replace: boolean
}
```

- [ ] **Step 1: Rewrite route and feed tests to the embargo behavior**

In `src/routes/_public/-home.test.tsx`, replace the existing Following preservation test with a stale-route test that:

```tsx
const history = createMemoryHistory({ initialEntries: ['/home?feed=following'] })

render(<RouterProvider router={router} />)

expect(await screen.findByLabelText('Normalizing Home feed')).toBeTruthy()
expect(convex.query).not.toHaveBeenCalled()
await waitFor(() => expect(history.location.search).toBe(''))
expect(await screen.findByLabelText('Seasonal Anime loading')).toBeTruthy()
expect(screen.getByRole('tab', { name: 'home' }).getAttribute('aria-selected')).toBe('true')
expect(screen.queryByRole('tab', { name: 'following' })).toBeNull()
expect(
  convex.query.mock.calls
    .map((call) => getFunctionName(call[0]))
    .filter((name) => name.startsWith('feed:'))[0],
).toBe('feed:listHome')
expect(
  convex.query.mock.calls.some((call) => getFunctionName(call[0]) === 'feed:listFollowing'),
).toBe(false)
```

Then click Create Post and assert `compose=true` appears without restoring `feed=following`.

In `src/features/home/home-page.test.tsx`, change signed-in expectations to:

```tsx
expect(screen.getByRole('tab', { name: 'home' })).toBeTruthy()
expect(screen.getByRole('tab', { name: 'global' })).toBeTruthy()
expect(screen.queryByRole('tab', { name: 'following' })).toBeNull()
```

In `src/features/feed/feed-card.test.tsx`, replace the signed-in placeholder test with:

```tsx
render(<FeedCard card={card} onChanged={() => undefined} onEdit={() => undefined} owner={false} />)

expect(screen.queryByRole('button', { name: /Like/ })).toBeNull()
expect(screen.queryByRole('button', { name: /Comment/ })).toBeNull()
expect(document.querySelector('footer')).toBeNull()
```

Update `src/features/feed/feed-list.test.tsx` to remove the obsolete `signedIn` fixture prop and keep pagination coverage green.

- [ ] **Step 2: Verify the red state**

Run:

```powershell
pnpm exec vitest run src/routes/_public/-home.test.tsx src/features/home/home-page.test.tsx src/features/feed/feed-card.test.tsx
```

Expected: FAIL because Following remains active and feed social placeholders remain rendered.

- [ ] **Step 3: Add route parsing, active resolution, and canonical serialization**

In `src/routes/_public/home.tsx`:

```ts
/** Accepts active and stale Home search values without starting a hidden query. */
const parseHomeSearch = (search: Record<string, unknown>): HomeRouteSearch => ({
  ...(search.feed === 'home' || search.feed === 'global' || search.feed === 'following'
    ? { feed: search.feed }
    : {}),
  ...(search.compose === true || search.compose === 'true' ? { compose: true } : {}),
})

/** Resolves a stale Following route to active Home state. */
export const resolveHomeSearch = (search: HomeRouteSearch): ResolvedHomeSearch => ({
  state: {
    feed: search.feed === 'global' ? 'global' : 'home',
    compose: search.compose === true,
  },
  replace: search.feed === 'following',
})

/** Omits default Home/closed-composer values from the canonical URL. */
const serializeHomeSearch = (state: HomeFeedSearch): HomeRouteSearch => ({
  ...(state.feed === 'global' ? { feed: 'global' as const } : {}),
  ...(state.compose ? { compose: true } : {}),
})
```

Use `parseHomeSearch` as `validateSearch`. Add one shared route hook used by both loaded and pending components:

```tsx
function useResolvedHomeSearch() {
  const resolution = resolveHomeSearch(Route.useSearch())
  const navigate = Route.useNavigate()

  useEffect(() => {
    if (!resolution.replace) return
    void navigate({ search: serializeHomeSearch(resolution.state), replace: true })
  }, [navigate, resolution.replace, resolution.state.compose, resolution.state.feed])

  return {
    replacing: resolution.replace,
    search: resolution.state,
    onSearchChange: (next: HomeFeedSearch): void => {
      void navigate({ search: serializeHomeSearch(next) })
    },
  }
}
```

Both loaded and pending route components must return a query-free normalization state while `replacing` is true:

```tsx
function HomeRouteCanonicalizing() {
  return <main aria-busy="true" aria-label="Normalizing Home feed" className="mx-auto min-h-[55dvh] max-w-3xl px-4 py-10" />
}
```

Do not mount `HomePage` until replace navigation removes `feed=following`. The route test must assert `convex.query` has not run before replacement, then confirm the first feed request after replacement is `feed:listHome`.

- [ ] **Step 4: Narrow the active feed contract**

In `src/features/feed/use-feed-pages.ts`:

```ts
export type FeedView = 'home' | 'global'

const feedQuery = (view: FeedView) =>
  view === 'home' ? api.feed.listHome : api.feed.listGlobal
```

In `src/features/feed/feed-page.tsx`, render:

```tsx
{signedIn
  ? (['home', 'global'] as FeedView[]).map((item) => (
      // Preserve current tab markup and focus styling.
    ))
  : <h1 className="pb-3 text-xl font-black">Global</h1>}
```

Do not import or reference `api.feed.listFollowing` from active client code.

In `src/features/feed/feed-list.tsx`:

- Narrow `view` to `FeedView`.
- Remove the Following empty-state branch.
- Remove `signedIn` from props and from `FeedCard` calls.

- [ ] **Step 5: Remove feed-card social DOM**

In `src/features/feed/feed-card.tsx`:

- Delete `HeartIcon` and `MessageCircleIcon` imports.
- Delete `signedIn` from `FeedCardProps`.
- Delete the entire social `<footer>`.

In `src/features/feed/feed-card-detail-page.tsx`:

- Stop passing `signedIn` to `FeedCard`.
- Keep auth/ownership derivation only for `ownerId` and composer default visibility.

- [ ] **Step 6: Run focused checks**

```powershell
pnpm exec vitest run src/routes/_public/-home.test.tsx src/features/home/home-page.test.tsx src/features/feed/use-feed-pages.test.tsx src/features/feed/feed-list.test.tsx src/features/feed/feed-card.test.tsx src/features/feed/feed-card-detail-page.test.tsx
pnpm exec tsc --noEmit
```

Expected: PASS; no active Following tab/query branch; no Like/Comment/footer DOM.

- [ ] **Step 7: Commit the feed contraction**

```powershell
git add -- src/routes/_public/home.tsx src/routes/_public/-home.test.tsx src/features/feed/feed-page.tsx src/features/feed/use-feed-pages.ts src/features/feed/feed-list.tsx src/features/feed/feed-list.test.tsx src/features/feed/feed-card.tsx src/features/feed/feed-card-detail-page.tsx src/features/feed/feed-card.test.tsx src/features/home/home-page.test.tsx
git commit -m "refactor: contract home feed social ui"
```

---

### Task 3: Apply Public/Private Policy To Posts And Feed Owner Actions

**Files:**

- Modify: `src/features/feed/use-post-composer.ts`
- Modify: `src/features/feed/use-post-composer.test.tsx`
- Modify: `src/features/feed/post-composer.tsx`
- Modify: `src/features/feed/post-composer.test.tsx`
- Modify: `src/features/feed/post-composer-dialog.tsx`
- Modify: `src/features/feed/post-composer-dialog.test.tsx`
- Modify: `src/features/feed/feed-owner-actions.tsx`
- Modify: `src/features/feed/feed-owner-actions.test.tsx`

**Post composer contract:**

```ts
interface PostComposerInitial {
  text: string
  media: PostMedia | null
  hasSpoiler: boolean
  visibility: Visibility
  preserveOriginalVisibility: boolean
}

interface PostSubmitInput {
  text: string
  mediaDraft: PostMediaDraft | null
  hasSpoiler: boolean
  originalVisibility: Visibility
  visibility: VisibilitySelection
  setText: (text: string) => void
  setMediaDraft: (draft: PostMediaDraft | null) => void
  setHasSpoiler: (hasSpoiler: boolean) => void
}

interface PostComposerCurrent {
  text: string
  mediaDraft: PostMediaDraft | null
  hasSpoiler: boolean
  visibility: VisibilitySelection
}
```

The hook exposes:

```ts
visibility: VisibilitySelection
setVisibility: (visibility: ActiveVisibility) => void
```

- [ ] **Step 1: Add red hook coverage for new and legacy content**

Update all existing test fixtures with `preserveOriginalVisibility`.

Add to `src/features/feed/use-post-composer.test.tsx`:

```tsx
it('maps a Followers account default to Private for a new Post', async () => {
  const { result } = renderHook(() => usePostComposer({
    ...initial,
    visibility: 'followers',
    preserveOriginalVisibility: false,
  }))

  expect(result.current.visibility).toBe('private')
  await act(async () => result.current.submit(null))
  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'private' }))
})

it('preserves a legacy Followers Post when visibility is untouched', async () => {
  const { result } = renderHook(() => usePostComposer({
    ...initial,
    text: 'Original',
    visibility: 'followers',
    preserveOriginalVisibility: true,
  }))

  expect(result.current.visibility).toBeNull()
  act(() => result.current.setText('Changed'))
  await act(async () => result.current.submit('post-1'))
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
    postId: 'post-1',
    visibility: 'followers',
  }))
})

it('migrates a legacy Followers Post after explicit owner selection', async () => {
  const { result } = renderHook(() => usePostComposer({
    ...initial,
    visibility: 'followers',
    preserveOriginalVisibility: true,
  }))

  act(() => result.current.setVisibility('public'))
  await act(async () => result.current.submit('post-1'))
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'public' }))
})
```

- [ ] **Step 2: Add red UI and owner-menu coverage**

In `post-composer.test.tsx`, verify the opened visibility Select contains Public and Private, not Followers. When mocked selection is null, verify the trigger text is `Change visibility`.

In `post-composer-dialog.test.tsx`, capture `initial` passed to mocked `PostComposer` and assert:

```tsx
expect(capturedInitial).toMatchObject({
  visibility: 'followers',
  preserveOriginalVisibility: false,
})
```

for new content, and `true` for an edited Followers Post.

In `feed-owner-actions.test.tsx`, replace Followers mutation expectations with:

- Legacy Followers card menu contains Public and Private only.
- Neither action has a current-state marker or disabled current-state behavior.
- Public or Private selection calls the existing source mutation.
- Existing public/private cards keep their matching selected/disabled marker.

- [ ] **Step 3: Verify the red state**

```powershell
pnpm exec vitest run src/features/feed/use-post-composer.test.tsx src/features/feed/post-composer.test.tsx src/features/feed/post-composer-dialog.test.tsx src/features/feed/feed-owner-actions.test.tsx
```

Expected: FAIL because Followers remains an active choice and legacy preservation is not modeled.

- [ ] **Step 4: Resolve visibility only at the mutation boundary**

In `use-post-composer.ts`:

```ts
const initialSelection = getVisibilitySelection(
  initial.visibility,
  initial.preserveOriginalVisibility,
)
const [visibility, setVisibility] = useState<VisibilitySelection>(initialSelection)
const submission = usePostSubmission({
  text,
  mediaDraft,
  hasSpoiler,
  originalVisibility: initial.visibility,
  visibility,
  setText,
  setMediaDraft,
  setHasSpoiler,
})

const resolvedVisibility = resolveVisibilitySelection(
  input.originalVisibility,
  input.visibility,
)
const parsed = createPostInputSchema.safeParse({
  requestId: operationId.current,
  text: input.text,
  media,
  hasSpoiler: input.hasSpoiler,
  visibility: resolvedVisibility,
})
```

Replace the current `Omit<PostSubmitInput, ...>` dirty signature with:

```ts
const isPostComposerDirty = (
  initial: PostComposerInitial,
  initialVisibility: VisibilitySelection,
  current: PostComposerCurrent,
): boolean => current.text !== initial.text
  || JSON.stringify(current.mediaDraft) !== JSON.stringify(toDraft(initial.media))
  || current.hasSpoiler !== initial.hasSpoiler
  || current.visibility !== initialVisibility
```

Call it with the same `initialSelection` used to initialize state.

- [ ] **Step 5: Restrict composer choices**

In `post-composer.tsx`:

```tsx
<Select
  disabled={composer.submitting}
  onValueChange={(value) => {
    if (value) composer.setVisibility(value as ActiveVisibility)
  }}
  value={composer.visibility}
>
  <SelectTrigger aria-label="Post visibility">
    <SelectValue>
      {composer.visibility === null
        ? 'Change visibility'
        : getActiveVisibilityLabel(composer.visibility)}
    </SelectValue>
  </SelectTrigger>
  <SelectContent>
    {activeVisibilityOptions.map((value) => (
      <SelectItem key={value} value={value}>
        {getActiveVisibilityLabel(value)}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

In `post-composer-dialog.tsx`, pass:

```ts
preserveOriginalVisibility: edit !== null
```

New content receives the account default plus `false`; edit content receives stored visibility plus `true`.

- [ ] **Step 6: Restrict feed owner actions**

In `feed-owner-actions.tsx`:

- Use `ActiveVisibility` for `changeVisibility`.
- Remove `UsersIcon`.
- Render `activeVisibilityOptions`.
- Mark/disable a choice only when `card.visibility` already equals that active value.
- For legacy Followers cards, Public and Private are both enabled and no selected marker appears.

- [ ] **Step 7: Run focused checks**

```powershell
pnpm exec vitest run src/features/social/visibility.test.ts src/features/feed/use-post-composer.test.tsx src/features/feed/post-composer.test.tsx src/features/feed/post-composer-dialog.test.tsx src/features/feed/feed-owner-actions.test.tsx
pnpm exec tsc --noEmit
```

Expected: PASS; new Followers defaults become Private; legacy unrelated edits preserve Followers; owner migration works.

- [ ] **Step 8: Commit Post and owner-action policy**

```powershell
git add -- src/features/feed/use-post-composer.ts src/features/feed/use-post-composer.test.tsx src/features/feed/post-composer.tsx src/features/feed/post-composer.test.tsx src/features/feed/post-composer-dialog.tsx src/features/feed/post-composer-dialog.test.tsx src/features/feed/feed-owner-actions.tsx src/features/feed/feed-owner-actions.test.tsx
git commit -m "refactor: embargo followers post ui"
```

---

### Task 4: Apply The Embargo To Review Editor, Detail, And Cards

**Files:**

- Modify: `src/features/reviews/ui/review-editor-page.tsx`
- Modify: `src/features/reviews/ui/review-editor-page.test.tsx`
- Modify: `src/features/reviews/ui/review-detail-page.tsx`
- Modify: `src/features/reviews/ui/review-detail-page.behavior.test.tsx`
- Verify: `src/features/reviews/ui/review-detail-page.test.ts`
- Modify: `src/features/reviews/ui/published-review-card.tsx`
- Modify: `src/features/reviews/ui/published-review-card.test.tsx`

**Editor contract:**

```ts
type EditorFields = {
  body: ReviewDocumentV1
  rating: string
  summary: string
  containsSpoiler: boolean
  visibility: VisibilitySelection
}

type ReviewSaveContext = {
  // Existing fields...
  originalVisibility: Visibility
}
```

- [ ] **Step 1: Add red Review editor tests**

Update the account-default parameter test:

```tsx
it.each([
  ['public', 'Public'],
  ['private', 'Private'],
  ['followers', 'Private'],
] as const)('maps a new Review account %s default to %s', ...)
```

Add legacy tests:

```tsx
it('preserves an existing Followers Review when visibility is untouched', async () => {
  // Return an owner Review with visibility: 'followers'.
  // Assert trigger text is "Change visibility".
  // Change Summary only and save.
  expect(update).toHaveBeenCalledWith(expect.objectContaining({
    reviewId: 'review-1',
    visibility: 'followers',
  }))
})

it('migrates an existing Followers Review after explicit selection', async () => {
  // Open visibility, choose Public, save.
  expect(update).toHaveBeenCalledWith(expect.objectContaining({
    visibility: 'public',
  }))
})
```

Open the visibility Select and assert Followers is absent.

- [ ] **Step 2: Add red detail/card tests**

In `review-detail-page.behavior.test.tsx`:

- Render a Followers owner Review.
- Assert no Like button.
- Assert no `Followers` text.
- Assert owner visibility choices are Public and Private only.
- Assert selecting either choice invokes `api.reviews.setVisibility`.

Update the mocked Select prop to accept `string | null`.

In `published-review-card.test.tsx`:

```tsx
render(<PublishedReviewCard review={{ ...review, visibility: 'followers' }} />)
expect(screen.queryByText(/Followers/)).toBeNull()

render(<PublishedReviewCard review={{ ...review, visibility: 'private' }} />)
expect(screen.getByText('My Private')).toBeTruthy()
```

- [ ] **Step 3: Verify the red state**

```powershell
pnpm exec vitest run src/features/reviews/ui/review-editor-page.test.tsx src/features/reviews/ui/review-detail-page.behavior.test.tsx src/features/reviews/ui/published-review-card.test.tsx
```

Expected: FAIL because Followers remains visible and Review Like remains in the DOM.

- [ ] **Step 4: Add nullable legacy selection to the Review editor**

In `LoadedReviewEditor`:

```ts
const originalVisibility = existing?.visibility ?? defaultVisibility
const initialVisibility = getVisibilitySelection(
  originalVisibility,
  existing !== null,
)

const [fields, setFields] = useState<EditorFields>(() => existing
  ? { ...fromExisting(existing), visibility: initialVisibility }
  : {
      body: createEmptyReviewDocument(),
      rating: String(REVIEW_RATING_DEFAULT),
      summary: '',
      containsSpoiler: false,
      visibility: initialVisibility,
    })
```

Before request-id hashing and mutation calls:

```ts
const resolvedVisibility = resolveVisibilitySelection(
  originalVisibility,
  fields.visibility,
)
```

Use `resolvedVisibility` in the request payload and every Draft/Publish/Update mutation. Keep `originalVisibility` in `ReviewSaveContext` so `saveReview` cannot accidentally send null.

Render the Select with the same `activeVisibilityOptions` and `Change visibility` placeholder used by Post composer.

- [ ] **Step 5: Remove Review Like and suppress legacy labels**

In `review-detail-page.tsx`:

- Delete `HeartIcon`, `signedIn`, and the disabled Like button.
- Use `getVisibleVisibilityLabel(review.visibility)`.
- Omit the entire visibility phrase when the label is null.
- Keep Public/Private detail labels.
- Render owner Select with `activeVisibilityOptions`.
- Use null value plus `Change visibility` for legacy Followers records.

In `published-review-card.tsx`:

```tsx
{review.visibility === 'private'
  ? <Badge variant="outline">My Private</Badge>
  : null}
```

- [ ] **Step 6: Run focused checks**

```powershell
pnpm exec vitest run src/features/social/visibility.test.ts src/features/reviews/ui/review-editor-page.test.tsx src/features/reviews/ui/review-detail-page.test.ts src/features/reviews/ui/review-detail-page.behavior.test.tsx src/features/reviews/ui/published-review-card.test.tsx
pnpm exec tsc --noEmit
```

Expected: PASS; no Review Like or Followers label; legacy preservation and explicit migration are covered.

- [ ] **Step 7: Commit Review embargo behavior**

```powershell
git add -- src/features/reviews/ui/review-editor-page.tsx src/features/reviews/ui/review-editor-page.test.tsx src/features/reviews/ui/review-detail-page.tsx src/features/reviews/ui/review-detail-page.behavior.test.tsx src/features/reviews/ui/published-review-card.tsx src/features/reviews/ui/published-review-card.test.tsx
git commit -m "refactor: embargo followers review ui"
```

---

### Task 5: Canonicalize Review Discovery And Remove Followers Filter

**Files:**

- Modify: `src/features/reviews/discovery/review-discovery-state.ts`
- Modify: `src/features/reviews/discovery/review-discovery-page.tsx`
- Modify: `src/features/reviews/discovery/review-discovery-filters.tsx`
- Modify: `src/features/reviews/discovery/review-discovery-page.test.tsx`
- Modify: `src/routes/_public/reviews/-review-search.test.ts`
- Verify unchanged: `src/features/reviews/shared/review-discovery-contracts.ts`
- Verify unchanged: `src/features/reviews/shared/review-discovery-contracts.test.ts`
- Verify unchanged: `src/features/reviews/discovery/use-review-discovery-pages.ts`
- Verify unchanged: `src/features/reviews/discovery/use-review-discovery-pages.test.tsx`

**Active route contract:**

```ts
export type ActiveReviewDiscoveryVisibility =
  Exclude<ReviewDiscoveryVisibility, 'followers'>

export interface ReviewDiscoverySearchState {
  query: string | null
  sort: ReviewDiscoverySort
  ratingBand: ReviewRatingBand | null
  visibility: ActiveReviewDiscoveryVisibility
}

export interface ResolvedReviewDiscoverySearch {
  state: ReviewDiscoverySearchState
  replacementSearch: ReviewDiscoveryValidatedSearch | null
  signedIn: boolean
}

export interface ReviewDiscoveryNavigationOptions {
  search: ReviewDiscoveryValidatedSearch
  replace: true
  resetScroll: false
}
```

- [ ] **Step 1: Rewrite route tests to canonical defaults**

Update `src/routes/_public/reviews/-review-search.test.ts`:

1. Absent visibility:

```tsx
mountRoute({}, signedIn)
await waitFor(() => expect(mocks.pages).toHaveBeenCalled())
expect(mocks.pages.mock.calls[0]?.[0].visibility).toBe('all')
expect(mocks.navigate).not.toHaveBeenCalled()
```

Signed-out absent state similarly queries Public without adding a visibility query.

2. Followers stale URL:

```tsx
mountRoute({
  q: ' frieren ',
  sort: 'rating-high',
  rating: '80-89',
  visibility: 'followers',
}, signedIn)

expect(mocks.pages).not.toHaveBeenCalled()
await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({
  search: { q: 'frieren', sort: 'rating-high', rating: '80-89' },
  replace: true,
  resetScroll: false,
}))
```

Repeat signed out. Neither case may query Followers.

3. Signed-out `all` or `private` and invalid visibility also replace to the same query state with visibility omitted.

4. Signed-in explicit Public/Private/All remain valid and query directly.

- [ ] **Step 2: Add red filter UI coverage**

In `review-discovery-page.test.tsx`, open the signed-in visibility Select and assert:

```tsx
expect(screen.getByRole('option', { name: 'All visibility' })).toBeTruthy()
expect(screen.getByRole('option', { name: 'Public' })).toBeTruthy()
expect(screen.getByRole('option', { name: 'My Private' })).toBeTruthy()
expect(screen.queryByRole('option', { name: 'My Followers' })).toBeNull()
```

- [ ] **Step 3: Verify the red state**

```powershell
pnpm exec vitest run src/routes/_public/reviews/-review-search.test.ts src/features/reviews/discovery/review-discovery-page.test.tsx
```

Expected: FAIL because Followers URLs still query and the filter option remains visible.

- [ ] **Step 4: Resolve active state separately from replacement URL**

In `review-discovery-state.ts`:

```ts
const getDefaultVisibility = (
  signedIn: boolean,
): ActiveReviewDiscoveryVisibility => signedIn ? 'all' : 'public'

const serializeRouteFields = (
  routeState: ReviewDiscoveryRouteState,
): ReviewDiscoveryValidatedSearch => ({
  ...(routeState.query === null ? {} : { q: routeState.query }),
  ...(routeState.sort === 'newest' ? {} : { sort: routeState.sort }),
  ...(routeState.ratingBand === null ? {} : { rating: routeState.ratingBand }),
})
```

Resolution:

```ts
const signedIn = auth.authState.status === 'complete'
const defaultVisibility = getDefaultVisibility(signedIn)
const explicitVisibility =
  routeState.visibilitySource === 'explicit' ? routeState.visibility : null
const mustReplace = routeState.visibilitySource === 'invalid'
  || explicitVisibility === 'followers'
  || (!signedIn
    && explicitVisibility !== null
    && explicitVisibility !== 'public')
const visibility = mustReplace || explicitVisibility === null
  ? defaultVisibility
  : explicitVisibility as ActiveReviewDiscoveryVisibility

return {
  state: {
    query: routeState.query,
    ratingBand: routeState.ratingBand,
    sort: routeState.sort,
    visibility,
  },
  replacementSearch: mustReplace ? serializeRouteFields(routeState) : null,
  signedIn,
}
```

Navigation for filter/search changes omits the auth default:

```ts
export const getReviewDiscoveryNavigationOptions = (
  state: ReviewDiscoverySearchState,
  signedIn: boolean,
): ReviewDiscoveryNavigationOptions => ({
  search: {
    ...(state.query === null ? {} : { q: state.query }),
    ...(state.sort === 'newest' ? {} : { sort: state.sort }),
    ...(state.ratingBand === null ? {} : { rating: state.ratingBand }),
    ...(state.visibility === getDefaultVisibility(signedIn)
      ? {}
      : { visibility: state.visibility }),
  },
  replace: true,
  resetScroll: false,
})
```

Add a replacement helper that accepts `replacementSearch` unchanged.

```ts
export const getReviewDiscoveryReplacementOptions = (
  search: ReviewDiscoveryValidatedSearch,
): ReviewDiscoveryNavigationOptions => ({
  search,
  replace: true,
  resetScroll: false,
})
```

- [ ] **Step 5: Block query mounting until replacement completes**

In `review-discovery-page.tsx`:

```tsx
useEffect(() => {
  if (resolution?.replacementSearch === null) return
  if (resolution?.replacementSearch) {
    onNavigate(getReviewDiscoveryReplacementOptions(
      resolution.replacementSearch,
    ))
  }
}, [onNavigate, resolution])

if (auth.status === 'error') {
  return <ReviewDiscoveryAuthState message={auth.message} />
}
if (resolution === null || resolution.replacementSearch !== null) {
  return <ReviewDiscoveryAuthState message={null} />
}
return (
  <ReviewDiscoveryPage
    searchState={resolution.state}
    onSearchStateChange={(state) => onNavigate(
      getReviewDiscoveryNavigationOptions(state, resolution.signedIn),
    )}
  />
)
```

Only mount `ReviewDiscoveryPage` after replacement is unnecessary. Pass `resolution.signedIn` into navigation serialization.

- [ ] **Step 6: Remove Followers from visible filter options**

In `review-discovery-filters.tsx`, use:

```ts
const visibilityOptions: Array<{
  label: string
  value: ActiveReviewDiscoveryVisibility
}> = [
  { label: 'All visibility', value: 'all' },
  { label: 'Public', value: 'public' },
  { label: 'My Private', value: 'private' },
]
```

Keep the shared Zod schema accepting Followers for backend compatibility and stale URL parsing.

- [ ] **Step 7: Run focused checks**

```powershell
pnpm exec vitest run src/routes/_public/reviews/-review-search.test.ts src/features/reviews/discovery/review-discovery-page.test.tsx src/features/reviews/discovery/use-review-discovery-pages.test.tsx src/features/reviews/shared/review-discovery-contracts.test.ts
pnpm exec tsc --noEmit
```

Expected: PASS; stale Followers state is replaced before query; shared contracts still accept Followers.

- [ ] **Step 8: Commit Review discovery contraction**

```powershell
git add -- src/features/reviews/discovery/review-discovery-state.ts src/features/reviews/discovery/review-discovery-page.tsx src/features/reviews/discovery/review-discovery-filters.tsx src/features/reviews/discovery/review-discovery-page.test.tsx src/routes/_public/reviews/-review-search.test.ts
git commit -m "refactor: embargo followers review discovery"
```

---

### Task 6: Integrate, Review, QA, And Close Pre-Phase 7

**Files:**

- Modify after all gates pass: `TODO.md`
- Modify after all gates pass: `PLAN.md`
- Modify after all gates pass: `CONTEXT.md`
- Modify after all gates pass: `docs/superpowers/specs/2026-07-16-phase-7-9-feature-sequencing.md`
- Modify after all gates pass: `design-qa.md`
- Modify after all gates pass: `docs/architecture/review-discovery-data-flow.md`
- Read-only: Convex social/feed/review files unless a failed contract check proves a compatibility defect

- [ ] **Step 1: Audit active client strings and query references**

Run:

```powershell
rg -n "Coming in Phase|My Followers|Followers|following|Like|Comment" src/features/feed src/features/reviews src/routes/_public/home.tsx src/routes/_public/reviews
rg -n "listFollowing" src
```

Expected:

- No social placeholder, active Followers label, Followers filter, or Following tab in the changed UI files.
- `listFollowing` may remain only in preserved backend/generated code or backend tests, not active client feed selection.
- Unrelated anime Favorite controls are outside scope and must remain.

- [ ] **Step 2: Run route generation**

```powershell
pnpm run generate-routes
git diff -- src/routeTree.gen.ts
```

Expected: generation succeeds; route identities are unchanged, so no semantic generated-tree drift.

- [ ] **Step 3: Run focused suite**

```powershell
pnpm exec vitest run src/features/social/visibility.test.ts src/routes/_public/-home.test.tsx src/features/home/home-page.test.tsx src/features/feed/use-feed-pages.test.tsx src/features/feed/feed-list.test.tsx src/features/feed/feed-card.test.tsx src/features/feed/feed-card-detail-page.test.tsx src/features/feed/use-post-composer.test.tsx src/features/feed/post-composer.test.tsx src/features/feed/post-composer-dialog.test.tsx src/features/feed/feed-owner-actions.test.tsx src/features/reviews/ui/review-editor-page.test.tsx src/features/reviews/ui/review-detail-page.test.ts src/features/reviews/ui/review-detail-page.behavior.test.tsx src/features/reviews/ui/published-review-card.test.tsx src/routes/_public/reviews/-review-search.test.ts src/features/reviews/discovery/review-discovery-page.test.tsx src/features/reviews/discovery/use-review-discovery-pages.test.tsx src/features/reviews/shared/review-discovery-contracts.test.ts convex/social.integration.test.ts
```

Expected: zero failures.

- [ ] **Step 4: Run full automated gates**

```powershell
pnpm test
pnpm exec tsc --noEmit
pnpm build
npx react-doctor@latest --verbose --scope changed
pnpm exec fallow audit --base e8e9fd7cf171b8d2ac7109460399f311874d8bc5 --gate new-only --format json --quiet --explain 2>$null
$fallowExit = $LASTEXITCODE
if ($fallowExit -eq 2) { throw 'Fallow audit failed to execute.' }
git diff --check
```

Expected:

- Full Vitest: zero failures.
- TypeScript: exit `0`.
- Client and SSR builds: success.
- React Doctor: no changed-code regression.
- Fallow: executable result with no new error verdict; exit `2` blocks completion as a runtime/config failure.
- Fallow exit `1`: inspect the JSON. Any introduced actionable finding blocks until fixed. A verified false positive requires recorded file/fingerprint evidence and rationale in the QA checkpoint; do not add a suppression or config waiver without approval.
- Inherited findings outside changed code are reported separately and do not block the `new-only` gate.
- Diff check: no whitespace errors.

If the implementation baseline changes before work starts, resolve the actual pre-implementation commit and replace the recorded SHA everywhere. Do not use an arbitrary branch label.

- [ ] **Step 5: Run custom implementation review**

Use `orchestration_reviewer` against the concrete integrated diff and accepted design. Block on:

- Any social interaction control still in the DOM.
- Any active client call to Following feed.
- Any visible Followers label/option/marker.
- New content persisting Followers from account default.
- Legacy unrelated edit rewriting Followers.
- Stale route mounting a hidden query before replacement.
- Backend social contract removal.
- P1/P2 findings.

Fix the smallest root cause and rerun affected focused tests before re-review.

- [ ] **Step 6: Run browser QA**

Start `pnpm dev`. Use the repo-required in-app browser.

| State | Width | Required evidence |
| --- | --- | --- |
| Signed out | 390, 1280 | Home shows Global only; no Like/Comment controls; `/home?feed=following` becomes `/home`; no failed Following request. |
| Signed in | 390, 1280 | Home/Global tabs only; Create Post remains; account Followers default opens new composer as Private. |
| Legacy owner Post | 390, 1280 | No Followers label; editor says Change visibility; unrelated edit preserves access; Public/Private migration works. |
| New Review | 390, 1280 | Public/Private only; Followers account default displays Private. |
| Legacy owner Review | 390, 1280 | Detail/list show no Followers label; no Like control; unrelated edit preserves Followers; migration works. |
| Reviews route signed in | 390, 1280 | All/Public/My Private only; stale Followers URL removes visibility and loads All only after replace. |
| Reviews route signed out | 390, 1280 | Visibility filter hidden; stale Followers URL removes visibility and loads Public only after replace. |

For every case:

- Keyboard order and focus restoration remain usable.
- Touch targets stay at least existing `min-h-11` geometry.
- No horizontal overflow.
- Console has no runtime/hydration errors.
- Network has no failed hidden social query.

- [ ] **Step 7: Update current-state docs after green evidence**

`TODO.md`:

```md
# Pre-Phase 7 Social UI Embargo

Status: COMPLETE. Social interaction UI and Followers-only active choices are removed; stale routes canonicalize; legacy Followers records remain preserved and owner-readable.

- [x] Move social functionality to Phase 9 and lock embargo scope.
- [x] Approve design and detailed implementation plan.
- [x] Remove Following, Like, Comment, Review Like, social footer, and Followers-only active UI.
- [x] Canonicalize stale Home and Review discovery URLs before hidden queries.
- [x] Map Followers account defaults to Private for new content.
- [x] Preserve legacy Followers content through unrelated edits and allow Public/Private migration.
- [x] Complete focused/full tests, TypeScript, route generation, build, React Doctor, Fallow, review, and browser QA.
```

`PLAN.md`: mark pre-Phase 7 cleanup complete and keep Phase 7 as the next unstarted phase. Do not change Phase 7 feature scope.

`CONTEXT.md`: add a short current implementation-state note near the top:

```md
## Temporary Social UI Embargo

Through Phase 8, active UI omits Follow, Like, Comment, Following-feed, social-count, and Followers-only choices. Backend social contracts and stored Followers visibility remain intact for Phase 9. New Post and Review creation maps a stored Followers account default to Private; owner edits to legacy Followers content preserve the stored value unless Public or Private is explicitly selected.
```

`docs/superpowers/specs/2026-07-16-phase-7-9-feature-sequencing.md`: record the embargo as implemented and validated; retain Phase 9 ownership.

`design-qa.md`: add dated automated/browser evidence and note that no new visual asset was required.

`docs/architecture/review-discovery-data-flow.md`: update the existing Review discovery description to distinguish active All/Public/Private client choices from the preserved backend Followers lane. Do not create a new data-flow document.

- [ ] **Step 8: Commit closure docs**

```powershell
git add -- TODO.md PLAN.md CONTEXT.md docs/superpowers/specs/2026-07-16-phase-7-9-feature-sequencing.md design-qa.md docs/architecture/review-discovery-data-flow.md
git commit -m "docs: close pre-phase 7 social ui embargo"
```

- [ ] **Step 9: Final post-commit evidence**

```powershell
git status --short
git log -8 --oneline
git diff dev...HEAD --check
```

Expected: clean worktree; planned commits visible; no diff-check errors.

## Handoff Boundaries

- Do not start Phase 7 User Profile or Quick Search automatically.
- Do not expose or implement Phase 9 social behavior.
- Do not delete preserved backend social code because it appears unused by the embargoed client.
- Do not push, deploy, or merge without explicit user request.
- If a compatibility defect requires a Convex edit, stop and request approval before expanding scope; then add `pnpm convex:dev --once` to validation.
