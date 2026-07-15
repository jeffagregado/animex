# Phase 5 Editor, Post Media, And Feed Feedback Design

Status: IMPLEMENTED, VERIFIED, and integrated on `dev`; final closure is tracked in `TODO.md`, `design-qa.md`, and `docs/architecture/review-discovery-data-flow.md`.

## Scope

Improve Review authoring media placement and spoiler editing, replace Post file uploads with one external media URL, simplify feed owner actions, add activity metadata, align Home utility surfaces, and remove the Discover main-column Genres section.

No Phase 7 social behavior. No production deployment. No Convex actions. No new production dependency.

## Reference Behavior

The RichTextEditor Basic Editor demo is the interaction reference for media editing:

- A collapsed caret inserts media at its position.
- A non-collapsed text selection is replaced by inserted media.
- Backspace removes media immediately before the caret.

AnimeX keeps block-level Review media rather than introducing arbitrary inline HTML.

## Review Media Editing

- Image and Video toolbar actions capture the active Lexical selection before opening their dialogs.
- Successful submission restores that selection and inserts the media block there.
- A non-collapsed selection is replaced, matching the reference editor.
- A missing or stale selection inserts media as the first document block, never at the end.
- Insertion leaves a valid caret after the media so writing can continue.
- Image and Video nodes support themed click selection with a visible cyan outline.
- Backspace and Delete remove a selected media node.
- Backspace at the start of the block after media removes the preceding media node.
- Delete at the end of the block before media removes the following media node.
- Removal leaves a valid nearby caret and participates in Undo/Redo as one history operation.
- Existing HTTPS, provider, media-count, document-size, depth, node-count, and visible-text validation remains authoritative.
- Review image alt text remains required. Review video labels remain optional.

## Spoiler Toggle

- Spoiler becomes a true toggle.
- A selection containing no spoiler wrapper is wrapped using current block behavior.
- A cursor or selection inside one or more spoiler wrappers unwraps those wrappers.
- Unwrapping preserves text, headings, quotes, lists, inline formatting, and media.
- Mixed selection unwraps selected spoiler wrappers; it does not wrap neighboring plain blocks in the same action.
- Spoilers never nest.
- Undo/Redo restores the preceding wrap or unwrap operation.

## Post Media Contract

Posts accept zero or one external media item:

```ts
type PostMedia =
  | {
      type: 'image'
      url: string
      description: string | null
    }
  | {
      type: 'video'
      url: string
      provider: 'youtube' | 'vimeo' | 'external'
      label: string | null
    }
```

- User explicitly chooses Image or Video; AnimeX does not infer type from an extension.
- URL must use HTTPS, contain no credentials, and contain no more than 2,048 characters.
- No file input, Convex upload URL, image processing, OpenGraph request, remote metadata request, iframe, or inline playback remains.
- Image description is optional. Blank description renders `Image attached to post by {username}`.
- Video label is optional. Blank label uses existing provider/domain copy.
- YouTube may derive a thumbnail from a validated video ID. Vimeo and other HTTPS URLs use linked provider/domain cards.
- External media opens with safe new-tab attributes.
- External images use lazy loading and `referrerPolicy="no-referrer"`.
- Broken images render an explicit unavailable state without collapsing card geometry.
- Text-only, media-only, and text-plus-media Posts are valid.
- Post text remains capped at 280 characters.
- Existing visibility, whole-Post spoiler, edit, delete, idempotency, and feed-time rules remain unchanged.

## Legacy Post Cleanup

Approved destructive scope is limited to Posts containing uploaded image files.

Migration uses two schema stages:

1. Transitional schema accepts legacy `imageIds` and new nullable `media`.
2. An idempotent internal migration deletes each Post with non-empty `imageIds`, its feed projection, referenced `postImages` rows, and referenced Convex Storage objects.
3. The same migration deletes remaining pending or orphan `postImages` rows and their storage objects.
4. Text-only Posts remain and receive `media: null`.
5. Verification requires zero legacy image Posts, zero `postImages` rows, zero referenced storage objects, and no orphan Post feed projections.
6. Final schema removes `imageIds`, the `postImages` table, upload mutations, image processor, upload hook state, and file-picker/grid UI.

