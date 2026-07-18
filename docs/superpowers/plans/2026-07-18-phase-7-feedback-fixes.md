# Phase 7 Feedback Fixes Implementation Plan

Status: IMPLEMENTED, VERIFIED, AND CLOSED. Final reviewer PASS after the keyboard Profile fix. Phase 7 merged locally into `dev` at `9fdfc6b`; no production push or deploy is claimed.

> **For agentic workers:** REQUIRED SUB-SKILL: use `orchestrating-coding-work` with the existing repo `.codex/agents/orchestration_*.toml` files. Never replace configured agents with skill templates. Use `superpowers:test-driven-development` for changed behavior and `superpowers:verification-before-completion` before closure.

**Goal:** Restore reliable User avatars and owner navigation, responsive Profile layout, server-auth-first User routes, clean runtime logs, and one shared AnimeX detail composition for Anime, Character, and Staff.

**Architecture:** Keep Convex authorization authoritative. Resolve the `_profile` session on the TanStack Start server before route content renders. Read Profile header/content and User Search through authenticated TanStack Start server functions that call Convex with the request session; retain client Convex synchronization only around edit/media mutations. Navigate Profile tabs and the header owner link through TanStack Router without document reload. Reuse `UserAvatar` for User identity and as the complete-account trigger for the installed Base UI-backed shadcn dropdown. Extract Anime Detail page geometry into a neutral required-slot layout consumed by Anime and Catalog Person. Reproduce every supplied runtime error before changing its source; never infer one cause from unrelated log lines.

**Tech stack:** TanStack Start/Router/Query, React 19, Convex + Better Auth proxy, Zod, Base UI-backed shadcn, Tailwind v4, Vitest, React Doctor, Fallow. No new production dependency or asset.

## Execution outcome

Implementation tasks 1–7 are complete. The current result includes shared UserAvatar geometry and header owner menu, server-first Profile auth/read facades, SPA Profile tabs with success-only refresh, AnimeX root not-found UI, and neutral Anime/Character/Staff detail geometry with Staff `works` → `anime` migration. Final validation is recorded in `docs/superpowers/checkpoints/2026-07-18-phase-7-feedback-qa.md`.

- Full suite: 131 test files passed / 2 skipped; 925 tests passed / 3 skipped (928 total). Two initial 10-second timeouts cleared after the QA server stopped; the final full run is green.
- TypeScript, client + SSR build, Fallow, reviewer, and browser gates pass. React Doctor score is 53, equal to baseline; existing >500 kB chunk warning remains.
- Protected route-tree SHA-256 remains `14A6932D22316BF69AF6EA6C1E343EE0C4704DE66039C8A674888D11ABA92DDD`. No Convex source changed, so no Convex deploy was required.
- No browser fixture remains open. Second-account private-profile, real media lifecycle, and injected Storage failure/retry have recorded evidence. User confirmed closure for deep pagination without Codex-run evidence.

## Historical Worktree And Scope

- Branch: `jeff-cx/phase-7-user-profile-quick-search` (merged into `dev`, then deleted).
- Worktree: `D:\codex\projects\animex\.worktrees\phase-7-user-profile-quick-search` (removed and pruned).
- Starting implementation commit: `3fdda5c`.
- Accepted contract: `docs/superpowers/specs/2026-07-18-phase-7-feedback-fixes-design.md`.
- Preserve unrelated dirty files: `.superpowers/sdd/task-4-report.md`, `.superpowers/sdd/task-5-report.md`, `.superpowers/sdd/task-6-report.md`, `components.json`, and `src/routeTree.gen.ts`.
- `dropdown-menu` is already installed and Base UI-backed. Do not run an overwrite/add during implementation; extend only the minimal local wrapper needed for grouped composition and preserve the dirty `components.json`.
- Route paths do not change. Do not regenerate or stage `src/routeTree.gen.ts`. Capture its dirty bytes/hash before implementation and compare after every route/build gate.
- Do not read, print, copy, or commit QA credentials. Browser workers may use the two accounts documented in `AGENTS.md`.
- Do not change `convex/profiles.ts` access rules, Catalog Person provider documents, cache keys, cache tables, or work API names.
- Do not generate images. Supplied screenshots and existing repo visual references are evidence only.

## Locked Contracts

### User identity

```ts
type UserAvatarSize = 'sm' | 'md' | 'lg' | 'search' | 'profile'
```

- `md`: existing 44 px Quick Search size.
- `search`: 64 px box with 24 px fallback glyph.
- `profile`: 96 px/36 px on phone; 128 px/48 px from tablet upward.
- All sizes remain square, circular, non-shrinking, clipped, and `object-cover`.
- User rows use `UserAvatar`; Anime, Character, and Staff keep `ResultImage`/`AnimeImage`.

### Header account menu

- Complete accounts replace the standalone header Sign out button with `UserAvatar size="md"` inside the existing Base UI-backed shadcn `DropdownMenuTrigger`.
- The 44 px trigger has an explicit account-menu accessible name and identical valid/missing/broken image geometry.
- `DropdownMenuContent` aligns to the header end. One `DropdownMenuGroup` contains exactly `Profile` and `Sign out`, each with a minimum 44 px target.
- `Profile` uses `DropdownMenuItem render={<Link />}>` with typed `/users/$username` params and `tab: undefined`; selection closes the menu and stays in the SPA.
- `Sign out` reuses `authClient.signOut` plus `assertAuthResponse`. Disable the item and show pending text/spinner during the request; success assigns `/home`; failure re-enables the item and uses the existing Sonner error toast.
- Signed-out users keep `Sign in`. `emailUnverified` and `needsProfile` users keep direct Sign out because they do not yet own a complete Profile destination.
- Base UI owns Arrow-key navigation, Enter selection, Escape/outside close, and focus restoration; browser QA proves those behaviors.

### Profile auth and navigation

```ts
interface ProfileRouteAuthResult {
  authState: AuthState
}

interface ProfileReadFunctions {
  getProfileByUsername(input: { username: string }): Promise<ProfileResult>
  getProfileContentPage(
    input: { username: string; tab: ProfileTab; cursor: string | null },
  ): Promise<ProfileContentPage>
  searchUsers(input: UserSearchInput): Promise<UserSearchResultPage>
  searchUsersPreview(input: { query: string }): Promise<UserSearchPreviewRow[]>
}
```

