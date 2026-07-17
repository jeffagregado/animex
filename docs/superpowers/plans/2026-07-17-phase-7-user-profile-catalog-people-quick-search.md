# Phase 7 User Profile, Catalog People, And Quick Search Implementation Plan

Status: WRITTEN. INDEPENDENT REVIEW PASS. USER APPROVAL PENDING. Implementation is unstarted.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Controlling Skill:** `$orchestrating-coding-work` owns role TOMLs, delegation, locks, review, QA, docs, and integration. The required executor above operates beneath those gates and cannot bypass them.

**Goal:** Ship signed-in User Profiles, public Character/Staff destinations, dedicated people/user result pages, and the locked desktop/mobile Quick Search experience without exposing Phase 9 social UI.

**Architecture:** Three feature verticals own their data and UI: `profile`, `catalog-person`, and `quick-search`. Additive Convex schema and shared contracts land first. Profile and Catalog Person then proceed on disjoint files. Dedicated result pages consume completed destinations. Quick Search consumes every destination and replaces shell Search links only after those routes pass. Shared schema, dependencies, generated files, shell navigation, migrations, and docs stay serialized under the controller.

**Tech Stack:** TanStack Start, TanStack Router, React 19, TanStack Query, Convex, Zod, Base UI, shadcn/ui, Tailwind CSS v4, `react-easy-crop`, Vitest, Testing Library, React Doctor, Fallow.

## Global Constraints

- Accepted contract: `docs/superpowers/specs/2026-07-17-phase-7-user-profile-quick-search-design.md`.
- Visuals:
  - `docs/visual/user-profile/user-profile-desktop-mobile.png`
  - `docs/visual/quick-search/quick-search-modal.png`
  - `docs/visual/quick-search/quick-search-mobile-drawer.png`
- Current `.codex/agents/orchestration_*.toml` files are authoritative. Do not copy settings from skill templates or override their model/reasoning settings.
- Use the controller-led task graph below. Delegate only bounded, disjoint files. Workers must not edit files owned by another active task.
- User Profiles and `/search/users` are signed-in-only. Keep existing protected Review-route redirects unchanged.
- `profileVisibility` is separate from content-default `visibility`. Phase 7 exposes only `public` and `private`.
- Preserve stored `followers` content visibility and Phase 9 backend contracts. Do not expose social controls, counts, placeholders, or Followers Profile Visibility.
- Profile tabs are URL state: `activity`, `reviews`, `favorites`; Activity is default.
- Character and Staff use positive provider-neutral IDs as identity. Slugs are display-only and canonicalized.
- Quick Search: trimmed 2–100 characters, 300 ms debounce, five rows per group, one provider request for Anime/Characters/Staff, optional signed-in Convex User request.
- Provider search is client-cached only. Person details/work pages use separate 24-hour Convex caches with leases and no stale fallback.
- Profile media source: JPEG/PNG/WebP, at most 10 MiB. Output: WebP, at most 2 MiB. Avatar is 512 × 512; banner is 1600 × 400.
- The approved new production dependency is `react-easy-crop`. Install no other production dependency without asking.
- Mobile Drawer must start from the official shadcn Base UI Drawer. Add no Vaul or Radix package. If the registry dry run proposes either, stop with the exact output.
- Use Base UI `render` props, not Radix `asChild`.
- Do not hand-edit `src/routeTree.gen.ts` or `convex/_generated/*`.
- Never read or print `.env`, `.env.*`, credentials, or secret values.
- Use real provider/Convex flows when practical. No silent fallback, fake content, or coverage-only tests.
- Keep React files focused: target 300 lines, review anything over 500, named exports, one main component per file.
- Each implementation task uses RED → GREEN → focused validation → commit.
- This plan does not authorize a production deployment. Production migration/deploy remains a separate explicit approval boundary.

Plan-level defaults awaiting approval with this plan:

- display name: trimmed 1–50 characters;
- bio: trimmed 0–300 characters;
- registered pending Profile Media expiry: one hour.

These are implementation limits, not revisions to the accepted visual/product contract.

## Locked Constants And Public Interfaces

```ts
export const PROFILE_BIO_MAX_LENGTH = 300
export const PROFILE_NAME_MAX_LENGTH = 50
export const PROFILE_CONTENT_PAGE_SIZE = 20
export const PROFILE_FAVORITES_PREVIEW_SIZE = 10
export const PROFILE_MEDIA_SOURCE_MAX_BYTES = 10 * 1024 * 1024
export const PROFILE_MEDIA_OUTPUT_MAX_BYTES = 2 * 1024 * 1024
export const PROFILE_MEDIA_PENDING_TTL_MS = 60 * 60 * 1000
export const CATALOG_PERSON_PAGE_SIZE = 20
export const CATALOG_PERSON_CACHE_TTL_MS = 24 * 60 * 60 * 1000
export const QUICK_SEARCH_MIN_LENGTH = 2
export const QUICK_SEARCH_MAX_LENGTH = 100
export const QUICK_SEARCH_DEBOUNCE_MS = 300
export const QUICK_SEARCH_GROUP_LIMIT = 5
export const SEARCH_RESULTS_PAGE_SIZE = 20
```

```ts
export type ProfileVisibility = 'public' | 'private'
export type ProfileTab = 'activity' | 'reviews' | 'favorites'
export type ProfileMediaKind = 'avatar' | 'banner'
export type CatalogPersonKind = 'character' | 'staff'
export type CatalogPersonTab = 'overview' | 'anime' | 'works'
```

Errors must be actionable and stable:

| Code | Meaning |
| --- | --- |
| `PROFILE_AUTH_REQUIRED` | Viewer lacks a complete authenticated AnimeX profile. |
| `PROFILE_NOT_FOUND` | Exact normalized username has no completed profile. |
| `PROFILE_PRIVATE` | A non-owner requested content hidden by Private Profile Visibility. |
| `PROFILE_EDIT_INVALID` | Name, bio, or Profile Visibility failed validation. |
| `PROFILE_MEDIA_INVALID` | Type, signature, dimensions, or byte size failed. |
| `PROFILE_MEDIA_NOT_OWNED` | Pending/current media is not owned by the viewer. |
| `PROFILE_MEDIA_ALREADY_CLAIMED` | Storage ID is pending or current for another Profile Media reference. |
| `PROFILE_MEDIA_EXPIRED` | Registered pending upload passed its expiry. |
| `PROFILE_MEDIA_CLEANUP_FAILED` | Failed registered media could not be deleted; manual investigation is required. |
| `USER_SEARCH_CORRUPT` | More than one search document exists for a user. |
| `CATALOG_PERSON_NOT_FOUND` | Provider has no requested person. |
| `CATALOG_PERSON_UNAVAILABLE` | Provider/cache refresh failed. |
| `QUICK_SEARCH_INVALID` | Query is outside 2–100 trimmed characters. |

## File Map

### Shared Data And Contracts

| File | Responsibility |
| --- | --- |
| `convex/schema.ts` | Additive profile, search, media, and Catalog Person tables/indexes; later required-field tightening. |
| `convex/users.ts` | New-profile defaults and User Search projection update on completion. |
| `convex/userSearch.ts` | Projection ownership, preview/full search, resumable backfill, verification. |
| `convex/profiles.ts` | Authenticated header/full profile projection and text/visibility edits. |
| `convex/profileMedia.ts` | Upload URL, pending registration, finalize, removal, cleanup mutations/actions. |
| `convex/profileMediaPolicy.ts` | WebP signature/dimension/size validation and media constants. |
| `convex/catalogPersonCache.ts` | Person detail/work-page cache and lease reads/writes. |
| `convex/catalogPersonCachePolicy.ts` | Cache keys, TTL, validators, expiry rules. |
| `convex/crons.ts` | Expired registered Profile Media cleanup schedule. |
| `convex/profile.integration.test.ts` | Profile visibility, content, edit, user search, migration coverage. |
| `convex/profileMedia.integration.test.ts` | Media ownership, replacement, removal, failure, cleanup coverage. |
| `convex/catalogPersonCachePolicy.test.ts` | Cache/lease/expiry contract coverage. |
| `src/features/profile/shared/profile-contracts.ts` | Profile tabs, edit, media, route-state contracts. |
| `src/features/profile/shared/profile-contracts.test.ts` | Profile contract coverage. |
| `src/features/catalog-person/shared/catalog-person-contracts.ts` | Provider-neutral search/detail/work contracts and canonical paths. |
| `src/features/catalog-person/shared/catalog-person-contracts.test.ts` | Strict parsing, paths, tabs, pagination coverage. |
| `src/features/quick-search/shared/quick-search-contracts.ts` | Query normalization, grouped result, destination contracts. |
| `src/features/quick-search/shared/quick-search-contracts.test.ts` | Query/group/path contract coverage. |

