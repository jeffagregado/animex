# Phase 7 Feedback Fixes Design Contract

Status: IMPLEMENTED AND VERIFIED. Final reviewer PASS and responsive browser QA confirm this contract; deep pagination remains the only unexercised browser fixture tracked in the Phase 7 checkpoint.

## Goal, Users, Surfaces

Fix visible identity, owner navigation, containment, auth-transition, and catalog consistency defects without redesigning AnimeX.

Users:

- signed-in owners and viewers opening `/users/:username`;
- signed-in users opening `/search/users` or User results in Quick Search;
- signed-in owners opening their own Profile from the shared header;
- public visitors opening Character or Staff details.

Affected surfaces:

- Quick Search User rows;
- `/search/users` result cards;
- complete-account header action and account menu;
- profile header, tabs, content cards, and support rail;
- `/users/:username` direct entry and tab navigation;
- Character and Staff detail headers, tabs, Overview, and Anime panels.

## Evidence

Primary supplied captures:

- `C:\Users\jeffa\AppData\Local\Temp\codex-clipboard-3ff75c37-b305-45d6-8162-bbe0e0cd310b.png` shows a 1463 x 821 desktop profile. Its large fallback avatar uses a tiny glyph, while profile content otherwise follows the accepted dark card language.
- `C:\Users\jeffa\AppData\Local\Temp\codex-clipboard-5b500773-9763-432f-81d5-e2808eecf39a.png` shows client `Invalid hook call`, `QueryClientProvider`, root not-found, and `profiles:getByUsername` `Unauthenticated` failures. Profile auth/query ordering is not safe.

Secondary locked references:

- `docs/visual/user-profile/user-profile-desktop-mobile.png`;
- `docs/visual/quick-search/quick-search-modal.png`;
- `docs/visual/quick-search/quick-search-mobile-drawer.png`;
- `docs/superpowers/specs/2026-07-17-phase-7-user-profile-quick-search-design.md`;
- `docs/superpowers/specs/2026-07-13-phase-4-anime-detail-layout-consistency-design.md`.

Current implementation evidence:

- `src/components/user-avatar.tsx` owns shared image failure, circular geometry, and size-specific fallback typography.
- Quick Search and `/search/users` route User rows through `UserAvatar`; catalog rows retain rectangular media.
- `src/features/shell/header-auth-controls.tsx` renders the complete-account `UserAvatar` trigger and exactly two menu items: Profile and Sign out.
- `src/routes/_public/_profile/route.tsx` resolves auth in `beforeLoad`; `src/features/profile/server/profile-read.functions.ts` and `user-search.functions.ts` own authenticated server reads.
- Profile tabs use TanStack Router navigation; successful mutations refresh server Profile data, while failed/cancelled mutations do not.
- `src/components/detail-page-layout.tsx` supplies neutral geometry to Anime Detail and Catalog Person; Character/Staff use Overview/Anime and migrate legacy Staff `works` to `anime`.
- `src/routes/__root.tsx` owns the AnimeX root not-found UI.

## Locked Visual Direction

- Keep deep ink/navy backgrounds, low-contrast borders, cyan interaction/focus color, coral restraint, bold identity type, fixed media frames, and current radii.
- Keep existing profile composition and content order. This is containment repair, not profile redesign.
- Reuse `UserAvatar` for every AnimeX user identity.
- Replace the complete-account header Sign out button with a `UserAvatar` account-menu trigger.
- Reuse Anime Detail layout geometry for Character and Staff. Do not create a third catalog-detail language.
- Add no generated, edited, downloaded, or replacement image/icon assets.

## Layout And Hierarchy

### Profile

Order stays:

1. banner and identity;
2. Activity, Reviews, Favorites tabs;
3. active content;
4. List Progress and Latest Favorites support content.

Header keeps banner, circular avatar, display name, username, bio, and owner-only Edit Profile. Missing banner keeps existing AnimeX gradient. Missing or failed avatar shows the initial fallback.