- A server function reads `api.users.getAuthState` through `getAuthProxy` and returns the existing schema-parsed AnimeX `AuthState`, never raw Better Auth data.
- `_profile.beforeLoad` seeds `authStateQueryOptions()` in the shared TanStack Query cache before render; `PublicAuthStateProvider` consumes that same hydrated query instead of starting a second Profile-route auth transition.
- Each protected read uses `getAuthProxy(...).fetchAuthQuery(api.*, args)`; Convex remains the final access authority.
- Inputs and returned data use strict Zod contracts. Server modules never import UI types.
- `_public/_profile.beforeLoad` awaits that function before children render.
- Signed-out, unverified, and incomplete states throw existing validated redirects.
- Auth transport/parse failure reaches an actionable route error boundary.
- A complete server result loads Profile/User Search data through server functions; it never waits on a client Convex token.
- Client Convex synchronization gates edit/media mutations only and reports an actionable mutation error.
- Activity, Reviews, and Favorites use router navigation with `resetScroll: false`; they do not reload the document or remount the public shell.

### Catalog Person

```ts
type CatalogPersonTab = 'overview' | 'anime'

interface DetailPageLayoutProps {
  hero: ReactNode
  content: ReactNode
  aside: ReactNode
}
```

- Anime, Character, and Staff share the `max-w-[1480px]`, single-column-to-`3fr/17rem` layout.
- Both Character and Staff expose only Overview and Anime.
- Staff legacy `?tab=works` parses as Anime and replaces to `?tab=anime`.
- Staff request/cache identity remains `kind: 'staff'`, person ID, and page. Existing `getCatalogPersonWorks` and `catalog-person-works` keys remain unchanged.

### Runtime log gate

Treat these as separate signatures until one exact stack proves otherwise:

1. React invalid-hook call;
2. `QueryClientProvider` render failure;
3. root not-found warning;
4. `profiles:getByUsername` `Unauthenticated`;
5. hydration or uncaught server/client errors discovered in the same flows.

`pnpm why react` currently reports one React version and the router SSR integration already owns `QueryClientProvider`. Do not alter dependencies, Vite dedupe, providers, or hooks without a captured stack naming that layer.

## Ownership And Locks

| Task | Owner | Write lock |
| --- | --- | --- |
| 1 | read-only QA researcher + controller/test worker | QA owns runtime observation; controller/test worker owns checkpoints and listed RED tests |
| 2 | avatar/Profile UI worker | `user-avatar`, Profile header/page, Quick Search/User Search UI and tests |
| 3 | auth worker | shared server auth/query hydration, header account menu, Profile/User Search server reads, `_profile` route, mutation refresh, auth/route tests |
| 4 | runtime worker | root not-found plus only the exact source proven by Task 1 |
| 5 | catalog UI worker | shared detail layout, Anime Detail UI, Catalog Person contracts/UI/routes/tests |
| 6 | controller | integration, focused/full automated gates |
| 7 | current-TOML reviewer + QA | read-only review and browser QA |
| 8 | docs mapper + controller | current-state docs and tracker closure |

Tasks 2 and 5 may run in parallel only after Task 1 commits the RED tests and releases their file locks. Task 4 may join only when Task 1 proves a source outside their write locks. Task 3 follows Task 2 because both touch Profile page behavior. Controller integrates once.

---

### Task 1: Capture Reproducible Baseline And RED Contracts

**Owner:** QA researcher observes runtime read-only. Controller/test worker owns every listed checkpoint/test write and releases those locks after the RED commit.

**Staged TDD note:** Task 1 covers behavior that can fail through existing seams. Tests for new auth-state, Profile-read, and User Search server-facade modules move to the first RED slice of Task 3, before those production modules are created. This avoids module-resolution setup failures while preserving test-first implementation.

**Files:**

- Create: `docs/superpowers/checkpoints/2026-07-18-phase-7-feedback-fixes-start.md`
- Create: `docs/superpowers/checkpoints/2026-07-18-phase-7-runtime-evidence.md`
- Modify: `src/components/user-avatar.test.tsx`
- Create: `src/features/quick-search/ui/quick-search-avatar.test.tsx`
- Modify: `src/features/profile/ui/user-search-page.test.tsx`
- Create: `src/features/profile/ui/profile-feedback.test.tsx`
- Create: `src/features/profile/ui/profile-navigation.test.tsx`
- Create: `src/features/auth/auth-state.functions.test.ts`
- Create: `src/features/auth/auth-state-query.test.ts`
- Modify: `src/features/shell/public-shell.test.tsx`
- Modify: `src/routes/-index.test.tsx`
- Create: `src/features/profile/server/profile-read.functions.test.ts`
- Create: `src/features/profile/server/user-search.functions.test.ts`
- Create: `src/features/profile/shared/user-search-contracts.test.ts`
- Modify: `src/features/profile/ui/profile-image-cropper.test.tsx`
- Create: `src/routes/-root.test.tsx`
- Modify: `src/features/catalog-person/shared/catalog-person-contracts.test.ts`
- Modify: `src/features/catalog-person/ui/catalog-person-page.test.tsx`
- Modify: `src/routes/_public/-catalog-person-route.test.ts`

- [ ] **Step 1: Record immutable implementation baseline**

Record branch, `3fdda5c`, current dirty exclusions, dependency summary, and full React Doctor score. Copy the current dirty generated route tree to a unique temporary backup, record its SHA-256/Git blob hashes plus pre-existing diff, and never copy secret values.

```powershell
git branch --show-current
git rev-parse HEAD
git status --short
$routeTree = (Resolve-Path -LiteralPath 'src/routeTree.gen.ts').Path
$routeTreeBackup = Join-Path ([System.IO.Path]::GetTempPath()) 'animex-phase7-feedback-routeTree.gen.ts.backup'
if (Test-Path -LiteralPath $routeTreeBackup) { throw 'Route-tree backup already exists; choose and record a fresh backup path.' }
Copy-Item -LiteralPath $routeTree -Destination $routeTreeBackup
Get-FileHash -Algorithm SHA256 -LiteralPath $routeTree
git hash-object -- src/routeTree.gen.ts
git diff -- src/routeTree.gen.ts
pnpm list react react-dom @tanstack/react-query @tanstack/react-router @tanstack/react-start --depth 2
pnpm why react --depth 8
npx react-doctor@latest --score
```