### Profile

| File | Responsibility |
| --- | --- |
| `src/routes/_public/_profile/route.tsx` | Complete-auth/Convex gate shared by Profile and User Search. |
| `src/routes/_public/_profile/users/$username.tsx` | Signed-in Profile route and tab validation. |
| `src/features/profile/ui/profile-page.tsx` | Responsive page composition and privacy states. |
| `src/features/profile/ui/profile-header.tsx` | Banner, avatar, identity, bio, owner action. |
| `src/features/profile/ui/profile-stats.tsx` | Four List Progress counts. |
| `src/features/profile/ui/profile-favorites.tsx` | Latest preview and paginated Favorites tab. |
| `src/features/profile/ui/profile-reviews.tsx` | Paginated source-backed Review cards. |
| `src/features/profile/ui/profile-activity.tsx` | Paginated active feed cards without social/owner action footer. |
| `src/features/profile/ui/edit-profile-dialog.tsx` | Fade-only text/visibility/media edit dialog. |
| `src/features/profile/ui/profile-image-cropper.tsx` | `react-easy-crop` interaction and preview. |
| `src/features/profile/ui/profile-media-canvas.ts` | Exact crop-to-WebP canvas output. |
| `src/features/profile/ui/profile-page.test.tsx` | Route/viewer/privacy/tab/content UI coverage. |
| `src/features/profile/ui/edit-profile-dialog.test.tsx` | Edit validation, cancel, progress, error coverage. |

### Catalog Person And Result Pages

| File | Responsibility |
| --- | --- |
| `src/features/catalog-person/server/anilist-person.server.ts` | Strict server-only provider adapter. |
| `src/features/catalog-person/server/catalog-person-cache.server.ts` | Read/lease/fetch/commit flow without stale fallback. |
| `src/features/catalog-person/server/catalog-person.functions.ts` | Validated serializable detail/work/search server functions. |
| `src/features/catalog-person/server/*.test.ts` | Provider normalization, cache, server-function coverage. |
| `src/routes/_public/characters/$id/route.tsx` | Character loader boundary. |
| `src/routes/_public/characters/$id/index.tsx` | Character canonical-slug redirect. |
| `src/routes/_public/characters/$id/$slug/route.tsx` | Character Overview/Anime route. |
| `src/routes/_public/staff/$id/route.tsx` | Staff loader boundary. |
| `src/routes/_public/staff/$id/index.tsx` | Staff canonical-slug redirect. |
| `src/routes/_public/staff/$id/$slug/route.tsx` | Staff Overview/Works route. |
| `src/features/catalog-person/ui/catalog-person-page.tsx` | Shared responsive Character/Staff detail composition. |
| `src/features/catalog-person/ui/catalog-person-work-grid.tsx` | 20-item automatic/visible Load more work grid. |
| `src/features/catalog-person/ui/catalog-person-search-page.tsx` | Shared Character/Staff dedicated result shell. |
| `src/routes/_public/search/characters.tsx` | URL-driven Character search. |
| `src/routes/_public/search/staff.tsx` | URL-driven Staff search. |
| `src/routes/_public/_profile/search/users.tsx` | Signed-in URL-driven User search. |
| `src/features/profile/ui/user-search-page.tsx` | User result shell and pagination. |
| `src/features/anime-detail/ui/anime-people-grid.tsx` | Character/Staff/Japanese VA links. |

### Quick Search And Shell

| File | Responsibility |
| --- | --- |
| `src/components/ui/drawer.tsx` | Local official shadcn Base UI Drawer adaptation; root owns swipe direction/handle. |
| `src/components/ui/drawer.test.tsx` | Primitive title/description/close/swipe/render coverage. |
| `src/features/quick-search/server/anilist-quick-search.server.ts` | One provider GraphQL request for three groups. |
| `src/features/quick-search/server/quick-search.functions.ts` | Validated public provider search server function. |
| `src/features/quick-search/server/*.test.ts` | Strict normalization, caps, explicit error coverage. |
| `src/features/quick-search/ui/quick-search-provider.tsx` | Open state, trigger focus return, query state. |
| `src/features/quick-search/ui/quick-search-dialog.tsx` | Desktop Base UI Dialog. |
| `src/features/quick-search/ui/quick-search-drawer.tsx` | Mobile Base UI Drawer and bottom field. |
| `src/features/quick-search/ui/quick-search-results.tsx` | Grouped semantic rows and keyboard navigation. |
| `src/features/quick-search/ui/use-quick-search.ts` | 300 ms debounce and provider/User request coordination. |
| `src/features/quick-search/ui/quick-search.test.tsx` | Prompt/loading/partial/error/keyboard/dismissal/stale-query coverage. |
| `src/features/shell/public-shell.tsx` | Mount Quick Search provider once. |
| `src/features/shell/site-header.tsx` | Pass Search open action. |
| `src/features/shell/header-auth-controls.tsx` | Search button and signed-in Profile destination. |
| `src/features/shell/mobile-bottom-navigation.tsx` | Search drawer action and signed-in Profile tab. |
| `src/features/shell/navigation.ts` | Remove obsolete Discover-hash Search destination contract. |
| `src/styles.css` | `body { position: relative; }` and overlay-safe global support only. |

### Generated, Docs, And Validation

| File | Responsibility |
| --- | --- |
| `package.json`, `pnpm-lock.yaml` | Approved `react-easy-crop` install only. |
| `src/routeTree.gen.ts` | Generated once after route sources stabilize. |
| `convex/_generated/*` | Generated by Convex after schema/functions stabilize. |
| `docs/architecture/profile-data-flow.md` | Current profile/search/media ownership and migration state. |
| `docs/architecture/catalog-person-data-flow.md` | Current provider/cache/search data flow. |
| `docs/architecture/quick-search-data-flow.md` | Current overlay/request/destination flow. |
| `docs/runbooks/profile-search-backfill.md` | Exact bounded backfill/verification procedure. |
| `docs/superpowers/checkpoints/2026-07-17-phase-7-start.md` | Immutable pre-Task-1 base SHA, feature branch, and React Doctor baseline score. |
| `CONTEXT.md`, `PLAN.md`, `TODO.md` | Current Phase 7 state. |

## Task Graph And Ownership

| Stage | Tasks | Parallel rule |
| --- | --- | --- |
| Foundation | 1–2 | Controller only; schema/contracts lock held. |
| Destinations | 3–7 Profile; 8–9 Catalog Person | Profile and Catalog Person may run in parallel only after Task 2 releases `convex/schema.ts`. |
| Discovery | 10 dedicated result pages; 11 provider Quick Search | Task 10 waits for Tasks 4 and 9. Task 11 may start after Task 8. |
| Overlay | 12 Drawer; 13 Quick Search UI | Drawer and server search can be prepared separately; UI consumes both. |
| Integration | 14 shell; 15 generation; 16 gates/docs/review/QA | Serialized controller work. |

Locks:

- `convex/schema.ts`: controller, Tasks 1–2 only.
- `package.json`, `pnpm-lock.yaml`: controller, Task 6 install step only.
- `src/routeTree.gen.ts`: controller, Task 15 only.
- `convex/_generated/*`: controller-owned throughout. Task 2 migration deploy may regenerate it locally; workers never edit or stage it. Task 15 stages the final integrated generation once.
- shell files and `src/styles.css`: controller/shared UI owner, Tasks 12 and 14 only.
- `docs/runbooks/profile-search-backfill.md`: Profile data worker/controller in Task 2.
- `docs/superpowers/checkpoints/2026-07-17-phase-7-start.md`: controller, Task 1 only.
- `CONTEXT.md`, `PLAN.md`, `TODO.md`, and architecture docs: docs mapper/controller, Task 16 only.
- Anime people grid: Catalog Person owner, Task 9 only.

