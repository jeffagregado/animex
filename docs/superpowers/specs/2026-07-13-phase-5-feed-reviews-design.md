# Phase 5 Feed And Review Design

## Visual Source

- Home and Anime Detail approved references remain base system.
- Approved references: `docs/visual/reviews/review-creation-desktop-frieren.png`, `review-creation-mobile-frieren.png`, `review-detail-desktop-frieren.png`, `review-detail-mobile-frieren.png`.
- Dark AnimeX surfaces, cyan interaction state, coral primary publish action, restrained borders, no native white controls.

## Review Creation

- Route: `/anime/$anilistId/$slug/reviews/new` under pathless protected `route.tsx` layout.
- Desktop: editor left, live Preview right.
- Mobile: Editor and Preview tabs.
- Header retains anime identity and clear Draft/Publish actions.
- Rating, Summary, summary spoiler, visibility precede body editor.
- Toolbar stays one readable row where possible; mobile wraps without horizontal page overflow.
- Save Draft accepts partial content. Publish requires body text, Rating, Summary.

## Review Rendering

- Preview and published Review share one structured React renderer.
- Review cards show Rating and Summary only. Review Detail shows full body.
- Spoiler blocks reveal independently. Summary has separate reveal.
- Image blocks use fixed frames and explicit unavailable state.
- Video nodes render linked YouTube/Vimeo/provider cards, never playback.

## Feed And Posts

- Home retains approved desktop two-column and mobile single-column geometry.
- Composer opens desktop dialog or mobile sheet.
- Feed cards use one flat card boundary, readable author/time row, body/media, then disabled Phase 6 controls for signed-in viewers.
- Post spoiler masks text/images. Owner menu holds edit, visibility, delete.
- Loading, empty, error, retry, terminal states preserve layout.

## Review Detail

- Public shell, centered readable article column, compact anime identity block, author/time/visibility metadata, Rating prominence, owner menu.
- No separate Comments. Signed-in Like affordance remains disabled until Phase 6; signed-out hides it.
- Responsive typography and media never exceed article width.
