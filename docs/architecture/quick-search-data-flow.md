# Quick Search data flow

## Surface and request

Desktop header Search and mobile bottom Search tab share `QuickSearchProvider`. Signed-out/incomplete sessions search Anime, Characters, and Staff. Complete authenticated profiles also search Users. Manga remains future-only.

| Field | Current state |
| --- | --- |
| Entry | Desktop Base UI Dialog or mobile Base UI Drawer; one shared searchbox. |
| Input | Normalized 2–100 character query with 300 ms debounce. |
| Validation | `normalizeSearchQuery`, strict server Zod schemas, strict provider response schemas, and complete-profile auth gate for User results. |
| Transform | `searchQuickCatalog` makes one server AniList request for Anime/Character/Staff, ensures bounded catalog identities, and maps rows/destinations to opaque `publicId`. `searchUsersPreview` uses an authenticated server facade. |
| Storage | Catalog results stay client-only TanStack Query data with 60-second stale time. User previews read `userSearchDocuments`; no provider rows persist in Quick Search. |
| External calls | Server GET → AniList transport for catalog lanes; authenticated TanStack Start facade → Convex User Search. Browser never calls AniList or Convex directly for catalog search. |
| Retry | Bounded AniList timeout/three-attempt/short Retry-After policy. TanStack retries disabled; each lane exposes explicit Retry and preserves successful sibling lanes. |
| Error | Invalid/short query, strict parse, identity mapping, provider/auth, empty, and partial-success states remain explicit. No fabricated or stale provider fallback. |
| Output | Up to five Anime, Character, Staff, and eligible User rows. Catalog rows contain `publicId`, labels, media URL, slug/destination; User rows contain identity-only fields. |
| Owner | Server/contracts/UI: `src/features/quick-search`; User facade: `src/features/profile/server/user-search.functions.ts`; identity: `src/features/catalog-identity`; surface consumers: shell, landing, and auth routes. |

## Navigation and privacy

Request state is scoped by normalized query and complete profile ID; stale responses cannot render after rapid edits. On selection, `useCloseNavigation` closes the surface, clears query state, then navigates. View all remains provider-neutral: `/discover?q=`, `/search/characters?q=`, `/search/staff?q=`, `/search/users?q=`. Catalog rows use rectangular media; User rows use shared `UserAvatar`. No provider ID appears in UI props, hrefs, or client logs.

## Validation state

Identity materialization and cache-preserving server boundaries are implemented. Full tests, client scans, Fallow, React Doctor, integrated review, and responsive browser QA remain pending for this cutover.