Expected: feature branch, known dirty exclusions, byte backup outside the worktree, recorded route-tree hashes/diff, one resolved React version, and a numeric Doctor baseline. The checkpoint records `$routeTreeBackup` for this execution.

- [ ] **Step 2: Reproduce supplied logs before edits**

Use the in-app Browser first. Capture timestamp, route, navigation action, first application stack frame, server request/error, and whether the flow was SSR entry or client navigation for:

- direct `/users/:username`;
- Activity → Reviews → Favorites;
- Quick Search User result → Profile;
- `/search/users` User result → Profile;
- complete-account header action on `/` and `/home`;
- one unknown path for root not-found;
- one Character and one Staff detail.

Record sanitized signatures only. Do not call all errors one bug.

- [ ] **Step 3: Write minimal failing tests**

Add RED assertions for:

- shared User avatar with valid URL, missing URL, failed URL, `search`, and `profile` geometry;
- Quick Search User row uses a circular labelled `UserAvatar`;
- `/search/users` renders valid/fallback avatars instead of empty circles;
- Profile identity safely wraps and its fallback glyph scales with the box;
- Profile tab intent uses router navigation without document reload or scroll reset;
- server auth returns the parsed application `AuthState`, redirects incomplete states, and surfaces transport failure;
- direct Profile entry and the public provider reuse one hydrated auth query without a second loading transition;
- complete auth renders a 44 px labelled `UserAvatar` account-menu trigger instead of a standalone Sign out button;
- account menu contains one typed owner-Profile link and one Sign out action, supports keyboard focus return, blocks duplicate sign-out, and reports sign-out failure;
- signed-out and incomplete-profile header actions remain Sign in/direct Sign out respectively;
- Profile header/content and both User Search modes call authenticated server facades, not client Convex reads;
- edit/media mutation controls remain unavailable until client Convex identity agrees;
- successful media finalize/remove refreshes the server Profile query, while cancel/failure does not;
- root owns an AnimeX not-found component;
- Character/Staff share Overview/Anime; Staff `works` canonicalizes to `anime`.

```powershell
pnpm test -- src/components/user-avatar.test.tsx src/features/quick-search/ui/quick-search-avatar.test.tsx src/features/profile/ui/user-search-page.test.tsx src/features/profile/ui/profile-feedback.test.tsx src/features/profile/ui/profile-navigation.test.tsx src/features/auth/auth-state.functions.test.ts src/features/auth/auth-state-query.test.ts src/features/shell/public-shell.test.tsx src/routes/-index.test.tsx src/features/profile/server/profile-read.functions.test.ts src/features/profile/server/user-search.functions.test.ts src/features/profile/shared/user-search-contracts.test.ts src/features/profile/ui/profile-image-cropper.test.tsx src/routes/-root.test.tsx src/features/catalog-person/shared/catalog-person-contracts.test.ts src/features/catalog-person/ui/catalog-person-page.test.tsx src/routes/_public/-catalog-person-route.test.ts
```

Expected: new assertions fail for the named missing behavior, not setup errors.

- [ ] **Step 4: Commit evidence and RED tests**

```powershell
git add TODO.md docs/superpowers/specs/2026-07-18-phase-7-feedback-fixes-design.md docs/superpowers/plans/2026-07-18-phase-7-feedback-fixes.md docs/superpowers/checkpoints/2026-07-18-phase-7-feedback-fixes-start.md docs/superpowers/checkpoints/2026-07-18-phase-7-runtime-evidence.md src/components/user-avatar.test.tsx src/features/quick-search/ui/quick-search-avatar.test.tsx src/features/profile/ui/user-search-page.test.tsx src/features/profile/ui/profile-feedback.test.tsx src/features/profile/ui/profile-navigation.test.tsx src/features/auth/auth-state.functions.test.ts src/features/auth/auth-state-query.test.ts src/features/shell/public-shell.test.tsx src/routes/-index.test.tsx src/features/profile/server/profile-read.functions.test.ts src/features/profile/server/user-search.functions.test.ts src/features/profile/shared/user-search-contracts.test.ts src/features/profile/ui/profile-image-cropper.test.tsx src/routes/-root.test.tsx src/features/catalog-person/shared/catalog-person-contracts.test.ts src/features/catalog-person/ui/catalog-person-page.test.tsx src/routes/_public/-catalog-person-route.test.ts
git commit -m "test: capture phase 7 feedback regressions"
```

---

### Task 2: Reuse UserAvatar And Repair Profile Containment

**Files:**

- Modify: `src/components/user-avatar.tsx`
- Modify: `src/components/user-avatar.test.tsx`
- Modify: `src/features/quick-search/ui/quick-search-results.tsx`
- Create: `src/features/quick-search/ui/quick-search-avatar.test.tsx`
- Modify: `src/features/profile/ui/user-search-page.tsx`
- Modify: `src/features/profile/ui/user-search-page.test.tsx`
- Modify: `src/features/profile/ui/profile-header.tsx`
- Modify: `src/features/profile/ui/profile-page.tsx`
- Create: `src/features/profile/ui/profile-feedback.test.tsx`

- [ ] **Step 1: Implement explicit avatar geometry**

Add `search` and `profile` size entries. Put box and fallback typography on `UserAvatar` itself. Remove Profile Header descendant-size overrides. Preserve existing `sm`, `md`, and `lg` behavior for feed/review consumers.

- [ ] **Step 2: Reuse UserAvatar in both User search surfaces**

Quick Search branches by group: Users use `UserAvatar`; catalog groups keep rectangular `ResultImage`. `/search/users` removes its raw `<img>` wrapper and uses `size="search"`. Labels include the display name and “avatar”.

- [ ] **Step 3: Constrain Profile at all breakpoints**