Every delegated task must state owned files, forbidden locked files, consumed interfaces, validation, and commit SHA. Agents must use the installed role TOML config, not a template.

---

### Task 1: Lock Shared Contracts And Additive Schema

**Owner:** controller

**Files:**

- Create: `src/features/profile/shared/profile-contracts.ts`
- Create: `src/features/profile/shared/profile-contracts.test.ts`
- Create: `src/features/catalog-person/shared/catalog-person-contracts.ts`
- Create: `src/features/catalog-person/shared/catalog-person-contracts.test.ts`
- Create: `src/features/quick-search/shared/quick-search-contracts.ts`
- Create: `src/features/quick-search/shared/quick-search-contracts.test.ts`
- Create: `docs/superpowers/checkpoints/2026-07-17-phase-7-start.md`
- Modify: `convex/schema.ts`

**Interfaces:**

- Produces: constants/types in “Locked Constants And Public Interfaces.”
- Produces: `parseProfileTab`, `normalizeProfileEdit`, `parseProfileMediaSource`, `parseCatalogPersonId`, `slugifyCatalogPerson`, `createCatalogPersonPath`, `parseCatalogPersonTab`, `normalizeSearchQuery`, `createQuickSearchDestination`.
- Adds optional `users.bio`, `users.bannerStorageId`, and `users.profileVisibility`.
- Adds `userSearchDocuments`, `profileMediaUploads`, `catalogPersonDetails`, `catalogPersonWorkPages`, and `catalogPersonCacheLeases`.
- Adds `users.by_avatar_storage_id` and `users.by_banner_storage_id`; these prevent a Profile Media storage ID from becoming current for multiple users.
- Preserves: existing `users.visibility`, `animeDetailPeoplePages`, `followers` data, all existing indexes.

- [ ] **Execution setup: create the feature branch and immutable baseline**

From a clean `dev` worktree:

```powershell
git status --short
git switch -c jeff-cx/phase-7-user-profile-quick-search
git rev-parse HEAD
npx react-doctor@latest --score
```

Use `apply_patch` to record the exact 40-character pre-change SHA, branch name, and full React Doctor score in `docs/superpowers/checkpoints/2026-07-17-phase-7-start.md`. Never recompute or replace that SHA later. Stop if the worktree was dirty, the branch already exists, or either baseline command fails.

- [ ] **Step 1: Write failing strict-contract tests**

Cover:

```ts
expect(parseProfileTab(undefined)).toBe('activity')
expect(() => parseProfileTab('likes')).toThrow('PROFILE_TAB_INVALID')
expect(normalizeProfileEdit({ name: ' Mika ', bio: '  ', profileVisibility: 'public' }))
  .toEqual({ name: 'Mika', bio: null, profileVisibility: 'public' })
expect(parseCatalogPersonId('12')).toBe(12)
expect(createCatalogPersonPath('character', 12, 'Frieren')).toBe('/characters/12/frieren')
expect(normalizeSearchQuery('  frieren  ')).toBe('frieren')
expect(() => normalizeSearchQuery('a')).toThrow('QUICK_SEARCH_INVALID')
```

Also reject unknown Zod keys, unsafe IDs, non-HTTPS provider images, groups over five, result pages over 20, and illegal Character/Staff tab combinations.

- [ ] **Step 2: Run RED**

```powershell
pnpm test -- src/features/profile/shared/profile-contracts.test.ts src/features/catalog-person/shared/catalog-person-contracts.test.ts src/features/quick-search/shared/quick-search-contracts.test.ts
```

Expected: FAIL because the three contract modules do not exist.

- [ ] **Step 3: Implement complete provider-neutral contracts**

Use discriminated unions:

```ts
export type CatalogPersonDetail =
  | {
      kind: 'character'
      id: number
      name: string
      nativeName: string | null
      imageUrl: string | null
      description: string | null
      age: string | null
      gender: string | null
      birthday: string | null
      bloodType: string | null
    }
  | {
      kind: 'staff'
      id: number
      name: string
      nativeName: string | null
      imageUrl: string | null
      description: string | null
      occupations: string[]
      language: string | null
      hometown: string | null
      activeYears: string | null
    }
```

Define a provider-neutral `CatalogAnimeSummary` with `id`, `slug`, `title`, `coverImageUrl`, `format`, and `seasonYear`. Work rows are `{ anime: CatalogAnimeSummary; role: string | null }`; pages are exactly `perPage: 20`. Quick rows contain only `id`, label, optional image/metadata, and destination. Provider-specific field names stay inside AniList adapters/cache translation.

- [ ] **Step 4: Add migration-safe tables**

Use optional new `users` fields plus `by_avatar_storage_id` and `by_banner_storage_id`. `userSearchDocuments` has `.index('by_user', ['userId'])` plus `.searchIndex('search_users', { searchField: 'searchText' })`. Media has `by_storage`, `by_user`, and `by_expiry`. Person detail/work indexes are `[kind, personId]` and `[kind, personId, page]`; leases use `by_key`.

Store typed detail/work objects, not `v.any`, JSON strings, or raw provider payloads.

- [ ] **Step 5: Run GREEN and schema typecheck**

```powershell
pnpm test -- src/features/profile/shared/profile-contracts.test.ts src/features/catalog-person/shared/catalog-person-contracts.test.ts src/features/quick-search/shared/quick-search-contracts.test.ts
pnpm exec tsc --noEmit
```

Expected: focused tests PASS; TypeScript PASS.

- [ ] **Step 6: Commit**

```powershell
git add convex/schema.ts src/features/profile/shared src/features/catalog-person/shared src/features/quick-search/shared docs/superpowers/checkpoints/2026-07-17-phase-7-start.md
git commit -m "feat: lock phase 7 contracts"
```

### Task 2: Add User Search Projection And Safe Migration

**Owner:** Profile data worker for code/tests; controller owns schema, dev deployment, backfill, verification, and tightening

**Files:**

- Create: `convex/userSearch.ts`
- Modify: `convex/schema.ts`
- Modify: `convex/users.ts`
- Create: `convex/profile.integration.test.ts`
- Create: `docs/runbooks/profile-search-backfill.md`

**Interfaces:**

- Consumes: optional `profileVisibility`, `userSearchDocuments.by_user`, `search_users`.
- Produces: public `searchPreview({ query })` capped at 5 and `search({ query, paginationOpts })` at 20/page; internal-only `backfillProfiles` and `verifyProfiles`.
- Projection is `{ userId, searchText, updatedAt }`. Public results expose only `{ id, username, name, avatarUrl }`.
- Every public search requires `requireProfile`.
- Username completion writes `profileVisibility: 'public'` and the projection in the same mutation.
- Phase 7 adds no username editor. The projection helper consumes the current user record and must be called by every username write; current writers are Username Completion and the name edit in Task 5.

- [ ] **Step 1: Add RED Convex integration cases**

Cover new completion defaults, normalized name+username search, case-insensitive matches, signed-out rejection, private-profile identity result, no email/auth ID exposure, one document per user, idempotent backfill, verification mismatch IDs, and generated/public API absence for both maintenance functions.

- [ ] **Step 2: Run RED**

```powershell
pnpm test -- convex/profile.integration.test.ts
```

Expected: FAIL because `userSearch` functions and new defaults do not exist.

- [ ] **Step 3: Implement projection ownership**

`upsertUserSearchDocument(ctx, user)` must query `by_user`, throw `USER_SEARCH_CORRUPT` on two rows, normalize `name + " " + username` to lowercase single-space text, and insert/patch exactly one row.

Search must:

1. call `requireProfile`;
2. trim/lowercase and validate 2–100 characters;
3. use `withSearchIndex('search_users', q => q.search('searchText', query))`;
4. cap preview at 5 and paginate full results at 20;
5. hydrate current user identity and current storage URL;
6. omit deleted/missing profiles explicitly rather than returning stale projection text.

- [ ] **Step 4: Implement resumable migration**

