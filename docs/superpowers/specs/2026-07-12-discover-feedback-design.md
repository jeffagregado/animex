# Discover feedback design

Status: implemented and verified.

## Scope

Fix Discover filter theme, add one-step filter clearing, and add visible horizontal rail controls. Preserve current responsive layout, cards, data flow, and noninteractive anime-card rule.

## Filter controls

- Replace native select arrow UI with `appearance-none` select and themed Chevron icon.
- Keep dark background. Hover uses subtle cyan border and tint. Focus keeps visible cyan ring.
- Use one reusable themed select wrapper for Genre, Format, Season, Year, and Sort.
- Show `Clear filters` only when Genre, Format, Season, Year, or non-default Sort is active.
- Clear resets Genre, Format, Season, Year, and Sort to `relevance` in one URL navigation.
- Clear preserves search query.
- `Any` options remain available.

## Horizontal rails

- Create one reusable horizontal rail viewport/control component.
- Use it for Trending Anime, Seasonal Anime, and Popular Recommendations.
- Preserve existing poster card dimensions, spacing, ranking, and visual hierarchy.
- Keep native touch, trackpad, mouse-wheel, and drag scrolling.
- Add previous/next buttons for clear desktop interaction.
- Scroll one useful viewport step per button press.
- Disable controls at start/end. Recalculate after resize and scroll.
- Use scroll snap without forcing unexpected page movement.
- Keep rail content keyboard reachable. Buttons have clear accessible names and focus rings.
- Do not add carousel dependency.

## Responsive behavior

- Mobile keeps swipe-first behavior and compact layout.
- Arrow controls may stay visible when space permits; they must not overlap titles or cards.
- No page-level horizontal overflow at 390, 768, or 1280 pixels.

## Tests

- RED first: themed select contract, clear-button visibility/reset/query preservation.
- RED first: rail previous/next scrolling, boundary disabling, resize/scroll state.
- Existing loading, error, image-failure, retry, and URL-state tests remain green.
- Run TypeScript, full tests, build, Fallow changed-file audit, diff check.
- Browser QA: 390/768/1280, select hover/focus, clear filters, arrows/swipe, keyboard, console.

## Out of scope

- Anime detail navigation.
- New carousel package.
- Changes to AniList, Convex, cache, or server functions.
- Phase 4 work.