- avatar/ring use square aspect and `shrink-0`;
- identity row wraps at tablet and stays stable at desktop;
- display name, username, and bio use `min-w-0` plus safe anywhere wrapping;
- Edit Profile is full-width only where needed and never compresses avatar/identity;
- main/support grid children use `minmax(0,1fr)`;
- Profile page clips no content and creates no horizontal page scroll;
- tab rail alone may scroll below available width.

- [ ] **Step 4: Run GREEN tests**

```powershell
pnpm test -- src/components/user-avatar.test.tsx src/features/quick-search/ui/quick-search-avatar.test.tsx src/features/profile/ui/user-search-page.test.tsx src/features/profile/ui/profile-feedback.test.tsx
```

Expected: valid, missing, and failed User images preserve exact geometry; responsive contract assertions pass.

- [ ] **Step 5: Commit avatar/Profile UI**

```powershell
git add src/components/user-avatar.tsx src/components/user-avatar.test.tsx src/features/quick-search/ui/quick-search-results.tsx src/features/quick-search/ui/quick-search-avatar.test.tsx src/features/profile/ui/user-search-page.tsx src/features/profile/ui/user-search-page.test.tsx src/features/profile/ui/profile-header.tsx src/features/profile/ui/profile-page.tsx src/features/profile/ui/profile-feedback.test.tsx
git commit -m "fix: restore user avatars and profile containment"
```

---

### Task 3: Move User Route Auth And Reads To The Server

**Files:**

- Create: `src/features/auth/auth-state.functions.ts`
- Create: `src/features/auth/auth-state.functions.test.ts`
- Create: `src/features/auth/auth-state-query.ts`
- Create: `src/features/auth/auth-state-query.test.ts`
- Create: `src/features/profile/server/profile-read.functions.ts`
- Create: `src/features/profile/server/profile-read.functions.test.ts`
- Create: `src/features/profile/server/user-search.functions.ts`
- Create: `src/features/profile/server/user-search.functions.test.ts`
- Create: `src/features/profile/shared/user-search-contracts.ts`
- Create: `src/features/profile/shared/user-search-contracts.test.ts`
- Create: `src/features/profile/ui/profile-route.ts`
- Create: `src/features/profile/ui/profile-navigation.test.tsx`
- Modify: `src/features/profile/shared/profile-contracts.ts`
- Modify: `src/features/profile/shared/profile-contracts.test.ts`
- Modify: `src/routes/_public/_profile/route.tsx`
- Modify: `src/routes/_public/_profile/users/$username.tsx`
- Modify: `src/features/profile/ui/profile-page.tsx`
- Modify: `src/features/profile/ui/profile-page.test.tsx`
- Modify: `src/features/profile/ui/use-profile-pages.ts`
- Modify: `src/features/profile/ui/use-user-search-pages.ts`
- Modify: `src/features/profile/ui/edit-profile-dialog.tsx`
- Modify: `src/features/profile/ui/edit-profile-dialog.test.tsx`
- Modify: `src/features/profile/ui/profile-image-cropper.tsx`
- Modify: `src/features/profile/ui/profile-image-cropper.test.tsx`
- Modify: `src/features/quick-search/ui/use-quick-search.ts`
- Modify: `src/features/quick-search/ui/quick-search-provider.tsx`
- Modify: `src/features/quick-search/ui/quick-search.test.tsx`
- Modify: `src/components/ui/dropdown-menu.tsx`
- Modify: `src/features/shell/header-auth-controls.tsx`
- Modify: `src/features/shell/public-auth-context.tsx`
- Modify: `src/features/shell/public-shell.test.tsx`
- Modify: `src/routes/-index.test.tsx`

- [ ] **Step 1: Add one authenticated server boundary**

Create a reusable GET auth-state server function that calls:

```ts
getAuthProxy(PROFILE_ROUTE_AUTH_SCOPE)
  .fetchAuthQuery(api.users.getAuthState, {})
```

Parse and return the existing `AuthState` contract with `authStateSchema`. This is the sanitized application state already consumed by the shell, not a raw Better Auth session or Convex identity. Raise `AUTH_STATE_UNAVAILABLE` on transport/shape failure.

Define one `authStateQueryOptions()` factory around that server function. Use a stable key and a nonzero stale window so the server loader and public provider share the same dehydrated TanStack Query entry instead of starting independent auth requests.

- [ ] **Step 2: Add authenticated Profile/User Search read facades**

Create strict GET server functions:

- `getProfileByUsername`: `api.profiles.getByUsername`;
- `getProfileContentPage`: switch validated `activity|reviews|favorites` to the existing `feed.listForProfile`, `reviews.listForProfile`, or `userAnime.listProfileFavorites` query;
- `searchUsers`: existing `api.userSearch.search`;
- `searchUsersPreview`: existing `api.userSearch.searchPreview`.

Move `ProfileHeaderData`, `ProfileResult`, and content-page wire contracts out of UI modules into shared strict schemas. Every handler uses `getAuthProxy(...).fetchAuthQuery`, validates input/output, raises the original explicit authorization/service error, and exposes no raw user/auth document. Keep cursor, page size, privacy, visibility, and search projection behavior unchanged. Do not edit Convex functions.

- [ ] **Step 3: Gate `_profile` in `beforeLoad`**

In `_profile.beforeLoad`, await `context.queryClient.ensureQueryData(authStateQueryOptions())` before child rendering. Reuse `resolveAuthReturnTo` and existing destinations. Throw TanStack `redirect` for signed-out, email-unverified, and needs-profile states. Add a route `errorComponent` with “Authentication unavailable” and a retry/reload action.

Delete the `_profile` route's client `useEffect`, `usePublicAuthState`, `useConvexAuth`, `ProfileGate`, and `Checking authentication…` gate. Keep the shared `PublicAuthStateProvider`, but change it to consume `useQuery(authStateQueryOptions())`; during direct Profile SSR it reads the loader-hydrated entry and during ordinary public navigation it owns the same single query. The Profile page no longer waits on client Convex identity for reads.

- [ ] **Step 4: Add complete-account header menu**