Implement `backfillProfiles` and `verifyProfiles` with `internalMutation`; neither may be a public query/mutation/action. `backfillProfiles` paginates `users`, patches missing `profileVisibility` to `public`, and upserts the search document. Return:

```ts
{
  continueCursor: string
  isDone: boolean
  processedCount: number
  visibilityPatchedCount: number
  searchUpsertedCount: number
}
```

`verifyProfiles` returns missing visibility IDs, missing search IDs, duplicate search user IDs, and mismatched search user IDs. Any duplicate is corruption, not “first row wins.”

- [ ] **Step 5: Run GREEN**

```powershell
pnpm test -- convex/profile.integration.test.ts
pnpm exec tsc --noEmit
```

- [ ] **Step 6: Push additive schema/functions before UI work**

```powershell
pnpm exec convex dev --once
```

Expected: Convex codegen and one successful migration-safe dev deployment. No Profile reader/UI is deployed yet.

The controller inspects generated Convex API changes but leaves them locked for the final integrated generation in Task 15.

- [ ] **Step 7: Run bounded backfill to completion**

```powershell
pnpm exec convex run userSearch:backfillProfiles '{"paginationOpts":{"numItems":100,"cursor":null}}'
```

Repeat with the exact returned `continueCursor` until `isDone: true`. Record aggregate counts, not user identities.

- [ ] **Step 8: Verify every page**

```powershell
pnpm exec convex run userSearch:verifyProfiles '{"paginationOpts":{"numItems":100,"cursor":null}}'
```

Repeat by exact cursor. Require zero missing visibility IDs, missing search IDs, duplicate search user IDs, and mismatched search user IDs. Stop on any mismatch.

- [ ] **Step 9: Tighten only after zero mismatches**

Change only `users.profileVisibility` from optional to required; keep `bio` and `bannerStorageId` optional. Then:

```powershell
pnpm exec convex dev --once
pnpm exec tsc --noEmit
```

Expected: tightened dev schema deploys and TypeScript passes before any Profile reader/UI work starts.

- [ ] **Step 10: Commit**

```powershell
git add convex/schema.ts convex/users.ts convex/userSearch.ts convex/profile.integration.test.ts docs/runbooks/profile-search-backfill.md
git commit -m "feat: add profile search projection"
```

### Task 3: Build Profile Read And Content Queries

**Owner:** Profile data worker

**Files:**

- Create: `convex/profiles.ts`
- Modify: `convex/userAnime.ts`
- Modify: `convex/reviews.ts`
- Modify: `convex/feed.ts`
- Modify: `convex/profile.integration.test.ts`

**Interfaces:**

- Produces: `profiles.getByUsername`, `userAnime.listProfileFavorites`, `reviews.listForProfile`, `feed.listForProfile`.
- `getByUsername` returns `{ access: 'header' | 'full', owner, profile }`.
- Exact profile projection is `{ id, username, name, bio, avatarUrl, bannerUrl, profileVisibility }`; URL fields are `string | null`.
- Exclude content-default `visibility`, `avatarStorageId`, `bannerStorageId`, auth ID, email, and every raw user/auth document field.
- Full projection adds four progress counts and latest 10 favorite Anime summaries.
- Each content query accepts normalized username and independent cursor; 20 items/page.

- [ ] **Step 1: Add RED policy cases**

Cover owner full access, other-viewer Public full access, other-viewer Private header-only exact keys, signed-out rejection, missing username, absent progress = zero counts, newest 10 favorite preview, paginated favorite order/dedupe, public+owner-visible Reviews, active accessible feed cards only, deleted Review Activity not re-created, and explicit absence of content `visibility`, storage IDs, auth ID, email, and social fields.

- [ ] **Step 2: Run RED**

```powershell
pnpm test -- convex/profile.integration.test.ts
```

- [ ] **Step 3: Implement one shared access decision**

Create a private helper in `profiles.ts` that exact-looks up `usernameKey`, requires the viewer, computes `owner`, requires the post-verification `profileVisibility` field, and returns `header` for Private non-owner. Missing Profile Visibility after Task 2 is corruption and must fail explicitly. Export no raw user/auth record.

Every content query must call the same lookup/access helper or an exported internal typed helper. If access is `header`, return `PROFILE_PRIVATE` before reading content indexes.

- [ ] **Step 4: Implement indexed content lanes**

- Favorites: `by_user_favorite_at`, descending, ignore `favoriteAt: null`, hydrate `animeSummaries`.
- Reviews: `by_discovery_owner_newest`, published only, merge `public`, owner-only, and existing `followers` lanes through the current record-access helper; dedupe by Review ID and sort by stored order key. Phase 7 adds no Follow UI but preserves current stored relationships.
- Activity: `by_user_active_order`, `active: true`, resolve through existing feed source/access functions; never synthesize from Review sources.
- All cursors bind username/viewer/lane so a cursor cannot cross profiles or tabs.

- [ ] **Step 5: Run GREEN**

```powershell
pnpm test -- convex/profile.integration.test.ts
```

Expected: focused tests PASS. Controller defers integrated Convex generation/deploy to Task 15.

- [ ] **Step 6: Commit**

```powershell
git add convex/profiles.ts convex/userAnime.ts convex/reviews.ts convex/feed.ts convex/profile.integration.test.ts
git commit -m "feat: add profile data projections"
```

### Task 4: Build Signed-In Profile Route And Responsive UI

**Owner:** Profile UI worker

**Files:**

- Create: `src/routes/_public/_profile/route.tsx`
- Create: `src/routes/_public/_profile/users/$username.tsx`
- Create: `src/features/profile/ui/profile-page.tsx`
- Create: `src/features/profile/ui/profile-header.tsx`
- Create: `src/features/profile/ui/profile-stats.tsx`
- Create: `src/features/profile/ui/profile-favorites.tsx`
- Create: `src/features/profile/ui/profile-reviews.tsx`
- Create: `src/features/profile/ui/profile-activity.tsx`
- Create: `src/features/profile/ui/profile-page.test.tsx`

**Interfaces:**

- Consumes: Task 3 queries, public auth state, `resolveAuthReturnTo`, existing avatar/poster/Review/feed-card primitives.
- Produces: `/users/$username?tab=activity|reviews|favorites`.
- Pathless `_profile` layout blocks child queries until app auth and Convex auth are complete.

- [ ] **Step 1: Add RED route/UI integration tests**

Verify signed-out redirect includes validated relative `returnTo`; pending auth routes correctly; invalid tab replaces to Activity before tab query mount; owner Edit Profile action; Public full profile; Private header+notice; four stats; 10 latest favorites; independent loading/error/empty/end states; no Follow/Like/Comment/count/Anime List/Favorite Genres strings.

- [ ] **Step 2: Run RED**

```powershell
pnpm test -- src/features/profile/ui/profile-page.test.tsx
```

- [ ] **Step 3: Implement the auth gate**

Mirror the existing `_protected/route.tsx` auth/Convex readiness sequence, but signed-out destination is:

```ts
const resolved = resolveAuthReturnTo(currentRelativePath)
const returnTo = resolved.available ? resolved.path : '/home'
const encoded = encodeURIComponent(returnTo)

if (authState.status === 'signedOut') return `/auth/sign-in?returnTo=${encoded}`
if (authState.status === 'emailUnverified') return `/auth/verify-email?returnTo=${encoded}`
if (authState.status === 'needsProfile') return `/auth/username?returnTo=${encoded}`
```

Do not change `_protected` or Review behavior.

- [ ] **Step 4: Implement locked responsive composition**

Desktop: poster-forward banner/header with optional right support column. Mobile: same modules stacked. Missing banner uses AnimeX gradient; missing avatar uses `UserAvatar` initials. Render Activity default, Review cards without social footer, and Activity feed cards with owner/social actions disabled.

Use automatic next-page loading with a visible Load more button for each tab. Abort/dedupe stale cursor merges by document ID.

- [ ] **Step 5: Run GREEN**

```powershell
pnpm test -- src/features/profile/ui/profile-page.test.tsx
```

- [ ] **Step 6: Commit**