Desktop keeps active content as primary column and support rail as secondary column. Phone and tablet place support content after active content. Private-profile notice replaces hidden content without changing header geometry.

### Quick Search And User Search

- Anime, Character, and Staff rows keep rectangular media.
- User rows use circular `UserAvatar`.
- Quick Search keeps 44 px User avatars and current compact row height.
- `/search/users` keeps 64 px User avatars and current two-line identity card.
- Image success, missing URL, and broken URL use identical outer geometry. No empty circles.

### Header Account Menu

- Complete accounts show the shared 44 px `UserAvatar` as a circular header button; valid, missing, and broken images retain identical trigger geometry.
- Trigger opens the installed Base UI-backed shadcn `DropdownMenu`, aligned to the header edge and contained inside every target viewport.
- Menu contains exactly two grouped actions: `Profile` and `Sign out`.
- `Profile` is a typed TanStack link to `/users/$username` with no tab search value. It closes the menu and uses client navigation.
- `Sign out` reuses the current Better Auth action. While pending, its item is disabled and visibly busy; success navigates to `/home`; failure re-enables the item and reports the actionable error through the existing toast system.
- Signed-out state keeps `Sign in`. Email-unverified and needs-profile states keep direct `Sign out` because no completed Profile destination exists.
- Do not overwrite the existing dropdown component with the registry CLI. Extend only the minimal local Base UI-backed wrapper needed for grouped composition.

### Character And Staff

Reuse Anime Detail shell rules:

- same `max-w-[1480px]` page rhythm and responsive gutters;
- image-led hero with fixed portrait frame in the cover position;
- identity in the title/meta position;
- one stable tab rail immediately below hero;
- one active-panel slot; shell never remounts or shifts on tab change.

Do not copy Anime-only controls, metadata, or sidebar filler. Character/Staff Overview keeps About and provider-present facts. Anime keeps the existing poster grid, canonical Anime links, role metadata, loading, retry, pagination, and terminal states.

Both Character and Staff expose exactly:

1. Overview
2. Anime

`overview` is default. `anime` is the only second canonical tab value. Existing Staff `works` URLs replace to `anime`; other invalid values replace to `overview`.

## Avatar Contract

| Surface | Box | Shape | Fallback glyph |
| --- | ---: | --- | ---: |
| Header account trigger | 44 x 44 px | circle | 14 px |
| Quick Search User row | 44 x 44 px | circle | 14 px |
| `/search/users` card | 64 x 64 px | circle | 24 px |
| Profile phone | 96 x 96 px | circle | 36 px |
| Profile tablet/desktop | 128 x 128 px | circle | 48 px |

Rules:

- box always uses equal width/height, `aspect-ratio: 1`, `shrink: 0`, and overflow clipping;
- image always fills box with `object-fit: cover`;
- image intrinsic dimensions never alter row, card, or header size;
- fallback uses one uppercase initial or `?`, line-height 1, heavy weight, and exact centering;
- fallback occupies roughly 38% of profile-avatar diameter;
- broken image switches to fallback without size, border, focus, or layout shift;
- profile cyan ring stays circular and does not count toward content diameter.

## Responsive And Overflow Rules

| Viewport | Profile | Quick Search / User search | Character / Staff |
| --- | --- | --- | --- |
| 390 x 844 | 16 px gutters; stacked header; 96 px avatar; one content column; support cards follow active content | drawer; 44 px User rows; `/search/users` one column with 64 px avatars | one-column hero/content; portrait remains 2:3; two equal tabs; Anime grid starts at two columns |
| 768 x 1024 | 24 px gutters; 128 px avatar; identity row may wrap; one main flow; support cards stay contained below | desktop dialog at existing 48 rem breakpoint; `/search/users` two columns | hero uses portrait/title relationship from Anime Detail; two equal tabs; Anime grid uses three columns when labels fit |
| 1280 x 800 | 40 px gutters within 1480 px cap; 128 px avatar; identity and Edit Profile share row; main/support split | wide dialog within 94 vw/64 rem; `/search/users` two columns | stable Anime Detail-width shell; Overview uses readable About/Facts split; Anime grid uses four or five columns |

