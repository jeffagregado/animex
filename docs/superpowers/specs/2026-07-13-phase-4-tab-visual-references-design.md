# Phase 4 Tab Visual References

## Goal

Create dedicated, implementation-ready Anime Detail references for Reviews, Characters, and Staff. Each tab gets desktop and mobile full-page designs.

## Source

- `docs/visual/anime-details/anime-details-desktop-frieren.png`
- `docs/visual/anime-details/anime-details-mobile-frieren.png`

Preserve existing Frieren hero, cover, metadata, user controls, navigation shell, tab order, palette, typography, spacing, borders, and responsive behavior. Active tab uses cyan text and underline. No Phase 4 code or data changes.

## Deliverables

- `anime-details-reviews-desktop-frieren.png`
- `anime-details-reviews-mobile-frieren.png`
- `anime-details-characters-desktop-frieren.png`
- `anime-details-characters-mobile-frieren.png`
- `anime-details-staff-desktop-frieren.png`
- `anime-details-staff-mobile-frieren.png`

Save all files under `docs/visual/anime-details/` as standalone full-page references. Desktop follows existing wide viewport. Mobile follows existing narrow portrait viewport.

## Reviews

Show rating summary, score distribution, review count, sort control, and review cards. Each card shows avatar, author, Review Rating, required summary, body preview, date, and helpful count. Keep signed-in `Write review` action. Avoid dense tables and nested card shells.

## Characters

Show responsive portrait grid. Each item includes character portrait, character name, story role, voice actor portrait or compact identity, and language label. Desktop uses roomy multi-column grid. Mobile uses readable two-column cards.

## Staff

Show responsive staff grid. Each item includes portrait, staff name, and clear production role. Grouping may use primary production and cast/voice roles only when it improves scanning. Desktop uses roomy multi-column grid. Mobile uses readable two-column cards.

## Visual Rules

- Dark navy background and surfaces.
- Cyan active, interactive, and score accents.
- Coral reserved for primary review action.
- Subtle blue-gray borders; restrained radii and shadows.
- Realistic Frieren content. Legible UI text; no decorative fake dashboards.
- Full hero context remains visible in every reference.
- Mobile keeps bottom navigation and touch-sized controls.
- No Community or Stats navigation; match current MVP shell decisions.

## Acceptance

- Six distinct images exist at exact paths.
- Correct tab active in each image.
- Desktop/mobile designs remain recognizably same page family as approved Overview references.
- Tab content is legible, implementable, responsive, and free from clipped or overlapping UI.
- Images contain no watermarks or unrelated branding.

Status: APPROVED FOR GENERATION.
