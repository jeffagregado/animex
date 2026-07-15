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

## Review writes and warning flow

| Hop | Current state |
| --- | --- |
| Entry and input | `src/features/reviews/ui/review-editor-page.tsx` collects a text `rating` draft, Summary, `containsSpoiler`, visibility, and serialized rich-text body. Draft starts at Rating `50`; focused partial values remain text. |
| Validation | `src/features/reviews/review-validation.ts` rejects nonnumeric, out-of-range, and over-one-decimal Rating values. Drafts may keep Rating empty; Publish/Update require a complete valid Rating and Summary. |
| Transform | Complete Rating becomes `number | null`; `containsSpoiler` remains warning metadata. `ReviewSpoilerBadge` marks the warning, while Summary, ordinary body text, and independent rich-text spoiler blocks retain their own rendering/reveal behavior. |
| Storage | `convex/reviews.ts` persists `containsSpoiler` on `reviews` and projects it to Review feed cards. Create, draft save, publish, edit, and visibility mutations update source and discovery fields atomically. |
| External calls | Convex mutations/queries only; Review writes do not call AniList or another external service. |
| Retry and error | Invalid fields stay in the editor with explicit errors. Convex failures surface through the existing error/toast paths; no fabricated Review fallback is rendered. |
| Output | Feed Review body is one whole-body `/reviews/:reviewId` link with visible Summary and badge. Latest Reviews rows are whole-row Review Detail links with title, author, time, visible compact Summary, and optional badge. `/reviews` and Anime Detail Reviews render `PublishedReviewCard`; Review Detail uses `UserAvatar`, badge, Summary, and body. |
| Owner | Editor and Review UI own draft/render state; `convex/reviews.ts` owns persistence, discovery projection, and source authorization; `convex/feed.ts` owns feed hydration and projection authorization. |

Review source deletion is a Review Detail action. Review activity owner menu is labeled `Delete`, calls `reviews.removeActivity`, and removes only the Review feed projection; activity-only confirmation and success copy remain. Activity deletion does not remove Review discovery.

## Review cleanup boundary

The guarded development cleanup completed before the `containsSpoiler` schema contract was reopened. Bounded inventory was 3 Reviews, 3 Review feed cards, and 2 `animeReviewStats` rows. Cleanup deleted 3 Reviews and 2 stats rows, removed linked Review cards, found 0 orphan Review cards, and produced zero remaining rows in all three target sets. A second full pass deleted 0. Protected counts were unchanged: 1 Post, 1 Post card, 4 Completed cards, and 1 Rewatched card. The temporary cleanup functions and write gate are absent from the final source.

## Shared author Avatar flow

`src/components/user-avatar.tsx` receives avatar URL, display name, accessible label, and `sm`/`md`/`lg` size. A valid image uses a cover crop; missing or failed images render the uppercase first display-name character, or `?` for an empty name, with the label exposed once to assistive technology. URL changes reset the failure state. Feed Post, Review, Completed, and Rewatched cards plus Review Detail use this shared component; Review listing cards retain their approved anime-cover layout.

## Discover rail layout boundary

`HorizontalRail` applies `items-stretch` only to direct children in the current rail. `AnimePoster` link/article fill available height and the metadata column grows with year/format aligned at the bottom. Trending, Seasonal, Recommendations, and Home Seasonal inherit this per-rail equalization through `DiscoverSectionRail`; no cross-rail measurement, fixed global height, width, cover ratio, snap, or scroll-control change is involved.

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