```powershell
git add src/routes/_public/_profile/route.tsx src/routes/_public/_profile/users src/features/profile/ui
git commit -m "feat: add user profile destination"
```

### Task 5: Add Profile Text And Visibility Editing

**Owner:** Profile UI/data worker; no media dependency edits yet

**Files:**

- Modify: `convex/profiles.ts`
- Modify: `convex/userSearch.ts`
- Modify: `convex/profile.integration.test.ts`
- Create: `src/features/profile/ui/edit-profile-dialog.tsx`
- Create: `src/features/profile/ui/edit-profile-dialog.test.tsx`
- Modify: `src/features/profile/ui/profile-page.tsx`

**Interfaces:**

- Produces: `profiles.update({ name, bio, profileVisibility })`.
- Name: trimmed 1–50. Bio: trimmed 0–300; empty stored as absent. Visibility: Public/Private.
- Name update and User Search projection update are one Convex transaction.
- Dialog is Base UI, fade-only; cancel performs no mutation.

- [ ] **Step 1: Add RED backend and dialog tests**

Cover owner-only mutation, stable field errors, trim/null normalization, search projection update, Public↔Private change, cancel, disabled/save progress, explicit failure, and focus return.

- [ ] **Step 2: Run RED**

```powershell
pnpm test -- convex/profile.integration.test.ts src/features/profile/ui/edit-profile-dialog.test.tsx
```

- [ ] **Step 3: Implement transactional edit**

Patch only changed fields, update `updatedAt`, and call the projection upsert after the user patch. Throw `PROFILE_EDIT_INVALID` with a field map. Do not accept username, auth ID, email, content `visibility`, avatar, or banner in this mutation.

- [ ] **Step 4: Implement fade-only dialog**

Use the existing Base UI Dialog parts. Override scale transforms so the popup only fades. Use TanStack Form/Zod consistent with auth forms. Keep media slots visible but disabled until Task 6 lands; do not show fake success.

- [ ] **Step 5: Run GREEN and commit**

```powershell
pnpm test -- convex/profile.integration.test.ts src/features/profile/ui/edit-profile-dialog.test.tsx
git add convex/profiles.ts convex/userSearch.ts convex/profile.integration.test.ts src/features/profile/ui
git commit -m "feat: add profile editing"
```

### Task 6: Add Profile Media Storage Lifecycle

**Owner:** controller for approved dependency install/lockfiles, then Profile Media worker for source/tests; serialized

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `convex/profileMedia.ts`
- Create: `convex/profileMediaPolicy.ts`
- Create: `convex/profileMedia.integration.test.ts`
- Modify: `convex/crons.ts`
- Modify: `convex/profiles.ts`

**Interfaces:**

- Produces: `generateUploadUrl({ kind })`, `registerPending({ kind, storageId })`, `finalize({ kind, storageId })`, `remove({ kind })`, internal `cleanupExpired`.
- Pending registration binds one storage ID to one user and purpose for one hour.
- A storage ID is claimable only when it is absent from both current-reference user indexes and every pending row.
- Finalize validates fetched bytes before reference swap. It deletes the old referenced asset only after the new reference commits.

- [ ] **Step 1: Install the already-approved dependency**

```powershell
pnpm add react-easy-crop
```

Expected: only `react-easy-crop` and its resolved lock entries change. Stop if another direct production dependency is proposed.

- [ ] **Step 2: Add RED storage-policy and integration tests**

Use deterministic byte fixtures. Cover valid avatar/banner WebP, wrong signature, wrong dimensions, >2 MiB, wrong owner, wrong purpose, duplicate registration, another user’s current avatar/banner claim, another user’s pending claim, expired registration, finalize-versus-new-reference race, cleanup-versus-finalize race, finalize failure deletes only an unreferenced invalid blob, successful swap deletes old blob after patch, exclusive removal, and cleanup limited to expired registered rows.

- [ ] **Step 3: Run RED**

```powershell
pnpm test -- convex/profileMedia.integration.test.ts
```

- [ ] **Step 4: Implement byte validation**

`parseWebpDimensions(bytes)` must validate RIFF/WEBP plus VP8, VP8L, or VP8X dimension headers and return exact integers. `validateProfileMedia(bytes, kind)` requires:

```ts
const expected = kind === 'avatar'
  ? { width: 512, height: 512 }
  : { width: 1600, height: 400 }
```

Reject non-WebP, malformed chunks, wrong dimensions, empty data, and output over 2 MiB with `PROFILE_MEDIA_INVALID`.

- [ ] **Step 5: Implement lifecycle and retries**

Finalization:

1. registration queries `profileMediaUploads.by_storage`, `users.by_avatar_storage_id`, and `users.by_banner_storage_id`; any pending/current match fails with `PROFILE_MEDIA_ALREADY_CLAIMED`;
2. authenticated internal query rechecks pending owner/kind/expiry and returns storage URL/current reference;
3. action fetches URL with three attempts and short bounded delays, warns before retries, throws last error;
4. validate bytes;
5. internal mutation rechecks pending ownership/expiry and that the new storage ID is still absent from both current-reference indexes, then patches the user reference and deletes the pending row;
6. before deleting any replaced/removed/failed/expired storage ID, remove the owned pending candidate when applicable, then re-query both current-reference indexes and other pending rows after the reference change; delete only when no other row claims it;
7. any pre-attachment fetch/validation failure runs internal cleanup of the registered storage and row before throwing the original explicit error;
8. if that cleanup itself fails, throw `PROFILE_MEDIA_CLEANUP_FAILED` with the original failure category preserved; never report cleanup success or hide the orphan.

Cleanup paginates only `profileMediaUploads.by_expiry`; every candidate is rechecked against pending ownership and both current-reference indexes inside the deletion mutation. Never scan or delete unrelated storage. Schedule daily in `crons.ts`.

- [ ] **Step 6: Run GREEN**

```powershell
pnpm test -- convex/profileMedia.integration.test.ts
```

Expected: focused media tests PASS. Controller defers integrated Convex generation/deploy to Task 15.

- [ ] **Step 7: Commit**

```powershell
git add package.json pnpm-lock.yaml convex/profileMedia.ts convex/profileMediaPolicy.ts convex/profileMedia.integration.test.ts convex/crons.ts convex/profiles.ts
git commit -m "feat: add profile media lifecycle"
```

### Task 7: Add Guided Avatar And Banner Crop UI

**Owner:** Profile UI worker

**Files:**

- Create: `src/features/profile/ui/profile-image-cropper.tsx`
- Create: `src/features/profile/ui/profile-media-canvas.ts`
- Create: `src/features/profile/ui/profile-media-canvas.test.ts`
- Modify: `src/features/profile/ui/edit-profile-dialog.tsx`
- Modify: `src/features/profile/ui/edit-profile-dialog.test.tsx`
- Modify: `src/features/profile/ui/profile-header.tsx`

**Interfaces:**

- Consumes: `react-easy-crop`, Task 6 lifecycle.
- Produces: cropped WebP Blob with exact dimensions and ≤2 MiB.
- Accepted source MIME/signature: JPEG, PNG, WebP; source ≤10 MiB.

- [ ] **Step 1: Add RED crop/output tests**

Cover source validation, crop rectangle math, avatar/banner dimensions, WebP MIME, bounded quality sequence, >2 MiB terminal error, null canvas blob error, upload/register/finalize order, replace/remove, and no mutation after cancel.

- [ ] **Step 2: Run RED**

```powershell
pnpm test -- src/features/profile/ui/profile-media-canvas.test.ts src/features/profile/ui/edit-profile-dialog.test.tsx
```

- [ ] **Step 3: Implement crop conversion**

Draw the selected pixel crop into a fixed output canvas. Encode WebP at qualities `0.92, 0.86, 0.80, 0.74, 0.68, 0.62`; return the first Blob ≤2 MiB. If every valid Blob is too large, throw `PROFILE_MEDIA_INVALID`. Do not upload the original source.

- [ ] **Step 4: Integrate accessible crop flow**

Support pointer, touch, wheel, keyboard pan/zoom, replace, remove, progress, retry, and explicit errors. Keep the cropper inside the fade-only dialog; no scale animation. Revoke object URLs on replacement, cancel, and unmount.

