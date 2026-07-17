# Quick Search data flow

## Entry and surface ownership

`PublicShell` and `LandingPage` mount `PublicAuthStateProvider` + `QuickSearchProvider`; `AuthPageShell` mounts `GuestQuickSearchProvider`. Desktop header Search and mobile bottom Search pass the trigger element to the provider. Complete authenticated profiles enable User results only when Convex auth is also ready. Signed-out and incomplete-profile sessions still get Anime/Characters/Staff search, never Users.

## Request contract

| Field | Current contract |
| --- | --- |
| Entry | Shared desktop header Search or mobile Search tab. |
| Input | Raw text from the single searchbox; trim to 2–100 characters. |
| Validation | `normalizeSearchQuery`, strict server-function schemas, and strict provider/User response schemas. Debounce is 300 ms. |
| Transform | One AniList GraphQL operation maps Anime, Character, and Staff rows to capped destination-ready groups. Optional Convex full-text User preview maps identity-only rows. |
| Storage | Provider results are client-only TanStack Query data (`staleTime` 60 seconds). User search reads `userSearchDocuments`; no provider search rows persist in Convex. |
| External calls | `searchQuickCatalog` server GET → `searchQuickCatalogFromAniList` → AniList; optional `userSearch:searchPreview` Convex query. |
| Retry | AniList shared transport uses bounded three-attempt/timeout and short `Retry-After` behavior. TanStack retries are disabled; each provider/User lane has an explicit Retry action. |
| Error | Provider and User lanes expose independent sanitized errors. Partial success remains visible; invalid query, malformed payload, empty, and upstream failures never create fake rows. |
| Output | At most five Anime, Character, Staff, and eligible User rows, grouped with View all links; destination selection navigates only after close completion. |
| Owner | `src/features/quick-search/{server,shared,ui}`, `src/features/shell`, `src/features/landing`, `src/features/auth`, and related route contracts. |

`useQuickSearch` keeps request data scoped by query and auth profile ID. A response is rendered only when its stored query equals the current normalized query, preventing stale rapid-query results. The provider lane returns all three public groups in one request. User preview is optional and capped at five; its error does not erase successful catalog groups. Manga is not a group.

## UI state and navigation

`useSearchSurface` chooses Base UI Dialog at `min-width: 48rem` and Base UI-backed Drawer below it. Desktop keeps the input above an independently scrollable result region. Mobile uses the Drawer swipe handle/down dismissal, independently scrollable results, and a footer field above the safe-area inset; no `h-full` scroll trap.

The input keeps DOM focus and owns roving ArrowUp/ArrowDown/Enter selection. Dialog/Drawer supplies accessible title/description, Escape/backdrop/close behavior, visible focus, and trigger focus restoration. Prompt, loading, partial-success, empty, error, retry, and rapid-query states are announced through the model status and rendered lane states.

`useCloseNavigation` stores the selected destination, closes the active surface, waits for `onOpenChangeComplete(false)`, resets query state, then navigates. Result selection therefore cannot leave an open overlay mounted over the destination. View all paths are provider-neutral: Anime `/discover?q=`, Characters `/search/characters?q=`, Staff `/search/staff?q=`, Users `/search/users?q=`; entity rows use canonical Anime, Character, Staff, or User paths.

## Failure boundaries

Server/provider failures are sanitized to AniList `UPSTREAM` or `RATE_LIMITED`; strict Zod parse failures become explicit upstream errors. Convex User search requires a complete verified profile and returns `INVALID_SEARCH_QUERY` for invalid input. No auth fallback promotes Users into signed-out search. No stale cache, raw provider shape, or silent substitution is allowed.

## Verification gaps

- [ ] Injected provider/User failure lane browser flow.
- [ ] Deep result-page pagination beyond the exercised page.