Migration must report processed, deleted, preserved, and storage-deletion counts. Any missing referenced source or storage object fails explicitly; no silent fallback.

## Feed Activity Metadata

- Completed and Rewatched cards replace `View Anime Detail` with `Year · Format`.
- Missing metadata renders `TBA · Anime`.
- The whole anime row remains the detail link.
- A feed-only anime contract adds nullable `seasonYear` and `format` to milestone cards.
- Review, discovery, and detail anime DTOs do not expand.
- Feed hydration reads year and format from existing cached anime summary data; no AniList request changes.

## Feed Owner Menus

- Post menu destructive source action reads `Delete`.
- Completed and Rewatched menu destructive activity action reads `Delete`.
- Review feed menu removes `Delete Review` entirely.
- Review feed activity action reads `Delete` and uses destructive red styling.
- `Delete` removes only the Review feed activity; Review source and Anime Reviews entry remain.
- Review source deletion stays available only on Review Detail.
- Existing confirmation dialog titles, descriptions, mutation behavior, and Sonner messages remain unchanged.

## Home And Discover

- Home desktop This Week and Upcoming use the same `rounded-lg border border-border bg-card p-4` card surfaces as Discover.
- Home keeps current utility order and existing cached Discover data flow.
- Discover removes only the main-column Genres section.
- Desktop Top Genres remains.
- Genre filter, Top Genres selection, URL state, and search behavior remain.
- No responsive sidebar or data-fetch changes are introduced.

## Error And Security Rules

- Client and server validate Post media independently with the same strict contract.
- Invalid or unsafe URL input stays in the composer and shows explicit inline and Sonner errors.
- AnimeX never fetches arbitrary Post media URLs on its server.
- Media host availability remains external; broken-image and linked-video states remain truthful.
- Legacy cleanup is idempotent and scoped to the approved current Convex environment.
- Post deletion, Review activity removal, and milestone deletion keep current auth and ownership checks.

## Validation Contract

- Review editor tests: caret insertion, selection replacement, missing-selection top insertion, click selection, adjacent Backspace/Delete, selected-node deletion, caret recovery, Undo/Redo, image and video parity, and Preview/published parity.
- Spoiler tests: wrap, unwrap, mixed selection, formatting preservation, media preservation, nested-spoiler rejection, and Undo/Redo.
- Post contract tests: no media, image, video, invalid HTTPS, credentials, URL length, optional description/label, contextual alt fallback, media-only publishing, edit/replace/remove, idempotency, and source-truth feed hydration.
- Migration tests: delete only legacy image Posts, preserve text-only Posts, delete feed projections and storage, clear pending/orphan claims, resume safely, and verify zero legacy rows.
- Feed tests: year/format, fallback metadata, exact owner-menu labels, destructive styling, Review Delete absence, and unchanged confirmation behavior.
- Home/Discover tests: matching utility card surfaces, removed main Genres, retained Top Genres, and retained genre filtering.
- Run route generation when required, two-stage Convex sync and migration verification, focused integration tests, full tests, TypeScript, build, Fallow new-only audit, client AniList endpoint scan, and `git diff --check`.
- Browser QA at 390, 768, and 1280 px covers caret/selection insertion, Backspace/Delete, spoiler toggle, Undo/Redo, Post media states, owner menus, confirmation dialogs, hover, focus, touch, Home surfaces, Discover layout, console, failed requests, hydration, layout shift, and overflow.

## Exclusions

- No Post file uploads or first-party Post media storage.
- No more than one Post media item.
- No video uploads, inline playback, iframe, OpenGraph preview, or arbitrary server fetch.
- No random image alt identifiers.
- No Review source deletion from feed cards.
- No removal of desktop Top Genres or genre filters.
- No Phase 7 Like, Comment, Follow, or bookmark behavior.