- [ ] **Step 5: Run GREEN and commit**

```powershell
pnpm test -- src/features/profile/ui/profile-media-canvas.test.ts src/features/profile/ui/edit-profile-dialog.test.tsx src/features/profile/ui/profile-page.test.tsx
git add src/features/profile/ui
git commit -m "feat: add profile image cropping"
```

### Task 8: Add Catalog Person Provider And Cache

**Owner:** Catalog Person server/cache worker

**Files:**

- Create: `convex/catalogPersonCache.ts`
- Create: `convex/catalogPersonCachePolicy.ts`
- Create: `convex/catalogPersonCachePolicy.test.ts`
- Create: `src/features/catalog-person/server/anilist-person.server.ts`
- Create: `src/features/catalog-person/server/anilist-person.server.test.ts`
- Create: `src/features/catalog-person/server/catalog-person-cache.server.ts`
- Create: `src/features/catalog-person/server/catalog-person-cache.server.test.ts`
- Create: `src/features/catalog-person/server/catalog-person.functions.ts`
- Create: `src/features/catalog-person/server/catalog-person.functions.test.ts`

**Interfaces:**

- Produces: `getCatalogPerson({ kind, id })`, `getCatalogPersonWorks({ kind, id, page })`, `searchCatalogPeople({ kind, query, page })`.
- Detail/work cache TTL: exactly 24 hours. Search: no persistent cache.
- Reuses current AniList client retries/errors and existing cache write token; adds no environment key.

- [ ] **Step 1: Add RED strict provider tests**

Cover Character/Staff detail normalization, optional metadata omission, 20 work rows, provider order preserved, search pages, malformed/extra provider fields, missing person, rate limit, invalid response, and no raw provider names in public types.

- [ ] **Step 2: Add RED cache tests**

Cover fresh read, expired refresh, lease winner, contention reread, lease release, 24-hour exact expiry, commit ownership, no stale return, explicit not-found, and explicit upstream/rate-limit state.

- [ ] **Step 3: Run RED**

```powershell
pnpm test -- convex/catalogPersonCachePolicy.test.ts src/features/catalog-person/server
```

- [ ] **Step 4: Implement provider adapter**

Use one strict GraphQL query shape per operation. Character works map media edges and character role; Staff works map staff-media edges and staff role. Normalize descriptions to display text using the existing Anime Detail description policy. Keep provider imports in `.server.ts`.

- [ ] **Step 5: Implement separate cache and leases**

Mirror Anime Detail lease semantics with keys:

```ts
`person:${kind}:${id}`
`person-work:${kind}:${id}:${page}`
```

Commit normalized person detail/work rows only. Work commits translate provider IDs while upserting referenced `animeSummaries`, then store ordered `{ animeId, role }` rows. Expired entries never become success output.

- [ ] **Step 6: Run GREEN and commit**

```powershell
pnpm test -- convex/catalogPersonCachePolicy.test.ts src/features/catalog-person/server
git add convex/catalogPersonCache.ts convex/catalogPersonCachePolicy.ts convex/catalogPersonCachePolicy.test.ts src/features/catalog-person/server
git commit -m "feat: add catalog person data flow"
```

### Task 9: Build Character And Staff Destinations

**Owner:** Catalog Person UI/route worker

**Files:**

- Create: `src/routes/_public/characters/$id/route.tsx`
- Create: `src/routes/_public/characters/$id/index.tsx`
- Create: `src/routes/_public/characters/$id/$slug/route.tsx`
- Create: `src/routes/_public/staff/$id/route.tsx`
- Create: `src/routes/_public/staff/$id/index.tsx`
- Create: `src/routes/_public/staff/$id/$slug/route.tsx`
- Create: `src/features/catalog-person/ui/catalog-person-page.tsx`
- Create: `src/features/catalog-person/ui/catalog-person-work-grid.tsx`
- Create: `src/features/catalog-person/ui/catalog-person-page.test.tsx`
- Modify: `src/features/anime-detail/ui/anime-people-grid.tsx`
- Modify: matching Anime Detail people-grid tests

**Interfaces:**

- Character query tab: `overview | anime`; Staff: `overview | works`.
- Index and wrong slug replace to `createCatalogPersonPath(kind, id, name)`.
- Work tabs load 20/page, auto-load and retain visible Load more.

- [ ] **Step 1: Add RED route/UI tests**

Cover canonical redirect, invalid ID/tab, Overview optional fields, missing-section empty state, Character Anime/Staff Works metadata, automatic+manual pagination, dedupe, loading/error/retry/end, and links from Character, Staff, and Japanese VA Anime Detail cards.

- [ ] **Step 2: Run RED**

```powershell
pnpm test -- src/features/catalog-person/ui/catalog-person-page.test.tsx src/features/anime-detail
```

- [ ] **Step 3: Implement loaders and canonical routes**

Parent route loads detail through TanStack Query. Index redirects after detail resolves. Slug route replaces wrong slug. Invalid tab replaces to Overview before a work request mounts.

- [ ] **Step 4: Implement shared visual composition**

Render portrait/themed gradient/name/native name/description and only available facts. Character Anime and Staff Works use fixed poster frames and canonical Anime paths. Keep provider ordering.

- [ ] **Step 5: Link Anime Detail people**

Derive canonical slugs from normalized display names. Link Character and Staff cards. Link only Japanese VA identity to `/staff/:id/:slug`; keep language text non-interactive.

- [ ] **Step 6: Run GREEN and commit**

```powershell
pnpm test -- src/features/catalog-person/ui/catalog-person-page.test.tsx src/features/anime-detail
git add src/routes/_public/characters src/routes/_public/staff src/features/catalog-person/ui src/features/anime-detail/ui
git commit -m "feat: add character and staff destinations"
```

### Task 10: Build Dedicated Character, Staff, And User Search Pages

**Owner:** Search result UI/route worker

**Files:**

- Create: `src/features/catalog-person/ui/catalog-person-search-page.tsx`
- Create: `src/features/catalog-person/ui/catalog-person-search-page.test.tsx`
- Create: `src/routes/_public/search/characters.tsx`
- Create: `src/routes/_public/search/staff.tsx`
- Create: `src/features/profile/ui/user-search-page.tsx`
- Create: `src/features/profile/ui/user-search-page.test.tsx`
- Create: `src/routes/_public/_profile/search/users.tsx`

**Interfaces:**

- URL contract: `?q=<trimmed query>`.
- Below 2 characters: prompt, no request. Maximum 100.
- Page size 20; canonical-ID dedupe; auto-load plus visible Load more.
- Character/Staff use Task 8 server search; Users use Task 2 authenticated Convex search.

- [ ] **Step 1: Add RED route/UI tests**

Cover URL restoration/back-forward, below-min prompt, max-length validation, 20-row page, dedupe, automatic/manual continuation, loading, empty, error, retry, end, canonical destinations, and signed-out User redirect.

- [ ] **Step 2: Run RED**

```powershell
pnpm test -- src/features/catalog-person/ui/catalog-person-search-page.test.tsx src/features/profile/ui/user-search-page.test.tsx
```

- [ ] **Step 3: Implement Reviews-geometry result shells**

Reuse layout geometry only; do not import Review filters/business logic. Query state remains in URL. Reset accumulated pages when normalized query changes. Preserve the currently successful page if only the next-page request fails, and expose retry for that page.

- [ ] **Step 4: Run GREEN and commit**

```powershell
pnpm test -- src/features/catalog-person/ui/catalog-person-search-page.test.tsx src/features/profile/ui/user-search-page.test.tsx
git add src/routes/_public/search src/routes/_public/_profile/search src/features/catalog-person/ui src/features/profile/ui
git commit -m "feat: add people and user search pages"
```

### Task 11: Add One-Request Provider Quick Search

**Owner:** Quick Search server worker

**Files:**

- Create: `src/features/quick-search/server/anilist-quick-search.server.ts`
- Create: `src/features/quick-search/server/anilist-quick-search.server.test.ts`
- Create: `src/features/quick-search/server/quick-search.functions.ts`
- Create: `src/features/quick-search/server/quick-search.functions.test.ts`

**Interfaces:**

