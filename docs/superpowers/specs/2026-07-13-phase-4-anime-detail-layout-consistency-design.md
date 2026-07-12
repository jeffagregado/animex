# Phase 4 Anime Detail Layout Consistency

## Goal

Use one stable Anime Detail shell across Overview, Reviews, Characters, and Staff. Tab selection changes active state and main tab content only.

## Canonical Reference

`docs/visual/anime-details/anime-details-staff-desktop-frieren.png` owns desktop shell layout.

All other Anime Detail images provide tab-content direction only. When header, hero, metadata, controls, tabs, sidebar, spacing, or navigation conflicts with canonical reference, canonical reference wins.

## Shared Desktop Shell

Desktop keeps one unchanged two-column page below site header:

- Main column uses roughly three quarters of available width.
- Right sidebar uses remaining quarter with narrow fixed gutter.
- Header shows AnimeX, Home, Discover, centered search, notifications, and account avatar.
- Community and Stats stay absent.
- Hero remains inside main column. Sidebar starts beside hero, directly below header.
- Hero keeps backdrop, left cover poster, right title block, metadata, synopsis, and one control row.
- Control order stays Status, Score, Favorite, Write review, Rewatch history.
- Coral remains reserved for Write review. Cyan marks interactive state and selected values.
- Tab order stays Overview, Reviews, Characters, Staff.
- Tab bar width equals main column width. Active tab changes cyan text and underline only.
- Active content begins at same vertical origin below tab divider on every tab.

Changing tabs must not shift header height, hero height, cover position, title position, synopsis width, control geometry, tab position, sidebar width, or sidebar section order.

## Shared Desktop Sidebar

Sidebar stays visible and unchanged on all four tabs:

1. Related Anime
2. Recommendations
3. Trailer
4. External Links

Each section uses canonical compact vertical card treatment. Tab changes must not replace sidebar with poster rails, move sidebar below main content, or alter its width.

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
- Tabs remain Overview, Reviews, Characters, Staff with one cyan active state.
- Reviews use single-column cards.
- Characters and Staff use two-column cards when labels remain readable; use one column below that threshold.
- Overview uses one readable label/value list.
- Bottom navigation always shows Home, Discover, Search, Create, Profile.
- No horizontal page overflow. Touch targets remain at least 44 by 44 CSS pixels.

Mobile tab changes must not replace header controls, change hero composition, reorder user controls, rename tabs, or change bottom navigation.

## Content And State Rules

- AniList ID remains canonical anime identity.
- Full metadata hydrates on first detail-page open.
- Missing or stale slug redirects to canonical slug before stable page render.
- Signed-out users do not see Write review or owner-only Rewatch history.
- Rewatch history and count remain owner-only.
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