Keep the existing local `dropdown-menu.tsx`; do not apply the 266-line registry overwrite shown by `shadcn add --diff`. Add only `DropdownMenuGroup` around `MenuPrimitive.Group` so items follow current shadcn composition.

In `HeaderAuthControls`, preserve loading, error, signed-out Sign in, and incomplete-account direct Sign out branches. For `complete`, render:

- `DropdownMenuTrigger` as its native button with explicit `${name} account menu` label and `UserAvatar size="md"`;
- end-aligned `DropdownMenuContent` with one `DropdownMenuGroup`;
- `Profile` as `DropdownMenuItem render={<Link />}>`, typed to `/users/$username` with `tab: undefined`;
- `Sign out` as an action item using the existing Better Auth flow, disabled/pending during one request.

Use current Lucide `UserRoundIcon`, `LogOutIcon`, `LoaderCircle`, and the existing Sonner pattern. Do not size menu icons manually; apply only pending/reduced-motion animation to the loader. On sign-out failure, keep the account trigger usable and call `toast.error` with the actionable message; on success preserve `window.location.assign('/home')`.

- [ ] **Step 5: Load Profile data through TanStack Query**

Build `profileQueryOptions(username)` around `getProfileByUsername`. The child loader awaits `context.queryClient.ensureQueryData`; the route/component consumes the same cached result. `ProfilePage` removes direct `useQuery(profiles:getByUsername)`. `useProfilePages` calls `getProfileContentPage`, retaining scope isolation, cursor validation, dedupe, retry, auto-load, and explicit lane errors.

Profile field/media mutations stay direct Convex writes. Gate only their controls on client Convex agreement. After update/finalize/remove succeeds, one `onProfileChanged` path invalidates the Profile query and awaits route/query refetch so server-loaded avatar/banner/name/bio/visibility refresh without stale UI. Cancelled or failed edit/media actions must not invalidate or refetch.

- [ ] **Step 6: Move User Search reads behind the server**

`useUserSearchPages` calls `searchUsers`; `useQuickSearch` calls `searchUsersPreview`. Preserve existing query keys, 20/5 row limits, first-seen dedupe, partial-success lanes, retry, rapid-query isolation, and close-before-navigation. User-result eligibility remains a complete public auth profile, but no client Convex token controls the request.

- [ ] **Step 7: Navigate Profile tabs through Router**

Replace plain anchors with typed TanStack links/navigation to the same username and selected `tab`, using `resetScroll: false`. Invalid tab replacement remains `replace: true`. Back, forward, refresh, and direct tab URLs retain canonical state.

- [ ] **Step 8: Prove server ownership, owner entry, and stable navigation**

Tests must show:

- `beforeLoad` resolves/redirects before child render;
- direct Profile entry hydrates the same auth query consumed by `PublicAuthStateProvider`, with no second auth request or loading transition;
- complete-account shell shows the shared avatar trigger, exactly two grouped menu items, and a typed Profile href for the authenticated username;
- Profile selection uses SPA navigation; Escape/outside close restores focus; Arrow/Enter operate the menu;
- one sign-out request disables the item, success keeps the existing `/home` redirect, and failure produces an accessible Sonner error without replacing the account trigger;
- signed-out and incomplete-account header branches remain unchanged;
- Profile header/content and User Search call the authenticated proxy functions, never browser Convex reads;
- no rendered text contains `Checking authentication`;
- changing tabs does not remount auth provider/layout;
- server auth errors are explicit and do not become signed-out redirects.
- successful edit, media finalize, and media remove actions await invalidation/refetch of the server Profile query;
- edit/media cancel and failure paths do not invalidate or refetch;
- client Convex disagreement blocks mutations with an explicit actionable error without hiding the Profile page.

```powershell
pnpm test -- src/features/auth/auth-state.functions.test.ts src/features/auth/auth-state-query.test.ts src/features/shell/public-shell.test.tsx src/routes/-index.test.tsx src/features/profile/server/profile-read.functions.test.ts src/features/profile/server/user-search.functions.test.ts src/features/profile/shared/profile-contracts.test.ts src/features/profile/shared/user-search-contracts.test.ts src/features/profile/ui/profile-navigation.test.tsx src/features/profile/ui/profile-page.test.tsx src/features/profile/ui/edit-profile-dialog.test.tsx src/features/profile/ui/profile-image-cropper.test.tsx src/features/quick-search/ui/quick-search.test.tsx src/features/profile/ui/user-search-page.test.tsx
```

- [ ] **Step 9: Commit auth/header/read/navigation**

```powershell
git add src/features/auth/auth-state.functions.ts src/features/auth/auth-state.functions.test.ts src/features/auth/auth-state-query.ts src/features/auth/auth-state-query.test.ts src/components/ui/dropdown-menu.tsx src/features/shell/header-auth-controls.tsx src/features/shell/public-auth-context.tsx src/features/shell/public-shell.test.tsx src/routes/-index.test.tsx src/features/profile/server/profile-read.functions.ts src/features/profile/server/profile-read.functions.test.ts src/features/profile/server/user-search.functions.ts src/features/profile/server/user-search.functions.test.ts src/features/profile/shared/profile-contracts.ts src/features/profile/shared/profile-contracts.test.ts src/features/profile/shared/user-search-contracts.ts src/features/profile/shared/user-search-contracts.test.ts src/features/profile/ui/profile-route.ts src/features/profile/ui/profile-navigation.test.tsx src/routes/_public/_profile/route.tsx 'src/routes/_public/_profile/users/$username.tsx' src/features/profile/ui/profile-page.tsx src/features/profile/ui/profile-page.test.tsx src/features/profile/ui/use-profile-pages.ts src/features/profile/ui/use-user-search-pages.ts src/features/profile/ui/edit-profile-dialog.tsx src/features/profile/ui/edit-profile-dialog.test.tsx src/features/profile/ui/profile-image-cropper.tsx src/features/profile/ui/profile-image-cropper.test.tsx src/features/quick-search/ui/use-quick-search.ts src/features/quick-search/ui/quick-search-provider.tsx src/features/quick-search/ui/quick-search.test.tsx
git commit -m "fix: resolve profile auth and owner navigation"
```

---

### Task 4: Fix Root Not-Found And The Proven Runtime Source

