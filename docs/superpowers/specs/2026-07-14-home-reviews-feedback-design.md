# Phase 5 Home And Review Discovery Feedback Design

Status: IMPLEMENTED, VERIFIED, and integrated on `dev`; final closure is tracked in `TODO.md` and `design-qa.md`.

## Scope

Refresh Home layout, restore desktop utility content, align feed cards with approved Home reference, and add searchable global Review discovery at `/reviews`.

No Phase 7 social behavior. No production deployment. No Convex actions.

## Visual Sources

- Home feed shell and feed cards: `docs/visual/home/home-desktop-feed.png`.
- Discover Seasonal, This Week, and Upcoming: `docs/visual/discover/discover-desktop.png`.
- Reviews desktop: `docs/visual/reviews/reviews-list-desktop.png`.
- Reviews mobile: `docs/visual/reviews/reviews-list-mobile.png`.
- Existing AnimeX shell remains authoritative when older references show unavailable navigation.

## Home Layout

- Seasonal Anime stays above feed and uses cached Discover Seasonal data, card geometry, rail controls, metadata, loading, empty, retry, and image-error states.
- Remove static Home Seasonal data.
- Remove `Community feed` placeholder.
- Remove signed-in `What are you watching?` prompt. Keep Create Post button.
- Desktop keeps main feed plus fixed utility column.
- Utility column remains hidden below `lg`; infinite feed must not place utility modules beyond reachable mobile content.
- Optional backlog: mobile Explore tab or sheet for utility content.

Public utility order:

1. Latest Reviews
2. This Week
3. Upcoming

Signed-in utility order:

1. List Progress
2. Latest Reviews
3. This Week
4. Upcoming

## Home Utility Modules

### List Progress

- Signed-in only.
- Four metrics: Watching, Completed, Plan to Watch, Dropped.
- Compact count and proportional progress-bar presentation.
- One small authenticated aggregate read. Status mutations update aggregate atomically.
- Existing user-anime entries receive resumable internal-mutation backfill.

### Latest Reviews

- First five newest published Public Reviews.
- Compact row: anime cover, author, relative timestamp, two-line Summary.
- Do not show Rating in Home utility rows.
- Row opens Review Detail.
- `See more` opens `/reviews`.

### This Week And Upcoming

- Reuse Discover components and cached section states.
- This Week derives first five Trending entries.
- Upcoming uses existing cached Upcoming list.
- Preserve Discover retry, rate-limit, loading, empty, and image-unavailable behavior.

## Feed Cards

- Match `home-desktop-feed.png` structure using existing Phase 5 data.
- Coral left accent for Posts. Cyan left accent for Reviews, Completed, and Rewatched.
- Compact activity header, timestamp, owner overflow menu, spacing, typography, and media framing.
- Review card shows anime cover, title, Rating, and Summary.
- Completed/Rewatched cards show available activity and anime metadata only.
- Posts keep text, one optional external image/video media item, and whole-Post spoiler behavior. No Post anime attachment in Phase 5; anime attachment remains optional backlog.
- Preserve owner edit, visibility, delete, Review Detail, direct activity links, and spoiler reveal.
- Signed-in Like and Comment affordances remain disabled and labeled `Coming in Phase 7`.
- No fake reaction counts, bookmark state, milestone Score, descriptions, or Phase 7 mutations.

## Reviews Route

- Public route: `/reviews`.
- Shared public shell; current Home/Discover navigation remains authoritative.
- Centered single-column list. No right sidebar.
- Desktop and mobile follow approved Review discovery references.
- Public viewers see Public Reviews only.
- Signed-in viewers see Public Reviews plus their own Followers and Private Reviews.
- Review card: anime cover, Rating, Summary, author, timestamp, spoiler state, Review Detail action.
- Review Summary remains visible. `containsSpoiler` renders warning metadata; only rich-text spoiler blocks remain independently revealable.
- Twelve Reviews per cursor page with intersection-observer infinite scroll.
- Loading skeleton, empty state, pagination retry, and terminal state preserve geometry.

## Search And Filters

URL state:

- `q`: anime title or author display name/username; trimmed; minimum two characters; maximum 100.
- `sort`: `newest`, `rating-high`, or `rating-low`; default `newest`.
- `rating`: Any or one of ten bands from `90–100` through `0–9`.
- `visibility`: `all`, `public`, `followers`, or `private`; public viewers normalize to `public`.

Behavior:

- Search uses 300 ms trailing debounce and URL replace navigation.
- Empty search uses selected sort.
- Active search uses Convex relevance order. Sort control becomes disabled and reads `Relevance`.
- Rating and visibility filters remain active during search.
- Clearing search restores selected sort; default remains Newest.
- Public visibility filter stays hidden because Public is its only valid value.
- Signed-in labels: All visibility, Public, My Followers, My Private.

## Data Design

- Home loader reuses `getDiscoverPage()`; no duplicate AniList transport.
- Add indexed latest-public Review query capped at five.
- Reviews store bounded discovery fields for anime-title/author search and rating band.
- Existing published Reviews receive resumable internal-mutation backfill.
- Non-search discovery uses indexed newest/highest/lowest order keys.
- Search uses one bounded Convex search field plus equality filter fields.
- Public and viewer-owned non-public lanes use an opaque composite cursor and deterministic deduplication.
- For signed-in `All` search, viewer-owned non-public matches precede Public matches because Convex does not expose comparable relevance scores across separate visibility queries.
- Indexes and bounded pagination replace table filters or broad collection reads.
- No Convex action, external search service, or client-side broad filtering.

## Error And Access Rules

- Public reads never query private List Progress.
- Followers/Private Review results must belong to current viewer.
- Direct Review access keeps existing visibility checks.
- Missing anime/author source data fails explicitly; no fake card metadata.
- Search, pagination, Discover cache, and progress errors show scoped retry states without removing already loaded content.
- Invalid URL values normalize to documented defaults without widening backend access.

## Validation Contract

- Review-query integration coverage: latest-public limit/order, visibility isolation, search fields, rating bands, each sort, composite cursor continuation, deduplication, retry, and terminal state.
- Progress integration coverage: four counts, status transitions, unset state, idempotency, and backfill.
- Home tests: auth-specific utility order, public query isolation, removed placeholders, reused Discover Seasonal/This Week/Upcoming, and `See more` route.
- Feed-card tests: activity variants, accent classes, preserved owner/spoiler behavior, and absence of fake Phase 7 data.
- Reviews route tests: URL normalization, debounce, Relevance mode, filters, infinite-scroll trigger, visibility controls, cards, and states.
- Run Convex push, focused tests, full tests, TypeScript, build, Fallow new-only gate, client AniList-endpoint scan, and `git diff --check`.
- Browser QA at 390, 768, and 1280 px covers hover, focus, touch, Select popup theming, infinite scroll, retry, auth states, console, failed requests, layout shift, and overflow.

## Exclusions

- Mobile Explore tab/sheet stays optional backlog.
- No global Review body in listing cards.
- No Review search over Summary/body.
- No custom sort while search is active.
- No reaction counts, bookmarks, Post anime attachment, Follow mutation, Like mutation, Comment mutation, or production deployment.
