# Review Layout, Media, And Checkbox Feedback Design

Status: IMPLEMENTED, VERIFIED, and integrated on `dev`.

## Scope

Fix shared published Review card overlap, widen Home desktop utility column, change Review and Post images to portrait media, and replace native standalone checkboxes with official shadcn Base UI Checkbox. Preserve routes, queries, mutations, Review/Post data, linked-video cards, and unrelated UI.

## Shared Published Review Card

`PublishedReviewCard` remains sole listing card for `/reviews` and Anime Detail Reviews.

- Below `sm`, Rating moves to left edge of bottom action row. `Review Detail` stays at right edge of same row.
- Use one accessible Rating node. Responsive CSS repositions it; do not duplicate Rating markup.
- Spoiler badge remains top-right.
- Anime title, author, timestamp, visibility, Summary, cover, and links remain unchanged.
- From `sm` upward, Rating remains top-right and `Review Detail` remains lower-right.
- Long title, author, timestamp, and Summary must not overlap Rating, badge, cover, or action.

## Home Desktop Layout

- At `lg` and wider, Home utility column is exactly `430px`.
- Feed column remains `minmax(0, 1fr)` with current gap and outer max width.
- Utility column remains hidden below `lg`.
- No Home query, sidebar order, infinite-feed, or module behavior changes.

## Review And Post Images

Apply portrait geometry only to Review and Post image URL content:

- Replace `aspect-video` with `aspect-4/5` in Review editor image nodes, Review Preview/published renderer images and unavailable states, and Post image cards.
- Images are `w-full` below `sm`.
- From `sm` upward, image parent containers remain left-aligned and cap at `max-width: 65%`.
- Image failure states preserve identical aspect and width geometry.
- Linked Review/Post video-preview cards remain horizontal and full-width.
- Anime Detail trailer remains `aspect-video`.
- Do not redefine Tailwind's global `aspect-video` token.

## Base UI Checkbox

Add official shadcn Base UI Checkbox from the direct `base-nova` registry item. Run dry-run and diff before applying.

- New shared export: `src/components/ui/checkbox.tsx` → `Checkbox`.
- Reuse installed `@base-ui/react`; add no production dependency.
- Preserve upstream Root/Indicator structure, replace registry placeholder icon with Lucide `CheckIcon`, and adapt import aliases to AnimeX.
- Replace native Review `Review contains spoiler` checkbox.
- Replace native Post `Hide whole Post as spoiler` checkbox.
- Preserve controlled booleans, label activation, disabled state, keyboard toggle, focus-visible ring, and dark/cyan theme.
- Unused dropdown menu-selection primitives, including `DropdownMenuCheckboxItem`, were removed during Phase 5 cumulative dead-code cleanup; current owner menus use only the retained menu primitives.
- Before new UI primitives are created, inspect installed shadcn components and registry availability first.

## Boundaries

- No route, Convex schema/function, server, cache, or data migration changes.
- No new production dependency.
- No changes to Review/Post validation or persistence.
- No redesign outside requested surfaces.

## Validation

- TDD shared-card tests cover single Rating semantics, mobile action-row placement, desktop placement, long-content safety, and exact `/reviews`/Anime Reviews reuse.
- Home tests assert `430px` desktop column and hidden narrow-screen utility column.
- Review/Post media tests assert `aspect-4/5`, responsive `65%` cap, failure geometry, Preview/published parity, and unchanged video/trailer geometry.
- Checkbox tests cover both controlled flows, label activation, disabled behavior, keyboard behavior, and shared component use.
- Run focused tests, full tests, TypeScript, build, Fallow new-only audit, client AniList endpoint scan, and `git diff --check`.
- Authenticated browser QA at 390, 768, and 1280 px covers overlap, overflow, image sizing, broken-image states, checkbox hover/focus/checked/disabled states, sidebar width, console, and failed requests.

## Locked Decisions

- Review and Post images change to 4:5; Anime Detail trailer does not.
- Images use full width below `sm`, then a left-aligned 65% maximum width.
- Linked-video cards remain unchanged.
- Home desktop utility column is 430px.
- Official shadcn Base UI Checkbox replaces all native standalone checkbox inputs currently in scope.
