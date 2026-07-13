# Phase 4 Anime Detail Layout Consistency

## Goal

Use one stable Anime Detail shell across Overview, Reviews, Characters, and Staff. Tab selection changes active state and main tab content only.

## Canonical Reference

`docs/visual/anime-details/anime-details-staff-desktop-frieren.png` owns desktop shell layout.

All other Anime Detail images provide tab-content direction only. When header, hero, metadata, controls, tabs, sidebar, spacing, or navigation conflicts with canonical reference, canonical reference wins.

## Shared Desktop Shell

Canonical shell uses taller image-led banner. Poster, title, metadata, and controls sit over lower gradient. No separate controls card.

- Main column uses roughly three quarters of available width.
- Right sidebar uses remaining quarter with narrow fixed gutter.
- Header shows AnimeX, Home, Discover, centered search, notifications, and account avatar. Community and Stats stay absent.
- Control order is Status, Score, Favorite. Write Review stays hidden until Phase 5. Rewatch History stays owner-only.
- Cyan marks interactive state and selected values; coral remains reserved for future Write Review.
- Tab order stays Overview, Reviews, Characters, Staff. Active tab changes cyan text and underline only.
- Active content begins at same vertical origin below tab divider on every tab.

Changing tabs must not shift header height, hero height, cover position, title position, synopsis width, control geometry, tab position, sidebar width, or sidebar section order.

## Shared Desktop Sidebar

Sidebar stays visible and unchanged on all four tabs:

1. Related Anime
2. Recommendations
3. Trailer
4. External Links

Each section uses compact rows: poster, metadata, and chevron. Trailer uses thumbnail with play overlay. External links are flat links, not cards. Tab changes must not replace sidebar with poster rails or alter its order/width.

## Tab Content

### Overview

Show metadata fields only in main content. Use balanced label/value rows. Related titles, recommendations, trailer, and external links remain sidebar content.

### Reviews

Use main-column width from canonical shell. First row contains average Review Rating, score distribution, review count, and sort control. Review cards follow in responsive two-column desktop grid. Each card shows avatar, author, Review Rating, required summary, body preview, date, and helpful count.

### Characters

Use canonical three-column desktop grid. Cards share equal height and width. Each card shows character portrait, name, story role, voice actor identity, and language. Grid begins at same content origin as other tabs.

### Staff

Keep canonical Primary Production label and three-column grid. Each card shows staff portrait, name, and production role. This tab remains geometry source for Character and Staff grid cards.

## Responsive Translation

Mobile is one responsive translation of canonical desktop shell, not separate tab-specific redesign.

- Header, hero, cover/title relationship, metadata order, controls, tabs, and bottom navigation stay identical across tabs.
- Desktop sidebar leaves side column and moves below active tab content in same Related Anime, Recommendations, Trailer, External Links order.
- Mobile hero keeps image-led banner and lower-gradient poster/title/meta/control composition. No separate controls card.
- Mobile sidebar appears after tab content.
- Tabs remain Overview, Reviews, Characters, Staff with one cyan active state.
- Reviews use single-column cards.
- Characters and Staff use two-column cards when labels remain readable; use one column below that threshold.
- Overview uses one readable label/value list.
- Bottom navigation always shows Home, Discover, Search, Create, Profile.
- No horizontal page overflow. Touch targets remain at least 44 by 44 CSS pixels.

Mobile tab changes must not replace header controls, change hero composition, reorder user controls, rename tabs, or change bottom navigation.

## Controls And State Rules

- Public controls expose only Status, Score, and Favorite as auth/profile redirect facades. Signed-out facades link to auth/profile return flow.
- Unresolved auth state renders disabled facades. Settled auth errors or public/Convex disagreement show an actionable refresh error. No real Select, NumberField, private query, or mutation mounts in unresolved/public/error mode.
- Signed-in users get real controls. Status and Score autosave with 500 ms trailing debounce; valid blur or Enter flushes pending value.
- Score accepts 0-10 in 0.5 steps; direct non-half-step input restores the last valid draft, cancels pending saves, and shows an accessible error. Clear persists null. Favorite saves immediately.
- Sonner confirms success and surfaces errors with Retry. Retry must report failure when retry fails.
- Rewatch History and Rewatch Complete controls remain owner-only. Write Review remains hidden until Phase 5.

## Content And State Rules

- AniList ID remains canonical anime identity.
- Full metadata hydrates on first detail-page open.
- Missing or stale slug redirects to canonical slug before stable page render.
- Signed-out users do not see Write Review or owner-only Rewatch History.
- Rewatch History and count remain owner-only.
- Loading, error, empty, and unavailable-image states preserve shell dimensions to avoid layout jumps.
- Tab state must remain linkable and keyboard accessible without duplicating page shell.

## Implementation Boundary

Build one shared Anime Detail layout. Render hero, controls, tabs, and sidebar once. Route/tab content fills one main-content slot. Do not build four independent page shells.

Use TanStack Router file-based route conventions. Shared or protected route layout uses `route.tsx`. Keep route files focused; place Anime Detail domain UI under `src/features/anime-detail/` and app-wide primitives under `src/components/`.

No heavy Convex action path. Convex owns authentication, authorization, validation, mutations, stored user anime data, and storage. AniList metadata fetching stays server-side through TanStack Start server functions when external fetch is necessary.

## Acceptance

- One desktop shell matches Staff desktop reference across all tabs.
- Only active tab state and main tab content change during tab navigation.
- Sidebar content, order, size, and placement stay stable on desktop.
- Mobile uses one shared responsive shell and stable bottom navigation.
- Reviews, Characters, and Staff retain approved content without importing conflicting shell layouts.
- No layout shift, clipping, overlap, horizontal overflow, hydration error, or console error at 390, 768, and 1280 pixels.
- Keyboard tab navigation, focus visibility, browser back/forward, direct tab links, loading, error, and empty states work.

Status: APPROVED.
