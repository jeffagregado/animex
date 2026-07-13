# Phase 4 Anime Controls Feedback Design

## Visual Truth

Use `docs/visual/anime-details/anime-details-controls-desktop-v2.png` for the control row. Use `docs/visual/anime-details/anime-details-staff-desktop-frieren.png` for its banner position and surrounding shell.

## Controls

- One compact row on desktop: Status, Score, Favorite, Rewatch history.
- Dark translucent surface, thin slate border, small muted label, brighter value, consistent height and radius.
- Status shows a green state dot, exact display label, and one down chevron.
- Score shows a yellow star, numeric input, and stacked up/down chevrons. Unset score displays `0` without saving until the user changes it.
- Favorite and Rewatch history use the same surface, height, border, typography, hover, focus, disabled, and pending language.
- Public Status, Score, and Favorite remain redirect facades. Rewatch history remains owner-only.

## Behavior

- Status labels are Watching, Plan to watch, Dropped, Completed, and Rewatched.
- Score accepts `0` through `10` with at most one decimal. Typing may use values such as `8.1`; buttons and keyboard arrows step by `0.5`.
- Remove the score Clear action.
- First persisted non-null score sets Status to Watching only when stored Status is unset. Existing Status is never replaced.
- Status and Score keep the existing 500 ms trailing autosave, blur or Enter flush, mutation-confirmed Sonner message, and explicit retry state.

## Responsive And Interaction

- Preserve the stable Anime Detail shell, tabs, content, and sidebar.
- Collapse controls without horizontal overflow at tablet and mobile widths.
- Hover must retain the dark AnimeX theme. Keyboard focus stays visible and distinct. Touch must not leave a stuck hover state.