- Produces: `searchQuickCatalog({ query })`.
- One GraphQL request has three aliased pages: Anime, Characters, Staff; each `perPage: 5`.
- Returns `{ anime, characters, staff }`, each at most five destination-ready rows.
- No User data, auth data, or persistent cache in the server function.

- [ ] **Step 1: Add RED tests**

Cover 2–100 validation, one transport call, three caps, canonical destinations, strict schema rejection, explicit rate-limit/upstream errors, and no Manga/User/raw provider fields.

- [ ] **Step 2: Run RED**

```powershell
pnpm test -- src/features/quick-search/server
```

- [ ] **Step 3: Implement strict one-request adapter**

Use one provider document with aliased `Page` fields. Parse the whole response strictly before normalization. Return one explicit provider error state for Anime/Characters/Staff; do not convert failed provider groups to empty arrays.

- [ ] **Step 4: Run GREEN and commit**

```powershell
pnpm test -- src/features/quick-search/server
git add src/features/quick-search/server
git commit -m "feat: add quick catalog search"
```

### Task 12: Add Official Base UI Drawer Primitive

**Owner:** Shared UI worker; controller owns `src/styles.css`

**Files:**

- Create: `src/components/ui/drawer.tsx`
- Create: `src/components/ui/drawer.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**

- Starts from: <https://ui.shadcn.com/docs/components/base/drawer>.
- Produces the current official Base UI export surface: `Drawer`, `DrawerTrigger`, `DrawerPortal`, `DrawerOverlay`, `DrawerContent`, `DrawerHeader`, `DrawerTitle`, `DrawerDescription`, `DrawerFooter`, `DrawerClose`, and `DrawerSwipeHandle`.
- Root `Drawer` accepts `showSwipeHandle: boolean` and `swipeDirection="down"`; `DrawerContent` remains structural.
- Forbidden writes: `package.json`, `pnpm-lock.yaml`, `components.json`, every existing UI primitive, and every file outside Task 12.

- [ ] **Step 1: Inspect registry before writing**

```powershell
pnpm dlx shadcn@latest info
pnpm dlx shadcn@latest docs drawer
pnpm dlx shadcn@latest add drawer --dry-run
```

Expected: Base UI implementation compatible with installed `@base-ui/react`, exact current exports above, and one proposed repo write: `src/components/ui/drawer.tsx`. If output proposes Vaul, Radix, any dependency/lockfile/config change, another component, or any unassigned file, stop and report; do not install or substitute.

- [ ] **Step 2: Add the registry component, then write RED adaptation tests**

```powershell
pnpm dlx shadcn@latest add drawer
git status --short
pnpm test -- src/components/ui/drawer.test.tsx
```

Expected write set remains `src/components/ui/drawer.tsx` plus the intentionally created test. If actual CLI writes differ from the dry run, stop without staging or editing those unexpected files. Expected RED: local requirements such as root `showSwipeHandle`, root `swipeDirection="down"`, accessible title/description, and downward dismissal are not yet all asserted/implemented.

- [ ] **Step 3: Adapt without changing primitive semantics**

Use Base UI `render` props. Keep backdrop, viewport, popup, title, description, close, and swipe handle. Set `showSwipeHandle` and `swipeDirection="down"` on the root Drawer. Add `body { position: relative; }`. Do not add `h-full` to the consumer scroll slot.

- [ ] **Step 4: Run GREEN and commit**

```powershell
pnpm test -- src/components/ui/drawer.test.tsx
git add src/components/ui/drawer.tsx src/components/ui/drawer.test.tsx src/styles.css
git commit -m "feat: add base ui drawer"
```

### Task 13: Build Quick Search Dialog, Mobile Drawer, And Coordination

**Owner:** Quick Search UI worker

**Files:**

- Create: `src/features/quick-search/ui/quick-search-provider.tsx`
- Create: `src/features/quick-search/ui/quick-search-dialog.tsx`
- Create: `src/features/quick-search/ui/quick-search-drawer.tsx`
- Create: `src/features/quick-search/ui/quick-search-results.tsx`
- Create: `src/features/quick-search/ui/use-quick-search.ts`
- Create: `src/features/quick-search/ui/quick-search.test.tsx`

**Interfaces:**

- Consumes: Task 2 User preview, Task 11 provider search, Task 12 Drawer, existing Base UI Dialog.
- Produces: `useQuickSearchControls()` with `openSearch(trigger)` and `closeSearch()`.
- Desktop field at top. Mobile field in footer above safe area/keyboard.

- [ ] **Step 1: Add RED interaction tests**

Cover initial prompt, 300 ms debounce, one provider request, signed-out User omission, signed-in User request/cap, provider failure with successful Users retained, User failure with provider results retained, loading/empty/retry/end, rapid query change, flattened ArrowUp/ArrowDown, Enter, Escape, click-close-before-navigation, focus return, title/description, aria-live status, and reduced motion.

- [ ] **Step 2: Run RED**

```powershell
pnpm test -- src/features/quick-search/ui/quick-search.test.tsx
```

- [ ] **Step 3: Implement request coordination**

Use TanStack Query for provider results with normalized query in the key, `enabled` only at 2–100 chars, `staleTime: 60_000`, and no persistence. Use the existing Convex client through a second TanStack Query for User preview, enabled only for complete app auth plus authenticated Convex state. Keep provider and User status independent and ignore responses for superseded queries.

- [ ] **Step 4: Implement semantic grouped results**

Flatten visible result rows for keyboard indexing. Each group is a labeled list with at most five rows and one View all destination:

```ts
anime -> `/discover?q=${encoded}`
characters -> `/search/characters?q=${encoded}`
staff -> `/search/staff?q=${encoded}`
users -> `/search/users?q=${encoded}`
```

Never render category rail, favorite/add, Follow, Manga, or social actions.

- [ ] **Step 5: Implement desktop/mobile shells**

Desktop: wide top-search Base UI Dialog. Mobile: root Drawer with `showSwipeHandle` and `swipeDirection="down"`, `flex min-h-0 flex-1 overflow-y-auto` results, and footer input using safe-area padding. Support close button, backdrop, Escape, and swipe down. Do not use `h-full` on results.

- [ ] **Step 6: Run GREEN and commit**

```powershell
pnpm test -- src/features/quick-search/ui/quick-search.test.tsx
git add src/features/quick-search/ui
git commit -m "feat: add responsive quick search"
```

### Task 14: Wire Shell Entry Points Last

**Owner:** controller

**Files:**

- Modify: `src/features/shell/public-shell.tsx`
- Modify: `src/features/shell/site-header.tsx`
- Modify: `src/features/shell/header-auth-controls.tsx`
- Modify: `src/features/shell/mobile-bottom-navigation.tsx`
- Modify: `src/features/shell/navigation.ts`
- Modify: matching shell tests

**Interfaces:**

- Desktop Search is a button opening the Dialog for every auth state.
- Mobile Search is a tab-like button opening the Drawer for every auth state.
- Signed-in complete mobile navigation: Home, Discover, Search, Create, Profile.
- Signed-out: Home, Discover, Search. No Create/Profile/User group.
- Signed-in Profile destination uses current complete auth username.

- [ ] **Step 1: Add RED shell tests**

Cover desktop signed-out/signed-in Search open, mobile Search open without route change, signed-in Profile path, signed-out omissions, five mobile items for complete auth, three mobile items otherwise, Search trigger focus return, and unchanged Create behavior.

- [ ] **Step 2: Run RED**

```powershell
pnpm test -- src/features/shell
```

- [ ] **Step 3: Mount provider and replace old links**

Mount one `QuickSearchProvider` inside `PublicAuthStateProvider`. Remove `/discover#discover-search` Search entries. Use buttons with existing visual classes and explicit `aria-label="Search"`. Keep Discover navigation unchanged.

- [ ] **Step 4: Run GREEN and commit**

```powershell
pnpm test -- src/features/shell src/features/quick-search/ui/quick-search.test.tsx
git add src/features/shell
git commit -m "feat: wire phase 7 navigation"
```

### Task 15: Integrate Convex And Routes, Then Generate Once

**Owner:** controller; no parallel writes

**Files:**