Containment:

- page never scrolls horizontally;
- header logo, Search, and 44 px account trigger stay on one contained row at 390 px; menu aligns to the viewport-safe inline end;
- every flex/grid text child uses `min-width: 0`;
- display name, username, and bio wrap with `overflow-wrap: anywhere`; profile identity is not ellipsized;
- Quick Search and result-card labels may visually truncate, but full text remains in accessible name/content;
- profile tabs stay one contained row at 390 px; below available width, only tab rail may scroll;
- Character/Staff two-tab rail uses equal columns and never page-scrolls;
- card grids use `minmax(0, 1fr)`;
- poster/portrait/avatar frames keep fixed aspect ratio;
- titles clamp to two lines where card height depends on alignment; metadata wraps or clamps inside card;
- long unbroken valid identity text, long Anime titles, translated names, and large numeric counts cannot widen parent.

## Server-Auth-First Behavior

Profile route auth resolves on server before profile UI/query mount.

- Signed out: server redirect to sign-in with validated `returnTo`.
- Email unverified or missing profile: server redirect to existing completion route with validated `returnTo`.
- Complete identity: hydrate route/shared auth state from server result, then render profile shell or profile-data skeleton immediately.
- Auth-state failure: render actionable `Authentication unavailable`; never pretend signed out.
- Client/Convex disagreement after a complete server result: keep authenticated server-read Profile content visible, but disable edit/media controls with an explicit retry/error state until Convex identity agrees.

Forbidden:

- `Checking authentication…` page on direct profile visit;
- auth-check page on Activity/Reviews/Favorites changes;
- browser-side `profiles:getByUsername` query before authenticated Convex identity;
- full profile-shell remount during tab change;
- auth provider/query-client duplication across profile navigation.

Tab changes reuse hydrated auth state, preserve header/support geometry, update URL/history, and load only selected panel data. Direct tab URLs, refresh, back, and forward follow same behavior.

## States And Interaction

- Profile data loading: dimension-preserving profile skeleton; no auth wording.
- Profile empty/private/error: existing explicit card language; private keeps identity visible.
- Avatar loading/failure: fixed box; failure becomes initial without flash-induced reflow.
- Quick Search: prompt, loading, partial success, empty, provider error, User error, retry, active row, close, and navigation stay intact.
- `/search/users`: prompt, loading, empty, initial error, pagination error, retry, loading-more, and end states stay intact.
- Catalog: loading skeleton/state preserves hero/tab origin; not-found, error/retry, empty Overview section, empty Anime, loading-more, pagination error, and end states remain explicit.
- Successful Quick Search selection closes surface before navigation.
- Header account menu supports pointer and keyboard open, Arrow navigation, Enter selection, Escape close, outside-click close, and focus return to the avatar trigger.
- Catalog tab changes change active state and panel only.

## Accessibility

- `UserAvatar` keeps a meaningful image label for image and fallback; broken-image state exposes one identity image, not duplicate names.
- Header avatar trigger has a clear account-menu name independent of the image label; menu items expose `Profile` and `Sign out` once each.
- All interactive targets remain at least 44 x 44 CSS px.
- Visible focus uses existing cyan ring with sufficient contrast.
- Profile links and User result cards have one clear accessible destination name.
- Tablists use `tab`, `tabpanel`, `aria-selected`, `aria-controls`, roving `tabIndex`, Arrow Left/Right, Home, and End.
- Loading uses `aria-busy`; errors use `role="alert"`; status changes use existing live-region behavior.
- Skeleton motion stops under reduced motion.
- Color never carries selected, error, or loading meaning alone.

## Reuse Boundary

Reuse:

