# Quick Search data flow

## Entry and surface ownership

`PublicShell` and `LandingPage` mount the shared public auth-state provider and `QuickSearchProvider`; `AuthPageShell` mounts the guest provider. Desktop header Search and the mobile bottom Search tab pass their trigger to the same search surface. Signed-out and incomplete sessions can search Anime, Characters, and Staff. Only a complete authenticated profile enables User results.

## Request contract

| Field | Current contract |
| --- | --- |
| Entry | Shared desktop header Search or mobile Search tab. |
| Input | One searchbox value normalized to 2–100 characters; 300 ms debounce. |
| Validation | `normalizeSearchQuery`, strict server-function schemas, strict provider response schemas, and complete-profile auth gate for Users. |
| Transform | `searchQuickCatalog` makes one server AniList request for Anime, Character, and Staff. `searchUsersPreview` makes an authenticated server read and returns identity-only User rows. |
| Storage | Catalog results are client-only TanStack Query data with 60-second stale time. User previews read `userSearchDocuments`; no Quick Search provider rows persist in Convex. |
| External calls | Server GET → `searchQuickCatalogFromAniList` → AniList; optional authenticated TanStack Start server function → `userSearch:searchPreview` through `getAuthProxy`. Browser never calls AniList directly. |
| Retry | Shared AniList transport uses bounded timeout/three-attempt retry with short `Retry-After`; TanStack retries are disabled. Catalog and User lanes expose separate Retry actions. |
| Error | Invalid input, strict parse failure, provider failure, User auth/provider failure, empty, and partial-success states remain explicit. A failed User lane does not erase successful catalog rows. |
| Output | Up to five rows each for Anime, Characters, Staff, and eligible Users, grouped with provider-neutral View all links. Destination navigation starts only after the overlay closes. |
| Owner | `src/features/quick-search/{server,shared,ui}`, `src/features/profile/server/user-search.functions.ts`, and shell/landing/auth route consumers. |

`useQuickSearch` scopes request state by normalized query and complete profile ID. A response renders only when its stored query still matches the current query, so rapid edits cannot display stale rows. Manga is not a group and remains future-only.

## User identity rendering

User rows use the shared circular `UserAvatar` instead of catalog media. Quick Search User rows use a 44×44 box (`md`); `/search/users` uses a 64×64 box (`search`). Missing and broken URLs use the same circular fallback geometry and one uppercase initial. Anime, Character, and Staff rows keep their existing rectangular media renderer.

## UI state and navigation

`useSearchSurface` selects Base UI Dialog at the existing `48rem` breakpoint and a Base UI-backed Drawer below it. Desktop keeps the input above an independently scrollable result region. Mobile keeps the result region scrollable and the search field pinned at the bottom above the safe-area inset; there is no full-height scroll trap.

The input owns ArrowUp/ArrowDown/Enter selection. Dialog/Drawer owns title/description, Escape, backdrop/close behavior, visible focus, and trigger restoration. Prompt, loading, partial success, empty, lane error, retry, and rapid-query status are announced by the existing model status/live region.

`useCloseNavigation` stores the selected destination, closes the active surface, waits for `onOpenChangeComplete(false)`, resets query state, then navigates. View all routes remain provider-neutral: Anime `/discover?q=`, Characters `/search/characters?q=`, Staff `/search/staff?q=`, Users `/search/users?q=`.

## Remaining browser-fixture gaps

- Injected provider or User failure flow.
- Deep result-page pagination beyond the exercised page.

The second-account private-profile scenario is closed and verified. Real media upload/crop/remove remains a Profile gap.