- Generated: `convex/_generated/*`
- Generated: `src/routeTree.gen.ts`

**Interfaces:**

- Consumes: verified/tightened Task 2 foundation and all later route/Convex sources.
- Produces: one final integrated Convex API generation/development deployment and route tree.

- [ ] **Step 1: Integrate source commits and inspect locked files**

Confirm Task 2 migration verification passed, `users.profileVisibility` is required, every destination source exists, and no worker edited generated files. Resolve source overlaps before generation.

- [ ] **Step 2: Generate and push the integrated Convex batch**

```powershell
pnpm exec convex dev --once
```

Expected: one successful development deployment and generated APIs for every integrated Convex module. This is not production deployment authorization.

- [ ] **Step 3: Generate routes once**

```powershell
pnpm generate-routes
```

Expected: route tree contains Profile, Character, Staff, and three search routes. Regenerate only after a route-source fix.

- [ ] **Step 4: Run generated-file checks and commit**

```powershell
pnpm exec tsc --noEmit
git diff --check
git add convex/_generated src/routeTree.gen.ts
git commit -m "chore: generate phase 7 routes and api"
```

### Task 16: Full Validation, Review, Browser QA, And Current-State Docs

**Owner:** controller + current-TOML reviewer + QA + docs mapper

**Files:**

- Create: `docs/architecture/profile-data-flow.md`
- Create: `docs/architecture/catalog-person-data-flow.md`
- Create: `docs/architecture/quick-search-data-flow.md`
- Modify: `CONTEXT.md`
- Modify: `PLAN.md`
- Modify: `TODO.md`
- Modify: Phase 7 spec/plan status only

**Interfaces:**

- Docs record current source truth, not a change log.
- Reviewer and QA are read-only and use their current `.codex/agents/*.toml`.
- Changed-code gates consume the immutable base SHA and React Doctor score recorded before Task 1; they never recompute a base from final `HEAD`.

- [ ] **Step 1: Run focused and full automated gates**

```powershell
$checkpoint = 'docs/superpowers/checkpoints/2026-07-17-phase-7-start.md'
$baseMatch = Select-String -LiteralPath $checkpoint -Pattern '^Base SHA: `([0-9a-f]{40})`$'
$scoreMatch = Select-String -LiteralPath $checkpoint -Pattern '^React Doctor full score: `([0-9]{1,3})`$'
if ($baseMatch.Matches.Count -ne 1 -or $scoreMatch.Matches.Count -ne 1) { throw 'Phase 7 baseline checkpoint is invalid.' }
$base = $baseMatch.Matches[0].Groups[1].Value
$baselineDoctorScore = [int]$scoreMatch.Matches[0].Groups[1].Value
$currentBranch = git branch --show-current
if ($currentBranch -eq 'dev') { throw 'Phase 7 validation must run on its feature branch.' }
git rev-parse "$base^{commit}"
if ($LASTEXITCODE -ne 0) { throw 'Phase 7 base commit is unavailable.' }
$changedFiles = @(git diff --name-only "$base..HEAD")
if ($changedFiles.Count -eq 0) { throw 'Phase 7 changed-file set is empty.' }
git diff --check "$base..HEAD"
pnpm exec tsc --noEmit
pnpm test
pnpm build
npx react-doctor@latest --verbose --scope changed
$doctorScore = [int](npx react-doctor@latest --score)
if ($doctorScore -lt $baselineDoctorScore) { throw 'React Doctor score regressed.' }
```

Resolve the audit base, then run the repository Fallow gate in machine-readable mode:

```powershell
$fallowJson = pnpm exec fallow audit --base $base --format json --quiet --explain 2>$null
$fallowExit = $LASTEXITCODE
$fallow = $fallowJson | ConvertFrom-Json
if ($fallowExit -eq 2) { throw "Fallow runtime error: $($fallow.message)" }
if ($fallow.kind -ne 'audit') { throw "Unexpected Fallow result kind: $($fallow.kind)" }
```

Expected: immutable-base changed set is non-empty; committed-range diff check, TypeScript, tests, and client+SSR build PASS; Fallow JSON has root `kind: "audit"` and no blocking new relevant issue (`0` clean, `1` findings to review, `2` runtime error); React Doctor changed scan runs and full score does not regress. Fix root causes and rerun affected plus full gates.

- [ ] **Step 2: Run live server/provider smokes**

Verify one Character detail/work page, one Staff detail/work page, one Character search, one Staff search, one Quick Search provider request, and signed-in User search against real local flows. Confirm no provider request exposes raw secrets and no provider search row persists in Convex.

- [ ] **Step 3: Browser QA at 390, 768, and 1280**

Use the in-app Browser first. Verify:

- signed-out Profile/User Search redirect and signed-out Quick Search without Users;
- owner, Public viewer, and Private viewer Profile;
- Activity/Reviews/Favorites URL tabs, independent pagination, empty/error/end;
- edit name/bio/visibility; avatar/banner crop, replace, remove, failure, retry;
- Character/Staff Overview/work tabs, canonical redirects, auto/manual pagination;
- dedicated Character/Staff/User result pages and back/forward query restoration;
- desktop keyboard/focus return and mobile touch/swipe/close/backdrop;
- bottom-pinned mobile field above keyboard/safe area; scroll region not clipped;
- prompt/loading/partial success/empty/error/retry/rapid-query-change;
- reduced motion, visible focus, touch targets, no horizontal overflow;
- clean console and expected network requests.

- [ ] **Step 4: Independent review**

Reviewer checks the accepted spec line-by-line, auth/privacy, storage ownership/cleanup, provider/cache boundaries, pagination/cursors, no Phase 9 UI, file sizes, and generated diffs. Verdict must be PASS or BLOCK with concrete file/line findings.

- [ ] **Step 5: Sync current-state docs**

Document profile visibility/access, media interruption window, pending-only cleanup boundary, User Search projection/migration totals, Catalog Person caches/leases, Quick Search partial-success behavior, routes, and owner files. Mark Phase 7 complete only after all gates and review pass.

- [ ] **Step 6: Final commit**

```powershell
git add docs/architecture CONTEXT.md PLAN.md TODO.md docs/superpowers/specs/2026-07-17-phase-7-user-profile-quick-search-design.md docs/superpowers/plans/2026-07-17-phase-7-user-profile-catalog-people-quick-search.md
git commit -m "docs: close phase 7"
```

## Rollback

1. Restore shell Search links/actions first so incomplete overlays are unreachable.
2. Disable new route entry points without deleting additive data.
3. Keep `profileVisibility`, search projection, cache rows, and pending-media records; they are inert without readers.
4. Never delete current/old Profile Media to roll back code. Only explicit ownership-aware lifecycle and cleanup may delete storage.
5. Do not rewrite `visibility: 'followers'` content or Phase 9 tables.
6. If a migration verification fails, leave `profileVisibility` optional, fix the exact mismatch, rerun from a null cursor, and tighten only after zero mismatches.

## Plan Self-Review Checklist

- [x] Every accepted design requirement maps to one task and one validation point.
- [x] Destination routes land before Quick Search shell entry points.
- [x] Profile access and content visibility are separate.
- [x] No raw auth/provider shape reaches UI contracts.
- [x] User search is authenticated, identity-only, full-text, projected, backfilled, and verified.
- [x] Scheduled media cleanup targets only registered expired uploads and rechecks every current/pending claim.
- [x] Character/Staff caches are separate from Anime Detail people edges.
- [x] Search and content cursors bind their lane/query/identity.
- [x] Drawer registry gate prevents Vaul/Radix or any unapproved dependency/config write.
- [x] `react-easy-crop` is the only approved dependency.
- [x] Generated files and docs have one serialized owner.
- [x] No unresolved marker, omitted implementation, fake data, silent fallback, or hand-edited generated file remains.

## Implementation Handoff

After plan approval, choose:

1. **Subagent-Driven (recommended):** controller executes this plan with current-TOML role agents, task-level review, shared locks, and integration gates.
2. **Inline Execution:** controller implements tasks sequentially in this task with the same RED/GREEN, migration, review, QA, and docs gates.

Do not implement before the user approves this plan and chooses an execution mode.
