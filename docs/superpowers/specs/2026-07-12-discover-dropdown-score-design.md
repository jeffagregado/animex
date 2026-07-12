# Discover Dropdown And Score Design

Status: implemented and verified.

## Behavior

- Discover filters use the official shadcn Select backed by Base UI.
- Popup surfaces and items stay dark with cyan focus, hover, and selected states.
- Existing controlled URL state, labels, choices, layout, and Clear filters behavior remain.
- Search-result cards show AniList `averageScore` in a top-right badge as `90%`.
- Missing scores render `—` with an accessible unavailable label.

## Boundaries

- Add only `@base-ui/react` as a production dependency.
- Do not change the global shadcn preset or add Radix packages.
- Do not change routes, Convex, cache behavior, or AniList requests.
