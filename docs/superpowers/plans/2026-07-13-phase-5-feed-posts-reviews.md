# Phase 5 Feed, Posts, Reviews

Status: COMPLETE on `jeff-cx/phase-5-feed-reviews`. This baseline plan is historical; current contracts and validation live in `TODO.md` and `docs/architecture/review-discovery-data-flow.md`.

## Outcome

- Real Home, Following, Global feeds.
- Text/media Posts with owner lifecycle; each Post accepts zero or one safe external HTTPS image/video URL.
- One draft/published Review per user and anime.
- Validated Lexical JSON, live Preview, Review Detail, Anime Reviews.
- Post, Review, Completed, Rewatched feed cards.
- Visibility-aware reads, routes, metrics, deletion.
- Likes, Comments, Follow mutations remain Phase 6.

## Contracts

- Feed projection is authoritative only for display; source Post, Review, and milestone rows remain truth.
- Global shows public cards. Following excludes owner and stays empty until Phase 6. Home interleaves two owner/following cards then one Global card, fills short streams, deduplicates IDs.
- Feed pages use opaque cursor pagination at 20. Anime Reviews use 12.
- Review Rating is `0–100`, one decimal, default `50`; anime list Score remains `0–10`.
- Review body stores versioned allowlisted Lexical JSON. No HTML, embeds, iframe, code, table, or arbitrary metadata fetch.
- Body limit: 2,500 visible characters, 8 depth, 400 nodes, 64 KiB JSON, four combined media nodes, 2,048-character HTTPS URLs.
- Editor supports H2/H3, quote, ordered/unordered lists, bold, italic, underline, strikethrough, image URL, linked video card, block spoiler, undo/redo.
- Posts accept 280 text characters and/or one safe external HTTPS image/video URL. No file upload, client compression, GIF-size path, first-party Post media storage, or anime attachment exists in Phase 5; anime attachment remains optional backlog.
- Convex queries/mutations/storage only. No actions. No new AniList transport.

## Execution

1. Lock contracts, design refs, schema, and validators.
2. Implement Post, Review, feed, metrics, storage, milestone projection.
3. Implement protected routes, editor/renderer, feed UI, Post Composer, Review surfaces.
4. Integrate generated types/routes once.
5. Run review, QA, docs/data-flow, full gates, responsive browser checks.
6. Stop for user review. No deploy or merge.

## Gates

- `pnpm generate-routes`
- `pnpm exec convex dev --once`
- `pnpm test`
- `pnpm exec tsc --noEmit`
- `pnpm build`
- `pnpm exec fallow audit --base HEAD --gate new-only --format json --quiet`
- built-client AniList endpoint scan
- `git diff --check`
- Browser: 390, 768, 1280; hover, focus, touch, console, network, hydration, overflow.