**Files:**

- Modify: `src/routes/__root.tsx`
- Create: `src/routes/-root.test.tsx`
- Conditional modify: only the source named by `2026-07-18-phase-7-runtime-evidence.md`
- Conditional modify: `vite.config.ts`, `package.json`, and `pnpm-lock.yaml` only if the captured stack proves runtime duplication or incompatible installed TanStack versions

- [ ] **Step 1: Add root not-found boundary**

Add an AnimeX-styled `notFoundComponent` to the root route with heading, plain explanation, and 44 px Home action. Test the configured route option and accessible output.

- [ ] **Step 2: Fix invalid-hook/provider error at its exact source**

Use this evidence order:

1. first application stack frame;
2. React module IDs in client bundle;
3. installed package graph;
4. SSR versus client reproduction;
5. provider mount count.

Allowed outcomes:

- app hook misuse: move the hook into its component/custom hook and add a regression test;
- duplicated Vite React runtime: add exact `resolve.dedupe` entries for `react`/`react-dom` and prove one runtime;
- incompatible existing TanStack package set: pin only the already-installed TanStack packages to one documented compatible set and run `pnpm install`;
- error disappears after full-document Profile navigation is removed: keep package/Vite/provider files unchanged and record that proof.

Do not add a provider, error-suppressing fallback, catch-all, or dependency based only on the generic React message.

- [ ] **Step 3: Rerun root/runtime reproduction**

```powershell
pnpm test -- src/routes/-root.test.tsx
pnpm exec tsc --noEmit
pnpm build
```

Repeat the exact Task 1 routes. Expected: one query provider, AnimeX not-found UI, no invalid-hook/provider warning, no hydration failure, and no unauthenticated Profile query.

- [ ] **Step 4: Commit exact runtime fix**

Stage only proven files and the updated runtime evidence.

```powershell
git add src/routes/__root.tsx src/routes/-root.test.tsx docs/superpowers/checkpoints/2026-07-18-phase-7-runtime-evidence.md
git commit -m "fix: clean root runtime boundaries"
```

If a proven Vite/package file changed, add it explicitly to the same commit after reviewing the lockfile.

---

### Task 5: Share Anime Detail Geometry With Character And Staff

**Files:**

- Create: `src/components/detail-page-layout.tsx`
- Modify: `src/features/anime-detail/ui/anime-detail-page.tsx`
- Modify: `src/features/anime-detail/ui/anime-detail-page.test.tsx`
- Modify: `src/features/catalog-person/shared/catalog-person-contracts.ts`
- Modify: `src/features/catalog-person/shared/catalog-person-contracts.test.ts`
- Modify: `src/features/catalog-person/ui/catalog-person-route.ts`
- Modify: `src/features/catalog-person/ui/catalog-person-page.tsx`
- Modify: `src/features/catalog-person/ui/catalog-person-page.test.tsx`
- Modify: `src/features/catalog-person/ui/catalog-person-work-grid.tsx`
- Modify: `src/features/catalog-person/ui/catalog-person-work-grid.test.tsx`
- Modify: `src/routes/_public/characters/$id/index.tsx`
- Modify: `src/routes/_public/characters/$id/$slug/route.tsx`
- Modify: `src/routes/_public/staff/$id/index.tsx`
- Modify: `src/routes/_public/staff/$id/$slug/route.tsx`
- Modify: `src/routes/_public/-catalog-person-route.test.ts`

- [ ] **Step 1: Extract neutral required-slot layout**

Move only page geometry from Anime Detail:

- `max-w-[1480px]`;
- single main column below `lg`;
- `minmax(0,3fr)` main plus `minmax(17rem,1fr)` aside at `lg`;
- current gutters and bottom spacing;
- `min-w-0` main containment.

All three props are required. No Anime data, auth control, fallback, default prop, or optional sidebar enters this component.

- [ ] **Step 2: Keep Anime Detail behavior unchanged**

Pass its existing hero/tabs/sidebar into `DetailPageLayout`. Existing Anime Detail tests must keep hero, tab, sidebar, loading, and error behavior.

- [ ] **Step 3: Move Catalog Person to the shared shell**

Use the image-led hero/main/sidebar relationship without importing Anime controls. Overview keeps About in content and provider-present Facts in aside. Anime keeps the existing work grid and explicit loading/empty/retry/end states.

- [ ] **Step 4: Canonicalize the two-tab contract**

- `CatalogPersonTab` becomes `overview | anime`;
- both route families validate `tab?: 'anime'`;
- legacy Staff `works` returns `{ tab: 'anime', replace: true }`;
- ready Staff routes replace to `?tab=anime`;
- invalid/explicit Overview removes the query;
- keyboard tabs remain Arrow Left/Right, Home, End;
- work query keys and server calls stay unchanged.

- [ ] **Step 5: Run catalog/Anime GREEN tests**

```powershell
pnpm test -- src/features/anime-detail/ui/anime-detail-page.test.tsx src/features/catalog-person/shared/catalog-person-contracts.test.ts src/features/catalog-person/ui/catalog-person-page.test.tsx src/features/catalog-person/ui/catalog-person-work-grid.test.tsx src/routes/_public/-catalog-person-route.test.ts
```

Expected: Anime behavior unchanged; Character/Staff expose Overview/Anime; Staff legacy URL replaces once; no work/cache identity changes.

- [ ] **Step 6: Commit shared detail layout**

```powershell
git add src/components/detail-page-layout.tsx src/features/anime-detail/ui/anime-detail-page.tsx src/features/anime-detail/ui/anime-detail-page.test.tsx src/features/catalog-person/shared/catalog-person-contracts.ts src/features/catalog-person/shared/catalog-person-contracts.test.ts src/features/catalog-person/ui/catalog-person-route.ts src/features/catalog-person/ui/catalog-person-page.tsx src/features/catalog-person/ui/catalog-person-page.test.tsx src/features/catalog-person/ui/catalog-person-work-grid.tsx src/features/catalog-person/ui/catalog-person-work-grid.test.tsx 'src/routes/_public/characters/$id/index.tsx' 'src/routes/_public/characters/$id/$slug/route.tsx' 'src/routes/_public/staff/$id/index.tsx' 'src/routes/_public/staff/$id/$slug/route.tsx' src/routes/_public/-catalog-person-route.test.ts
git commit -m "fix: unify catalog detail layout"
```