- `src/components/user-avatar.tsx`;
- installed `src/components/ui/dropdown-menu.tsx` Base UI/shadcn foundation;
- existing shared auth state, Better Auth sign-out action, TanStack Profile route, and Sonner toaster;
- existing profile header, tabs, cards, stats, and favorites;
- existing Quick Search dialog/drawer and result grouping;
- existing Anime Detail container, hero/media proportions, tab rail, focus behavior, and stable-panel model;
- existing `AnimeImage`, poster grid, Button/Dialog/Drawer primitives, Tailwind tokens, and CSS variables.

Do not add a new avatar component, account-menu primitive, catalog shell, tab component family, CSS theme, production dependency, or asset.

## Asset Manifest

| Path | Purpose | Source / method | Dimensions | Alt guidance | Provenance |
| --- | --- | --- | --- | --- | --- |
| supplied profile capture in Temp path above | defect evidence only | user screenshot; inspect only | 1463 x 821 | not shipped | user-supplied temporary evidence |
| supplied error-log capture in Temp path above | auth/runtime evidence only | user screenshot; inspect only | 1215 x 926 | not shipped | user-supplied temporary evidence |
| `docs/visual/user-profile/user-profile-desktop-mobile.png` | locked profile composition | reuse unchanged | 1536 x 1024 | `User Profile desktop and mobile` in design docs only | existing repo-approved reference |
| `docs/visual/quick-search/quick-search-modal.png` | locked desktop search language | reuse unchanged | 1586 x 992 | `Quick Search desktop modal` in design docs only | existing repo-approved reference |
| `docs/visual/quick-search/quick-search-mobile-drawer.png` | locked mobile search language | reuse unchanged | 852 x 1846 | `Quick Search mobile drawer` in design docs only | existing repo-approved reference |

No asset output is approved or required.

## Acceptance Criteria

1. Quick Search User rows and `/search/users` cards render `UserAvatar`; valid, missing, and broken URLs preserve exact geometry.
2. Complete-account header renders a 44 px `UserAvatar` trigger instead of a standalone Sign out button.
3. Header menu contains exactly `Profile` and `Sign out`; Profile routes to the authenticated username without document reload.
4. Header menu supports keyboard navigation/focus return, disables duplicate sign-out while pending, preserves current success navigation, and reports failure through the existing toaster.
5. Profile fallback glyph renders at 36 px inside 96 px phone avatar and 48 px inside 128 px tablet/desktop avatar.
6. Every user avatar is circular, square, non-shrinking, clipped, and `object-cover`; no portrait stretches or deforms at matrix viewports.
7. Profile identity, tabs, active cards, stats, favorites, and owner action stay inside viewport for maximum valid stored text and long unbroken test text.
8. Direct signed-in visits to each profile tab render profile skeleton/content without `Checking authentication…`.
9. Activity, Reviews, and Favorites changes never show auth loader, remount shell, or issue browser-side Profile reads while Convex is unauthenticated.
10. Signed-out/incomplete direct visits redirect server-side with validated `returnTo`; settled auth errors show actionable error.
11. Required profile flows emit none of supplied log failures: no invalid-hook, QueryClientProvider, route not-found warning, hydration, uncaught runtime, or Convex `Unauthenticated` error.
12. Character and Staff use Anime Detail layout language and expose only Overview and Anime. Staff `works` canonicalizes to `anime`.
13. Catalog tab click, keyboard navigation, direct URL, refresh, back, and forward update active tab/panel without moving hero or tab rail.
14. At 390 x 844, 768 x 1024, and 1280 x 800: no horizontal page overflow, clipping, overlap, deformed media, unreadable label, or target below 44 x 44 px.
15. Keyboard focus, screen-reader names, loading, empty, private, error, retry, broken-image, and success states meet this contract.

## Open Decisions

None. Product direction, visual language, avatar reuse, header account menu, no-asset boundary, server-auth-first behavior, responsive matrix, and Overview/Anime tabs are locked.
