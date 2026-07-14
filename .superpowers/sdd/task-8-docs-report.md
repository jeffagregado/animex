# Task 8 docs report

Status: DONE_WITH_CONCERNS

## Verified source

- `convex/posts.ts:67-139` — Post create/update/visibility/delete, shared contract parse, normalized text/media, owner checks, request collision handling, and feed projection writes.
- `convex/socialPolicy.ts:85-89` — text normalization, 280-character limit, and text-or-media requirement.
- `src/features/social/shared/external-media.ts:10-76` — HTTPS/no-credential/2,048-character URL validation, explicit image/video union, provider matching, and linked-video copy.
- `convex/schema.ts:168` — required nullable `posts.media`; no `imageIds` or `postImages` declaration.
- `convex/feed.ts:90-103` — source-backed Post hydration, projection integrity checks, source visibility authorization, and direct stored-media output.
- `src/features/feed/post-media-card.tsx:10-38` — lazy external image, no-referrer policy, contextual alt text, broken-image geometry, safe linked video, and optional YouTube thumbnail.
- `convex/social.integration.test.ts:376-442,599-640` — media-only/edit/remove, owner authorization, invalid URL/upload-writer rejection, request collisions, and exact create idempotency.
- `src/routes/_public/discover.tsx:38-95` — URL search/filter normalization and serialization.
- `src/features/discover/ui/discover-page.tsx:17-49` — main-column rails, retained desktop Top Genres, and genre selection.
- `src/routes/_public/home.tsx:3-16`, `src/features/home/home-page.tsx:28-31`, `src/features/home/home-sidebar.tsx:16-18` — shared Discover loader/data, reused This Week/Upcoming state, and matching card surfaces.
- `.superpowers/sdd/task-4-report.md:57-105` — development migration inspection, migration aggregate, zero-row verification, empty-legacy-field recovery, and final schema sync.

## Docs changed

- `docs/architecture/review-discovery-data-flow.md`
  - Added Post external media entry/input, validation, transform, storage, external-call, retry/error, output, auth, and owner map.
  - Recorded migration current schema/data state and exact aggregate: `posts` processed 1/preserved 1/deleted 0; `postImages` processed 0; `feedCards` processed 1; all image/card/storage deletion counts 0; verification zero legacy IDs, image rows, and orphan Post cards.
  - Preserved Review discovery, feed source-truth, Review migration, and List Progress sections.
  - Removed stale upload/storage-table edges.
- `docs/architecture/discover-data-flow.md`
  - Removed main-column Genres from rendered rails.
  - Retained desktop Top Genres, `DISCOVER_GENRES` URL filter, search/filter state, and Home shared Discover data/surface flow.

## Stale edges removed

- Post file picker/upload URL/image processor/Post image table/storage-object path.
- Post feed hydration via projection-owned content or arbitrary server media fetch.
- Discover main-column Genres section.

## Validation

- Inspected final source, schema, tests, migration report, and current docs.
- `git diff --check` pending after controller integration.
- Full test, TypeScript, build, Fallow, Convex sync, client endpoint scan, and browser QA remain controller-owned gates.

## Concern

Live migration evidence is recorded in `.superpowers/sdd/task-4-report.md`; migration implementation is intentionally absent from final source after verification. No credentials, Post content, media URL, or storage ID is documented.