---

### Task 6: Integrate And Run Automated Gates

**Owner:** controller only.

- [ ] **Step 1: Review integration diff and forbidden files**

```powershell
git status --short
git diff --check 3fdda5c..HEAD
git diff --name-only 3fdda5c..HEAD
$routeTree = (Resolve-Path -LiteralPath 'src/routeTree.gen.ts').Path
$routeTreeBackup = Join-Path ([System.IO.Path]::GetTempPath()) 'animex-phase7-feedback-routeTree.gen.ts.backup'
if (-not (Test-Path -LiteralPath $routeTreeBackup)) { throw 'Route-tree byte backup is missing.' }
$routeTreeHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $routeTreeBackup).Hash
```

Expected: no generated route change, no unrelated report/config staging, no Convex authorization/cache change, no new asset/dependency unless Task 4 evidence required an existing-package pin.

After every command that can generate routes/build output, compare the worktree file to `$routeTreeHash`. On mismatch, stop immediately, diff the file against `$routeTreeBackup`, and use `apply_patch` from that backup evidence to remove only the new generator delta. Never use `git restore`/checkout because the pre-existing hunk belongs to the user. Continue only after SHA-256 matches the backup.

- [ ] **Step 2: Run focused suite**

```powershell
$routeTree = (Resolve-Path -LiteralPath 'src/routeTree.gen.ts').Path
$routeTreeBackup = Join-Path ([System.IO.Path]::GetTempPath()) 'animex-phase7-feedback-routeTree.gen.ts.backup'
if (-not (Test-Path -LiteralPath $routeTreeBackup)) { throw 'Route-tree byte backup is missing.' }
$routeTreeHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $routeTreeBackup).Hash
pnpm test -- src/components/user-avatar.test.tsx src/features/quick-search/ui/quick-search-avatar.test.tsx src/features/quick-search/ui/quick-search.test.tsx src/features/auth/auth-state.functions.test.ts src/features/auth/auth-state-query.test.ts src/features/shell/public-shell.test.tsx src/routes/-index.test.tsx src/features/profile/ui/user-search-page.test.tsx src/features/profile/ui/profile-feedback.test.tsx src/features/profile/ui/profile-navigation.test.tsx src/features/profile/ui/profile-page.test.tsx src/features/profile/ui/edit-profile-dialog.test.tsx src/features/profile/ui/profile-image-cropper.test.tsx src/features/profile/server/profile-read.functions.test.ts src/features/profile/server/user-search.functions.test.ts src/features/profile/shared/profile-contracts.test.ts src/features/profile/shared/user-search-contracts.test.ts src/routes/-root.test.tsx src/features/anime-detail/ui/anime-detail-page.test.tsx src/features/catalog-person/shared/catalog-person-contracts.test.ts src/features/catalog-person/ui/catalog-person-page.test.tsx src/features/catalog-person/ui/catalog-person-work-grid.test.tsx src/routes/_public/-catalog-person-route.test.ts
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $routeTree).Hash -ne $routeTreeHash) { throw 'Focused tests changed the protected route tree.' }
```

- [ ] **Step 3: Run full gates**

```powershell
$routeTree = (Resolve-Path -LiteralPath 'src/routeTree.gen.ts').Path
$routeTreeBackup = Join-Path ([System.IO.Path]::GetTempPath()) 'animex-phase7-feedback-routeTree.gen.ts.backup'
if (-not (Test-Path -LiteralPath $routeTreeBackup)) { throw 'Route-tree byte backup is missing.' }
$routeTreeHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $routeTreeBackup).Hash
pnpm exec tsc --noEmit
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $routeTree).Hash -ne $routeTreeHash) { throw 'TypeScript changed the protected route tree.' }
pnpm test
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $routeTree).Hash -ne $routeTreeHash) { throw 'Full tests changed the protected route tree.' }
pnpm build
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $routeTree).Hash -ne $routeTreeHash) { throw 'Build changed the protected route tree.' }
npx react-doctor@latest --verbose --scope changed
npx react-doctor@latest --score
```

Run Fallow against the immutable baseline:

```powershell
$fallowJson = pnpm exec fallow audit --base 3fdda5c --format json --quiet --explain 2>$null
$fallowExit = $LASTEXITCODE
$fallow = $fallowJson | ConvertFrom-Json
if ($fallowExit -eq 2) { throw "Fallow runtime error: $($fallow.message)" }
if ($fallow.kind -ne 'audit') { throw "Unexpected Fallow result kind: $($fallow.kind)" }
```

Expected: TypeScript, all tests, client/SSR build, and diff check pass; React Doctor does not regress from Task 1; Fallow has no blocking introduced issue. Fix root causes and rerun affected plus full gates.

- [ ] **Step 4: Push Convex only when source changed**

No Convex production file is planned. If an evidence-backed fix changes `convex/**`, run before browser QA:

```powershell
pnpm convex:dev --once
```

Expected: deployment succeeds. Never print environment or token data.

---

### Task 7: Independent Review And Live Browser QA

**Owner:** current repo TOML reviewer and QA. Read-only.

- [ ] **Step 1: Reviewer gate**

Reviewer checks accepted design line-by-line, server/auth boundaries, no weakened Convex authorization, no speculative runtime changes, avatar reuse, header account-menu composition, Profile containment, legacy Staff URL migration, cache identity stability, file sizes, and forbidden dirty files.

Verdict: `PASS` or `BLOCK` with concrete file/line findings. Fix every blocker, rerun affected tests, then request one final review.

- [ ] **Step 2: Browser QA with both accounts**

Use in-app Browser first. Use the two `AGENTS.md` QA accounts without echoing credentials.

At `390x844`, `768x1024`, and `1280x800`, verify:

