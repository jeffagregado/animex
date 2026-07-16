# Design QA

## Pre-Phase 7 Social UI Embargo — 2026-07-16

Final result: PASS

- No new visual asset required. Existing AnimeX surfaces retained their approved layout and theme.
- Signed-out and signed-in browser QA passed at 390 and 1280 px with clean console and network.
- Home exposes Home/Global only. Review discovery exposes All/Public/My Private only.
- Public/Private are the only new/edit owner choices. Social controls, counts, labels, Followers choices, and placeholders are absent.
- Stale Following-feed and Followers-discovery URLs replace before forbidden queries mount.
- Authorized development fixtures verified new-content defaults, legacy Followers preservation, and explicit Public/Private migration. All five modified account/Post/Post-card/Review/Review-card visibility values were restored to Followers.
- Feed owner action target is 44 x 44. Review Detail restores visibility focus after async mutation. Keyboard focus and touch targets pass.
- Temporary restore functions are removed. Development Convex deployment is clean. No migration ran.

## Phase 5

Final result: PASS

## Visual truth

- Home: `docs/visual/home/home-desktop-feed.png`, `home-mobile-feed.png`
- Review Creation: `docs/visual/reviews/review-creation-desktop-frieren.png`, `review-creation-mobile-frieren.png`
- Review Detail: `docs/visual/reviews/review-detail-desktop-frieren.png`, `review-detail-mobile-frieren.png`

## Browser evidence

- Home: `docs/visual/qa/phase5/home-desktop-1280.png`, `home-tablet-768.png`, `home-mobile-390.png`
- Signed-in Home: `docs/visual/qa/phase5/home-signed-in-desktop-1280.png`
- Review discovery: `docs/visual/qa/phase5/reviews-signed-in-private-1280.png`, `reviews-signed-in-tablet-768.png`, `reviews-signed-in-mobile-390.png`
- Anime Reviews: `docs/visual/qa/phase5/anime-reviews-desktop-1280.png`, `anime-reviews-tablet-768.png`
- Review Detail rich text: `docs/visual/qa/phase5/review-detail-rich-text-desktop-1280.png`
- Full toolbar and Preview pass: `docs/visual/qa/phase5/review-editor-toolbar-full-pass-1280.png`, `review-editor-mobile-preview-390.png`
- Published structured output: `docs/visual/qa/phase5/review-published-structured-1280.png`
- Select states: `anime-reviews-desktop-sort-open.png`, `anime-reviews-desktop-sort-hover.png`, `anime-reviews-mobile-sort-open.png`, `anime-reviews-mobile-sort-hover.png`

Viewports: 1280 x 900, 768 x 1024, 390 x 844. Theme: dark. States: signed out and complete authenticated QA account.

## Verified behavior

- Home desktop utility order: signed-in List Progress, Latest Reviews, This Week, Upcoming; public order omits List Progress.
- Review discovery preserves signed-in visibility lanes, full-row Latest Review links, two-column mobile/tablet filters, 44 px touch targets, and zero horizontal overflow. A fresh Review inherits the account's Private default; the reusable QA fixture was restored to Private after visibility testing.
- Home feed, Seasonal rail, `/reviews`, Anime Reviews, owner menus, visibility changes, Post lifecycle, anime controls, and responsive navigation match approved geometry and theme.
- Authenticated live-browser toolbar pass covers H2, H3, quote, ordered list, unordered list, bold, italic, underline, strikethrough, image URL plus alt, video URL, block spoiler, undo, and redo. Undo removed and redo restored the linked video card.
- Editor Preview and published renderer preserve structure, inline marks, media cards, visible Review Summary, and independent rich-text spoiler reveal behavior. Review-level `containsSpoiler` remains warning metadata.
- Draft save, navigation away, resume, publish, edit, and owner actions work through authenticated UI.
- All 14 rich-text toolbar controls keep dark/cyan hover and keyboard `focus-visible` ring states. Mobile Preview keeps 44 px controls and zero document overflow. No native white or browser-blue surfaces, stuck touch-hover state, scrollbar-gutter change, layout movement, horizontal overflow, hydration error, failed dynamic request, or fresh runtime error occurred.
- Review list pagination above 12 visible records is integration-tested. Dev data did not reach the live threshold, so no production QA seed path was added.

## Validation defects resolved

- Lexical list items accept runtime `checked: undefined` while rejecting checklist values.
- Published underline and strikethrough use correct Lexical format bits.
- Image and video blocks append deterministically after modal focus moves selection.

## Closure gates

- 91 test files passed, 2 skipped.
- 637 tests passed, 3 skipped.
- Route generation, Convex sync, TypeScript, client and SSR build, cumulative Fallow new-only audit, client AniList endpoint scan, and diff check pass. Cumulative Fallow reports zero introduced dead-code, complexity, or duplication findings; the inherited `react-dom` advisory remains.
- React Doctor completes with exit 0 and 69 advisory warnings but no errors. Zod-v4 migration warnings are false positives under installed Zod 4.4.3; remaining hook, accessibility, performance, and conventional shared-component advisories stay optional technical debt.
- Build retains the existing large-chunk warning.
- Final mobile Review action-row alignment, pending spoiler-checkbox lock, desktop Rating placement, and Base UI `data-disabled` styling follow-up pass at 390/768/1280 px.
- Final signed-in in-app browser smoke verifies Home feed, owner menu and destructive hover theme, Review Detail, Anime Reviews, Review editor, and a clean browser console after cumulative quality cleanup.
