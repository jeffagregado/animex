# Phase 5 Review Card, Avatar, And Rail Feedback Design

Status: APPROVED WRITTEN SPECIFICATION. Implementation plan prepared for user review.

## Scope

Refine existing Phase 5 Review and feed surfaces without changing unrelated feed behavior, visibility rules, routing, pagination, or Phase 6 controls.

No production dependency, new route, AniList query, Convex action, or deployment.

## Review Spoiler Contract

- Replace Review `summaryHasSpoiler` with Review-level `containsSpoiler`.
- Writer label: `Review contains spoiler`.
- Flag is warning metadata only. Summary and ordinary Review body stay visible.
- Explicit rich-text spoiler blocks keep independent cover/reveal behavior.
- `containsSpoiler=true` renders compact destructive `Spoiler` badge.
- Feed Review badge sits below anime title and above Rating.
- Latest Reviews badge sits at row top-right.
- Shared Review listing card badge sits at card top-right.
- Review Detail and Preview show badge near Review metadata.
- Summary reveal buttons are removed from all Review cards.

## Review Rating And Writer Layout

- Review Rating keeps default `50`, range `0–100`, and maximum one decimal.
- Draft may keep Rating empty. Publish requires valid Rating.
- Replace number spinner/increment/decrement UI with plain text field.
- Field uses decimal keyboard hint and preserves partial typing while focused.
- Reject nonnumeric input, values outside `0–100`, and more than one decimal.
- Desktop keeps Rating, Summary, and Visibility in current three-column row.
- Move `Review contains spoiler` into full-width row below all three fields, aligned right.
- Mobile keeps checkbox below fields and right-aligned.

## Destructive Review Cleanup

User authorizes deletion of all existing Review records, including drafts.

- Delete all Review sources in bounded, resumable pages.
- Delete only feed cards whose source is a Review.
- Delete `animeReviewStats` rows after Review removal so count, average, and bands cannot remain stale.
- Verify zero Reviews, drafts, Review activity remnants, and Review aggregate rows before final schema removal.
- Remove old spoiler field after verified cleanup.
- Preserve Posts, Post media, Completed/Rewatched activities, anime state, anime caches, accounts, profiles, and unrelated feed cards.
- Remove temporary cleanup functions after verification.

## Shared User Avatar

- Re-check for existing shared Avatar before creation. Reuse it if present.
- Current repo has only duplicate inline avatar renderers, so planned fallback is one shared round component.
- Inputs: avatar URL, display name, accessible label, and explicit supported size.
- Valid image uses cover crop. Broken or missing image shows first display-name letter in uppercase.
- Reset image-error state when URL changes.
- Replace all feed activity icons with author Avatar for Post, Review, Completed, and Rewatched cards.
- Preserve feed left-border accent as activity-type cue.
- Replace duplicate avatar markup in Anime Reviews and Review Detail.
- Keep anime covers in `/reviews` discovery and Latest Reviews. Do not add author avatars to surfaces whose approved design uses anime art.
- Avatar remains non-linking until User Profile routes are implemented.

## Feed Review Card

- Preserve current compact Home feed geometry, cover size, spacing, header, and footer.
- Whole body region—cover, title, badge, Rating, and Summary—opens `/reviews/$reviewId`.
- Remove cover link to Anime Detail inside this body.
- Remove visible `Read Review` link.
- Use one valid body link with full-area focus ring; do not nest interactive controls.
- Summary stays visible even when `containsSpoiler=true`.
- Owner menu Review activity label changes from `Remove` to `Delete`.
- Mutation remains `reviews.removeActivity`.
- Confirmation title, explanation, and success message retain activity-only semantics.
- Review source deletion remains exclusive to Review Detail.

## Shared Published Review Card

- Promote current `/reviews` discovery card into shared Review UI.
- `/reviews` and Anime Detail Reviews render exact same component.
- Card requires published state, Rating, and publish timestamp.
- Preserve anime cover/title, author, timestamp, Rating, visible Summary, visibility badge, and Review Detail action.
- Anime Detail Reviews query remains source of sorting, stats, and pagination.
- Remove old Anime Reviews-specific card after consumers and tests switch.
- No Review body JSON loads into listing cards.

## Latest Reviews

- Keep latest five Public Reviews and `See more` link.
- Whole compact row opens Review Detail.
- Remove visible `Read review` text.
- Each row shows anime cover, anime title, author, publish timestamp, and visible compact Summary.
- Spoiler badge, when present, stays at row top-right without covering title or summary.
- Preserve loading, refresh-error retention, empty, image-error, keyboard-focus, and hover states.

## Anime Carousel Heights

- Equalize card height within each rail only.
- Apply to every `DiscoverSectionRail` consumer: Trending, Seasonal, Recommendations, and Home Seasonal.
- Horizontal rail stretches direct children to tallest card in current rail row.
- Poster link and article fill available height.
- Metadata area fills remaining space while preserving title clamp and bottom metadata alignment.
- Preserve width, cover ratio, rank badge, scrolling, snap behavior, arrows, loading geometry, and responsive breakpoints.

## Accessibility And Interaction

- Round Avatar has descriptive accessible label; fallback letter is not duplicated to assistive tech.
- Whole-card links expose Review title/author in accessible name.
- Destructive badge is visual metadata, not a button.
- Hover, focus-visible, touch, selected, and pending colors remain AnimeX dark/cyan/coral with no native white surfaces.
- Link overlays must not cover owner menus, feed detail timestamp, footer controls, or `See more`.
- Minimum interactive target remains 44 px where current controls require it.

## Validation

- Contract tests cover `containsSpoiler` and rejection/removal of old field.
- Cleanup tests cover bounded deletion, cascade scope, resume, idempotency, and preserved unrelated records.
- Writer tests cover spinner-free Rating input, partial typing, decimal precision, bounds, empty Draft, required Publish, and checkbox placement/copy.
- Avatar tests cover valid image, missing image, image failure, URL reset, uppercase one-letter fallback, and supported sizes.
- Feed tests cover Avatar replacement, whole Review body link, visible Summary/badge, removed CTA, and activity-only `Delete` action.
- Shared card tests cover both `/reviews` and Anime Reviews consumers with exact component output.
- Latest Reviews tests cover title/author/time/Summary/badge and absent `Read review`.
- Rail tests cover per-row equal height without fixed global height or changed scroll controls.
- Run focused tests, full suite, TypeScript, build, Convex sync/cleanup verification, Fallow new-only, client AniList endpoint scan, and `git diff --check`.
- Authenticated browser QA at 390, 768, and 1280 px covers writer input, Avatar fallbacks, Review links, badges, menus, shared cards, Latest Reviews, rail heights, hover/focus/touch, console, network, hydration, and overflow.

## Locked Boundaries

- Existing Reviews and drafts may be deleted; no other source data may be deleted.
- Review Summary is never hidden by Review-level spoiler flag.
- Rich-text spoiler blocks remain independent.
- Feed Review menu says `Delete` but deletes activity only.
- `/reviews` and Anime Detail Reviews use exact shared published card.
- Equal height is per rail, not global.
- No image reference update required for Shared Avatar or writer-field changes.
- Stop after implementation validation and user review. No merge, deployment, or production cleanup.
