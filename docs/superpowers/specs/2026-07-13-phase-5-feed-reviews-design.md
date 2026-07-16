# Phase 5 Feed And Review Design

Status: SUPERSEDED by the implemented Phase 5 specs dated 2026-07-14 and 2026-07-15; retained as historical design baseline.

## Visual Source

- Home and Anime Detail approved references remain base system.
- Approved references: `docs/visual/reviews/review-creation-desktop-frieren.png`, `review-creation-mobile-frieren.png`, `review-detail-desktop-frieren.png`, `review-detail-mobile-frieren.png`.
- Dark AnimeX surfaces, cyan interaction state, coral primary publish action, restrained borders, no native white controls.

## Review Creation

- Route: `/anime/$anilistId/$slug/reviews/new` under pathless protected `route.tsx` layout.
- Desktop: editor left, live Preview right.
- Mobile: Editor and Preview tabs.
- Header retains anime identity and clear Draft/Publish actions.
- Rating, Summary, Review-level `containsSpoiler` warning, and visibility precede body editor.
- New Reviews start from Account-Level Default Visibility; saved Drafts and published Reviews keep their own visibility while editing.
- Toolbar stays one readable row where possible; mobile wraps without horizontal page overflow.
- Save Draft accepts partial content. Publish requires body text, Rating, Summary.

## Review Rendering

- Preview and published Review share one structured React renderer.
- Review cards show Rating and Summary only. Review Detail shows full body.
- Review-level `containsSpoiler` is warning metadata and never hides Summary. Rich-text spoiler blocks reveal independently.
- Image blocks use fixed frames and explicit unavailable state.
- Video nodes render linked YouTube/Vimeo/provider cards, never playback.

## Feed And Posts

- Home retains approved desktop two-column and mobile single-column geometry.
- Composer opens desktop dialog or mobile sheet.
- Feed cards use one flat card boundary, readable author/time row, and body/media; pre-Phase 7 cleanup removes disabled social controls from the DOM.
- Post spoiler masks text/images. Owner menu holds edit, visibility, delete.
- Loading, empty, error, retry, terminal states preserve layout.

## Review Detail

- Public shell, centered readable article column, compact anime identity block, author/time/visibility metadata, Rating prominence, owner menu.
- No separate Comments. Social Like UI stays absent until functional Phase 9 behavior is ready.
- Responsive typography and media never exceed article width.