- Account A owns a profile; Account B visits it as public and private viewer.
- Quick Search, `/search/users`, Profile header, and Home/feed show the same valid avatar; missing/broken avatar shows an initial with stable geometry.
- On `/` and `/home`, complete accounts show a 44 px avatar trigger instead of a standalone Sign out button; it stays contained at all three viewports.
- Header menu exposes exactly Profile and Sign out. Profile navigates to the active account username without document reload.
- Pointer plus keyboard open, Arrow/Enter, Escape, outside click, and focus return work. Sign out runs once, reaches `/home`, and the account can sign back in for remaining checks.
- Direct Activity, Reviews, and Favorites URLs never show `Checking authentication`.
- Tab click, back, forward, and refresh preserve header/support shell and avoid full-document navigation.
- signed-out/unverified/incomplete direct User routes redirect before protected DOM/query mount with validated `returnTo`;
- no horizontal page overflow, squeezed/deformed avatar, clipped name/bio, widened card, or undersized fallback glyph;
- Character and Staff use the shared detail composition and only Overview/Anime;
- Staff `?tab=works` replaces to `?tab=anime`, renders staff credits, and does not duplicate detail/work requests;
- keyboard tabs, focus, 44 px targets, reduced motion, empty/error/retry/end states remain valid.

- [ ] **Step 3: Clean console/server/network gate**

For every targeted flow, require zero:

- invalid-hook message;
- `QueryClientProvider` error;
- root not-found warning;
- hydration/uncaught error;
- `profiles:getByUsername` `Unauthenticated`;
- unexpected duplicate Profile/detail/work request.

Compare with the timestamped Task 1 evidence. Do not claim clean logs from a different route or account.

- [ ] **Step 4: Cleanup**

Close test-created browser sessions and stop only test-created Node/Convex processes/listeners. Preserve user processes.

---

### Task 8: Sync Current-State Docs And Close Feedback

**Files:**

- Modify: `docs/architecture/profile-data-flow.md`
- Modify: `docs/architecture/quick-search-data-flow.md`
- Modify: `docs/architecture/catalog-person-data-flow.md`
- Modify: `docs/architecture/anime-detail-data-flow.md`
- Modify: `CONTEXT.md`
- Modify: `PLAN.md`
- Modify: `TODO.md`
- Modify: `docs/superpowers/specs/2026-07-18-phase-7-feedback-fixes-design.md`
- Modify: `docs/superpowers/plans/2026-07-18-phase-7-feedback-fixes.md`

- [x] **Step 1: Update current truth**

- Profile doc: shared header AuthState, avatar owner-menu path, server `beforeLoad`, validated redirects, authenticated server read facades, mutation-only client Convex synchronization, SPA tabs, refetch/invalidation, and actionable auth errors.
- Quick Search doc: authenticated server User preview plus shared circular User avatar; catalog media unchanged.
- Catalog Person doc: common Overview/Anime URL contract, legacy Staff migration, shared detail layout, unchanged staff work/cache flow.
- Anime Detail doc: shared neutral page geometry with unchanged Anime-specific hero, tabs, controls, and sidebar.
- Trackers: mark only executed/tested items complete. Keep the four pre-existing browser fixture gaps separate unless this work actually verifies them.

- [x] **Step 2: Final docs/diff check**

```powershell
rg -n "Checking authentication|overview\\|works|Staff.*Works|tab=works" docs CONTEXT.md PLAN.md TODO.md
git diff --check
git status --short
```

Expected: legacy `works` appears only where its migration is documented/tested; no doc claims unrun validation; unrelated dirty files remain untouched.

- [x] **Step 3: Final docs commit**

```powershell
git add docs/architecture/profile-data-flow.md docs/architecture/quick-search-data-flow.md docs/architecture/catalog-person-data-flow.md docs/architecture/anime-detail-data-flow.md CONTEXT.md PLAN.md TODO.md docs/superpowers/specs/2026-07-18-phase-7-feedback-fixes-design.md docs/superpowers/plans/2026-07-18-phase-7-feedback-fixes.md
git commit -m "docs: close phase 7 feedback fixes"
```

## Rollback

1. Keep the root not-found boundary; it is independent and removes a confirmed warning.
2. If server auth routing fails, restore the last working route commit, not the visible `Checking authentication` gate. Fix the server-function error before re-enabling User routes.
3. If the header account menu fails, revert its consumer and minimal `DropdownMenuGroup` export together; retain the existing signed-out/incomplete actions and Better Auth sign-out path.
4. Revert shared detail-layout consumers together; never leave Anime or Catalog Person with missing required slots.
5. Keep Staff legacy `works` migration paired with the `overview|anime` contract.
6. Do not modify or delete Profile data, media, search projections, Catalog Person caches, or provider records for UI rollback.
7. Never roll back by weakening Convex authorization or suppressing runtime errors.

## Completion Checklist

- [x] Accepted design requirements map to implementation and browser evidence.
- [x] UserAvatar is the only AnimeX User identity renderer on changed surfaces.
- [x] Complete accounts have an accessible two-item avatar menu with a typed owner-Profile link and preserved Sign out behavior.
- [x] Profile auth resolves server-side before child render.
- [x] Profile tabs navigate without document reload or auth-loader flash.
- [x] Profile/User Search reads use authenticated server facades; client Convex identity gates mutations only.
- [x] All supplied log signatures are individually resolved by exact evidence.
- [x] Character/Staff use shared detail geometry and Overview/Anime only.
- [x] Staff work provider/cache identities are unchanged.
- [x] 390, 768, and 1280 checks pass with both QA accounts.
- [x] TypeScript, tests, build, React Doctor, Fallow, review, browser, and diff gates pass.
- [x] Unrelated dirty files and secrets remain untouched.

## References

- TanStack authenticated routes and `beforeLoad`: <https://tanstack.com/router/latest/docs/framework/react/guide/authenticated-routes>
- TanStack Start server functions: <https://tanstack.com/start/latest/docs/framework/react/guide/server-functions>
- TanStack Query SSR integration: <https://tanstack.com/router/latest/docs/integrations/query>
- TanStack not-found handling: <https://tanstack.com/router/latest/docs/guide/not-found-errors>
- shadcn Base UI dropdown menu: <https://ui.shadcn.com/docs/components/base/dropdown-menu>
- Base UI Menu navigation and keyboard API: <https://base-ui.com/react/components/menu>
