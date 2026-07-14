# Review Discovery Data Flow

## Source truth

- `reviews` owns Review state, visibility, Rating, Summary, body, and discovery projection fields.
- `posts`, `reviews`, and `animeMilestones` remain authoritative for feed content and access. `feedCards` is an indexed projection, never source truth.
- `users` supplies author display name and username.
- `animeSummaries` supplies the cached anime title and cover.
- `userAnimeEntries` owns per-anime list status.
- `userAnimeProgress` is a sparse per-user projection for Watching, Completed, Plan to Watch, and Dropped counts.

## Review writes

Review create, draft save, publish, edit, and visibility mutations update the source Review and its discovery fields atomically. Discovery text contains normalized anime title, author name, and username. Rating bands are required; `none` is valid only for an unrated Draft. Published Reviews without a Rating fail explicitly.

Review deletion removes the source row. Activity deletion removes only the feed projection and does not remove Review discovery.

New Review fields start from the author's account visibility after the complete profile resolves. Existing Drafts and published Reviews retain their stored visibility.

## Feed projection reads

Every Post, Review, Completed, or Rewatched card resolves its source row before hydration. Missing, deleted, inactive, draft, or mismatched sources are omitted. Source key, source ID, owner, anime ID when applicable, and visibility must match the projection. Authorization uses source owner and visibility; projection fields cannot widen access.

## Discovery reads

- Latest Reviews: indexed Public, published, newest read; server cap five.
- Empty search: indexed newest, highest Rating, or lowest Rating lanes.
- Search: one Convex search index over `searchText`; equality filters cover state, visibility, owner, and Rating band.
- Public viewers read only Public Reviews.
- Signed-in visibility lanes are My Followers, My Private, then Public. Non-public lanes are owner-bound.
- Public-auth state first normalizes the URL. Viewer-scoped lanes wait for Convex authentication and use the resolved profile ID; an auth mismatch fails visibly without issuing a viewer query.
- Cursors bind version, viewer, normalized query, sort, Rating band, and visibility. Each lane advances independently. Search relevance scores never merge across lanes.
- Discovery pages cap at 12 items and hydrate through required author/anime source records. Missing source records fail explicitly.
- Home Latest Reviews reads at most five indexed Public, published Reviews. Rows keep loaded content across retry errors, omit Rating, render compact spoiler-safe Summary and cover failure, and expose one full-row Review Detail target.

## List Progress

Status-changing mutations update `userAnimeProgress` in the same transaction. First Score on an unset entry changes Status to Watching before applying one progress transition. Rewatch and rollback paths apply one caller-owned transition; shared rewatch helpers do not update the projection.

`userAnimeProgress` is a logical singleton per user. Indexed reads require at most one row; duplicates are corruption. No row means zero counts for an untouched user. Status mutations and backfill upsert or recompute the same row. During migration, a missing row inside a status mutation first recomputes indexed entry truth, then applies the requested transition. Negative or mismatched counts fail explicitly.

## Indexes and cost

- Review discovery uses 12 bounded database indexes plus one search index.
- List Progress uses one `by_user` index and indexed `userAnimeEntries.by_user_status` reads.
- Reads and migrations use indexed pagination. No Convex action or table-filter scan is used.

## Migration verification

Development deployment verification processed zero existing Review rows with zero mismatches. List Progress processed two profiles, rebuilt one projection, and verified zero mismatches. After verification, Review `searchText` and `ratingBand` became required and the deployment passed again.

Backfills are resumable and idempotent. Verification returns offending Review or user IDs. Any mismatch, missing author/anime source, or invalid published Rating stops schema tightening; no stale or fabricated fallback is allowed.
