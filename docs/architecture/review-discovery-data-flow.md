# Review and Post data flow

## Source truth

- `reviews` owns Review state, visibility, Rating, Summary, body, and discovery projection fields.
- `posts` owns Post text, one nullable external `media` value, spoiler state, visibility, and timestamps.
- `feedCards` is an indexed projection. It is never source truth for Post or Review content, owner, or visibility.
- `users` supplies author display name and username; `animeSummaries` supplies cached anime title, slug, cover, and milestone year/format.
- `userAnimeEntries` owns per-anime list status. `userAnimeProgress` is a sparse per-user projection for Watching, Completed, Plan to Watch, and Dropped counts.

## Post external media flow

| Hop | Current state |
| --- | --- |
| Entry and input | `src/features/feed/post-composer.tsx` lets the author explicitly choose Image or Video, enter one HTTPS URL, and optionally enter image description or video label. Text-only, media-only, and text-plus-media Posts are valid; text is capped at 280 characters. |
| Client validation and transform | `src/features/social/shared/external-media.ts` parses HTTPS URLs with no credentials and a 2,048-character limit. The discriminated contract preserves the explicit type; video provider must match YouTube, Vimeo, or `external`. Blank description/label becomes `null`. No extension inference or remote metadata request occurs. |
| Server validation and auth | `convex/posts.ts` validates the same shape with Convex values, reparses the shared Zod create/update contract, trims text, rejects an empty text-plus-null-media payload, and requires the authenticated profile. Update, visibility, and delete resolve the Post and require its owner. |
| Idempotency | Create requests are keyed by `(userId, requestId)`. A repeat with the same normalized text, media, spoiler, and visibility returns the existing Post; a different intent fails with `POST_REQUEST_COLLISION`. Update request IDs cannot collide across owned Posts. |
| Storage | `posts.media` stores `PostMedia | null`; there is no Post upload mutation, `imageIds` field, `postImages` table, image processor, or Post media storage boundary. A Post mutation creates or updates its `post:<postId>` feed projection with source owner and visibility. |
| Feed read and authorization | `convex/feed.ts` reads the Post by projection source ID, verifies source key, source ID, owner, and visibility, then applies source visibility authorization. Missing, corrupt, or unauthorized sources are omitted. Hydration returns stored media directly; server never fetches arbitrary media URLs. |
| Browser render and external calls | `src/features/feed/post-media-card.tsx` renders external images with lazy loading, `referrerPolicy="no-referrer"`, contextual alt text, and a fixed unavailable state on load failure. Videos are safe new-tab links with `rel="noreferrer noopener"`; valid YouTube IDs may render the provider thumbnail. Vimeo and other providers remain linked cards. External host availability is not represented as an app-side success. |
| Error path and retry | Invalid or unsafe input remains in the composer and reports inline/Sonner errors. Failed mutations do not clear the draft. Broken images stay inside fixed card geometry. No hidden fallback fetch or upload retry exists; external media failures remain explicit. |
| Owner | Composer/UI owns draft state and render; shared social contracts own client validation; `convex/posts.ts` and `convex/socialPolicy.ts` own server writes and normalization; `convex/feed.ts` owns projection hydration and authorization. |

## Legacy Post cleanup state

Development migration verification for the final schema used indexed page size 50 and produced this aggregate:

| Target | Processed | Preserved Posts | Deleted Posts | Deleted Images | Deleted Feed Cards | Deleted Storage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `posts` | 1 | 1 | 0 | 0 | 0 | 0 |
| `postImages` | 0 | 0 | 0 | 0 | 0 | 0 |
| `feedCards` | 1 | 0 | 0 | 0 | 0 | 0 |

Verification found zero legacy Post IDs, zero `postImages` rows, and zero orphan Post feed projections. The preserved text Post had one empty legacy field cleared during final schema recovery; no Post content, media URL, or storage identifier was exposed. Final `convex/schema.ts` contains required nullable `posts.media` and no legacy Post image table or field.

## Review writes

Review create, draft save, publish, edit, and visibility mutations update the source Review and its discovery fields atomically. Discovery text contains normalized anime title, author name, and username. Rating bands are required; `none` is valid only for an unrated Draft. Published Reviews without a Rating fail explicitly.

Review deletion removes the source row. Activity deletion removes only the feed projection and does not remove Review discovery. New Review fields start from the author's account visibility after the complete profile resolves. Existing Drafts and published Reviews retain their stored visibility.

## Feed projection reads

Every Post, Review, Completed, or Rewatched card resolves its source row before hydration. Missing, deleted, inactive, draft, or mismatched sources are omitted. Source key, source ID, owner, anime ID when applicable, and visibility must match the projection. Authorization uses source owner and visibility; projection fields cannot widen access.

## Review discovery reads

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

- Review discovery uses bounded database indexes plus one search index.
- List Progress uses one `by_user` index and indexed `userAnimeEntries.by_user_status` reads.
- Reads and migrations use indexed pagination. No Convex action or table-filter scan is used.

## Migration verification

Development deployment verification processed zero existing Review rows with zero mismatches. List Progress processed two profiles, rebuilt one projection, and verified zero mismatches. After verification, Review `searchText` and `ratingBand` became required and the deployment passed again.

Backfills are resumable and idempotent. Verification returns offending Review or user IDs. Any mismatch, missing author/anime source, or invalid published Rating stops schema tightening; no stale or fabricated fallback is allowed.
