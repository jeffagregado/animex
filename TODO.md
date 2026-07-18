# TODO

## Phase 3 AniList And Discover

- [x] Persist approved Phase 3 design, implementation plan, and canonical Discover references. Owner: controller.
- [x] Lock normalized anime, section, cache, search, error, slug, season, and TTL contracts through red-green tests. Owner: controller.
- [x] Add Convex summary/cache/lease tables with validated queries and mutations; no Convex actions. Owner: cache worker.
- [x] Add server-only AniList transport, normalization, section refresh, retries, errors, and live search. Owner: server worker.
- [x] Move Home and Discover under shared `_public/route.tsx` shell and regenerate routes. Owner: route worker.
- [x] Build approved responsive Discover UI, complete states, filters, and infinite search. Owner: UI worker.
- [x] Run spec review, thermo review, full validation, live AniList smoke, responsive browser QA, docs/data-flow sync, and final integrated review. Final review PASS with no findings. Owner: controller + reviewer + QA.

Status: COMPLETE on `dev`; final integrated review PASS with no findings. Phase 4 is tracked in its completed section below.

## Auth Form Field Errors

- [x] Add integration coverage for validation timing, focus, ARIA, roles, server mapping, intent handling, and transformed values. Owner: controller.
- [x] Implement shared auth validation, focus, notice, and safe error-classification contract. Owner: controller + shared worker.
- [x] Migrate standard auth pages. Owner: standard worker + controller.
- [x] Migrate verification and username flows. Owner: controller.
- [x] Complete spec review, mandatory auth thermo review, full validation, responsive browser QA, and current-state publication. Owner: controller + reviewer + QA.

Status: PASS. 18 files / 138 tests; TypeScript; client + SSR build; `git diff --check`; browser QA at 390/768/1280; reviewer spec + thermo PASS. Fallow retains known `react-dom` test-only false positive. Existing 514.27 kB client chunk warning unchanged.

## Phase 2 Formal Closure Validation

Phase 2 closed on `dev` at commit `f7e0c58`.

- [x] Trace Phase 2 requirements to implementation and tests.
- [x] Review auth security, state transitions, and edge cases.
- [x] Run maintainability and TanStack Start boundary review.
- [x] Rerun root gates: 17 files / 132 tests, TypeScript, client + SSR build, Convex dev push, `git diff --check`, Fallow, and duplicate scan.
- [x] Complete desktop, mobile, tablet, native-form, auth/email, OAuth, responsive, network, and console QA.
- [x] Record formal Phase 2 closure verdict: PASS. Final branch review PASS; formal QA PASS; no P1/P2 blockers.

## Phase 2 Formal Closure Status

Implementation branch: merged to `dev`; source feature branch deleted after merge.

- [x] Lock shared auth/error/return contracts. Owner: controller + worker.
- [x] Implement durable Convex auth security and lifecycle. Owner: worker.
- [x] Integrate auth UX and migrations. Owner: controller + worker.
- [x] Complete independent review, browser, Google, and Resend QA. Owner: reviewer + QA.
- [x] Publish closure verdict and current auth-flow UX summary. Owner: controller.

Root gates: 18 files / 138 tests pass; TypeScript; client + SSR build; Convex dev push after temporary harness removal; `git diff --check`; Fallow complexity 0; duplicate scan 0. Known `react-dom` test-only Fallow false-positive warning remains.

Live UX: desktop, mobile, and tablet clean; sanitized OAuth callback; JavaScript-disabled native auth forms submit by POST without email/password in URL; hydrated password sign-in returns Home; current Resend sandbox verification OTP delivered and previewed; verify/profile complete; email correction old → new uses one delivered and previewed OTP then profile; reset link delivered and previewed; password-change security notice delivered; old password rejected and new password accepted; returning Google sign-in returns Home; console clean.

P1 regression: all seven named-input auth forms enforce `method="post"`; regression test red then green; reviewer spec + quality PASS.

QA cleanup: two smoke identities inspected and cleaned; post-inspect counts are zero; temporary QA env gate unset; harness removed; regenerated/deployed API has no harness references.

Non-blocking QA note: in-app browser keyboard Tab command did not advance focus; semantics, roles, labels, and native controls reviewed, and QA marked this non-blocking.

Remaining P3 only: 514.27 kB client chunk; Resend sandbox only with no verified production domain; abrupt avatar store termination can leave an orphan window.

- [x] [P1] Make Better Fetch auth endpoint failures block caller success paths.
- [x] [P1] Keep password-reset session revocation independent from security-notice email delivery.
- [x] [P1] Route password users with unverified email back to Email OTP Verification.
- [x] [P1] Block implicit OAuth email linking and reject missing or unverified provider email before identity creation.
- [x] [P2] Exclude Pending OAuth Sign-Up identities from Password Reset eligibility.
- [x] [P2] Finish Verification Email Change after its verified change-email OTP without requesting a nonexistent second OTP.
- [x] [P2] Handle malformed verification-email query input without crashing the route.
- [x] [P2] Apply durable auth abuse limits and the required 60-second OTP resend cooldown.
- [x] [P2] Copy provider avatars into AnimeX-owned storage before profile creation.
- [x] [P2] Add weekly abandoned Pending OAuth Sign-Up cleanup.
- [x] [P2] Preserve safe same-origin public-page return after sign-in.
- [x] [P2] Enforce Account Email Conflict behavior and copy during sign-up.
- [x] [P3] Remove the unused reset-token check route and regenerate the route tree.
- [x] [P3] Replace unchecked auth-state response casts and the generic server-route type erasure.

## Phase 1 Foundation

- [x] Fix current TypeScript unused-import errors.
- [x] Initialize Fallow if absent.
- [x] Install approved production dependencies from `PLAN.md`.
- [x] Replace starter route and CSS with AnimeX app shell.
- [x] Build desktop top nav and mobile bottom nav.
- [x] Run Phase 1 validation and pause for review.

## Phase 2 Auth And User Records

- [x] Wire Better Auth to Convex using `@convex-dev/better-auth`.
- [x] Configure Google OAuth from Convex env.
- [x] Configure Resend SDK email sender from Convex env.
- [x] Implement sign-up, sign-in, email OTP verification, password reset, and OAuth username completion routes.
- [x] Keep Better Auth identity separate from AnimeX `users` profile record.
- [x] Rename Convex user fields and functions to concise auth/profile naming.
- [x] Enforce case-insensitive username uniqueness while preserving typed display capitalization.
- [x] Remove username from password sign-up.
- [x] Send verified password users without profile to username completion.
- [x] Remove pre-verification username reservation.
- [x] Add auth state and guard helpers for private pages/features.
- [x] Add header sign-in/sign-out action.
- [x] Replace password reset OTP UI with reset-link flow.
- [x] Keep auth pages on the shared AnimeX header.
- [x] Add AnimeX logo asset and use it in header/auth surfaces.
- [x] Generate missing auth page proposal refs.
- [x] Split home shell sections into focused React files.
- [x] Remove visible auth-loading label from the header.
- [x] Run Phase 2 validation and pause for review.

## Phase 2 Auth Closure

- [x] Update `PLAN.md` to include the Phase 2 Auth Closure plan.
- [x] Align missing auth pages to the Verify Email container reference.
- [x] Add password visibility toggles to sign-in, sign-up, and reset-password forms.
- [x] Add verification resend and mistyped-email change flow.
- [x] Add reset-password invalid and success states with locked copy.
- [x] Redirect auth pages by auth/profile state.
- [x] Hide private Home/header/mobile surfaces from signed-out and pending users.
- [x] Extract repeated Convex Better Auth proxy helpers.
- [x] Push Convex auth config changes to dev with `pnpm exec convex dev --once`.
- [x] Run TypeScript, test, build, Fallow, and browser QA.
- [x] Prevent OAuth users with completed profiles from seeing username completion.
- [x] Keep browser autofill from repainting auth fields white.

## Phase 2 Auth Form Refactor

- [x] Migrate auth forms to installed TanStack Form.
- [x] Move auth input validation to Zod-backed schemas.
- [x] Validate app-owned auth/profile API request bodies only where it improves security without changing Better Auth proxy behavior.
- [x] Preserve current auth UI, copy, redirects, and security behavior.
- [x] Run TypeScript, test, build, Fallow, browser QA, and review.

## Reset Password Submit Validation Fix

- [x] Render set-new-password fields whenever a reset token is present.
- [x] Move reset token validity enforcement to reset-password submit.
- [x] Keep missing-token and Better Auth invalid-token errors clear.
- [x] Run focused tests, TypeScript, Fallow, and browser QA.

## Reset Password SSR Console Fix

- [x] Reproduce reset-password SSR `window is not defined` failure with a regression test.
- [x] Move reset token lookup out of render-time browser APIs.
- [x] Scan related auth browser API usage for SSR risk.
- [x] Run full validation and browser console QA.

## Async Button Loading Polish

- [x] Add reusable async button loading UI for auth/header async actions.
- [x] Add header sign-in skeleton while auth state loads.
- [x] Add pointer cursor for enabled buttons.
- [x] Run TypeScript, tests, build, Fallow, and browser QA.

## Implementation Planning

- [x] Save AnimeX MVP implementation plan to `PLAN.md`.

## Product Grilling

- [x] Define what counts as activity.
- [x] Decide that Score alone does not create feed activity.
- [x] Decide that Completed Anime and Rewatch Completion Activity include Score when available.
- [x] Decide that Completed Anime activity shows the current Score from the anime detail source of truth, not a historical Score snapshot.
- [x] Decide whether editing an existing Score creates feed activity.
- [x] Decide whether Anime Status changes other than Completed Anime create feed activity.
- [x] Decide what happens when Completed Anime changes back to another Anime Status.
- [x] Decide whether completing again creates a duplicate completion activity.
- [x] Decide that Completed Anime activity and Rewatch Completion Activity can coexist for the same anime and user.
- [x] Decide that new Rewatch Completion Activity uses current Account-Level Default Visibility rather than copying existing Completed Anime card visibility.
- [x] Decide that deleting a Completed Anime card does not suppress later Rewatch Completion Activity for the same anime.
- [x] Decide that deleting a Rewatch Completion Activity does not delete or hide the existing Completed Anime card.
- [x] Decide that changing Anime Status to Rewatched creates Rewatch Completion Activity.
- [x] Decide that there is only one Rewatch Completion Activity per anime per user.
- [x] Decide that later Rewatched completions bump the existing Rewatch Completion Activity and update its timestamp.
- [x] Decide that later Rewatched completions keep the existing Rewatch Completion Activity visibility when bumping it.
- [x] Decide that a Private Rewatch Completion Activity stays private after a later rewatch bump.
- [x] Decide that a Followers only Rewatch Completion Activity uses current Follow relationships after a later rewatch bump.
- [x] Decide that anime detail pages show Rewatch Count and Rewatch History.
- [x] Decide that Rewatch Count is owner-only.
- [x] Decide that Rewatch History is owner-only.
- [x] Decide whether owners can remove mistaken Rewatch History entries.
- [x] Decide that Rewatch Entry Removal only removes the latest entry in MVP.
- [x] Decide what Rewatch Entry Removal does to the Rewatch Completion Activity timestamp or card.
- [x] Decide that Rewatch Completion Activity comments and likes stay when Rewatch Entry Removal only rolls back the card timestamp.
- [x] Decide that rollback moves the Rewatch Completion Activity to the rolled-back feed position without notification or new bump.
- [x] Decide that rollback keeps showing the current Score from the anime detail source of truth, not a historical Score snapshot.
- [x] Decide what happens to Rewatch Completion Activity comments and likes when Rewatch Entry Removal removes the card.
- [x] Decide that feed cards do not show Rewatch Count.
- [x] Decide that Rewatch Completion Activity text uses simple `rewatched` wording without count, `again`, or history hint.
- [x] Decide default visibility for Posts, Reviews, generated Activity cards, and Score where it appears.
- [x] Decide whether feed is follow-first, global-first, or hybrid.
- [x] Decide feed views: Home, Following, and Global.
- [x] Decide that signed-out users see only the public read-only Home Feed, not Following or Global tabs.
- [x] Decide whether Follow/Unfollow relationships exist.
- [x] Decide whether following is open by default or approval-based.
- [x] Decide whether short text posts exist separately from reviews and activities.
- [x] Decide whether review creation creates a feed activity card.
- [x] Decide whether users can edit or delete their own posts, reviews, and comments.
- [x] Decide whether feed card authors can delete comments on their own feed cards.
- [x] Decide whether comment authors are notified when feed card authors delete their comments.
- [x] Decide Comment Removal Notification context and title usage.
- [x] Decide which Notification Preference controls Comment Removal Notifications.
- [x] Decide whether deleted comments leave visible placeholders.
- [x] Decide whether Comment Deletion removes old notifications.
- [x] Decide whether edited posts, reviews, and comments are visibly marked.
- [x] Decide whether the Edited Indicator shows an edited time.
- [x] Decide whether editing posts, reviews, or comments refreshes feed order.
- [x] Decide which feed items users can report.
- [x] Decide whether Comment Replies have a separate report type.
- [x] Decide whether Content Reports require reasons and which MVP reasons exist.
- [x] Decide whether the Other report reason requires a short explanation.
- [x] Decide whether users can report the same content more than once.
- [x] Decide whether same-content reports are grouped into Moderation Cases.
- [x] Decide whether Moderation Cases are visible to normal users.
- [x] Decide whether reporters receive moderation outcome notifications.
- [x] Decide whether moderators can remove reported content globally.
- [x] Decide whether Moderation Removal notifies content authors.
- [x] Decide whether users can disable Moderation Removal Notifications.
- [x] Decide what authors see when opening Moderation Removal Notifications.
- [x] Decide whether moderators can restore content after Moderation Removal.
- [x] Decide whether authors can edit or delete content after Moderation Removal.
- [x] Decide whether author deletion after Moderation Removal sends notifications.
- [x] Decide whether Moderation Removal keeps old likes and comments visible.
- [x] Decide that Review Likes are hidden while a Review is under moderation review.
- [x] Decide that Review Moderation Removal deletes source-level Review Like records while preserving moderation snapshots.
- [x] Decide that hidden Review Likes return when a Moderation Case closes without Moderation Removal.
- [x] Decide that users cannot add Review Likes while a Review is under moderation review.
- [x] Decide that Review authors cannot see Review Like counts while their Review is under moderation review.
- [x] Decide that removed Review authors do not see Review Like counts in unavailable notices.
- [x] Decide whether Comment Replies stay visible after Comment Moderation Removal.
- [x] Decide whether original Comments stay visible after Comment Reply Moderation Removal.
- [x] Decide whether Comment Reply Moderation Removal sends a notification.
- [x] Decide whether commenters or repliers are notified after Moderation Removal.
- [x] Decide whether moderation-removed content counts in profile totals.
- [x] Decide whether moderation-removed Reviews count in anime review metrics.
- [x] Decide whether editing reported content resets reports or Reporter Hide.
- [x] Decide whether deleting reported content removes Content Reports.
- [x] Decide whether Content Reports preserve report-time content.
- [x] Decide what Report Snapshots preserve.
- [x] Decide that Report Snapshots preserve report-time Post-media copies and display metadata rather than depending on current external references.
- [x] Decide whether reported content is hidden immediately from the reporting user.
- [x] Decide whether reporters can undo Reporter Hide.
- [x] Decide what Comment Reply reporting hides from the reporting user.
- [x] Decide whether reported content authors are notified.
- [x] Decide what Review reporting hides from the reporting user.
- [x] Decide that Reporter Hide removes reported Reviews from the reporter's Anime Review Metrics.
- [x] Decide whether users can hide content without reporting it.
- [x] Decide whether users can block other users.
- [x] Decide whether blocking automatically creates a Content Report.
- [x] Decide whether blocked users can report each other's content.
- [x] Decide whether users can report old visible content after Unblock.
- [x] Decide whether blocking removes or prevents Follow relationships.
- [x] Decide whether unblocking restores removed Follow relationships.
- [x] Decide that Anime Review Metrics return after Unblock only when current access allows.
- [x] Decide whether users can view and manage a Blocked Users List.
- [x] Decide whether blocking hides User Profile content in both directions.
- [x] Decide whether blocked profile wording is neutral or explicit.
- [x] Decide whether blocking hides feed content in both directions.
- [x] Decide that Blocked Feed Visibility excludes Reviews from Anime Review Metrics for the blocked users.
- [x] Decide whether blocking prevents comments and likes between users.
- [x] Decide what happens to existing comments and likes after blocking.
- [x] Decide whether old notifications from blocked users remain visible.
- [x] Decide what happens when a notification target becomes unavailable by visibility.
- [x] Decide that old Review Like Notifications follow Notification Target Access.
- [x] Decide that old Review Like Notifications become usable again when Review Visibility restores access.
- [x] Decide that old Review Like Notifications resolve unavailable while a Review is under moderation review.
- [x] Decide that old Review Like Notifications become usable again when a Moderation Case closes without Moderation Removal.
- [x] Decide that old Review Like Notifications stay in history after Review Moderation Removal deletes Review Like records.
- [x] Decide that opening a notification marks it read even when the target is unavailable.
- [x] Decide that the notification icon/header shows an unread count badge capped at `99+`.
- [x] Decide that Notification Badge updates to the remaining unread count after Notification Preview marks displayed unread notifications read.
- [x] Decide that Notification Preview marks displayed unread notifications read.
- [x] Decide that Notification Preview shows up to 50 unread notifications with Show more to the Notification Page when more unread remain.
- [x] Decide that Notification Preview shows an empty state with a history link when there are no unread notifications.
- [x] Decide that Notification Page loads 50 notifications by default, newest first, and uses Load More for older notifications.
- [x] Decide that Notification Page has a Mark all as read action for all current unread notifications.
- [x] Decide that Notification Page has no filters in MVP.
- [x] Decide that Notification Page uses subtle unread styling instead of unread filters.
- [x] Decide that notification rows show relative timestamps.
- [x] Record that the first generated notification mockup is the preferred visual direction.
- [x] Decide that user-caused notifications use the actor avatar while system/moderation notifications use a neutral AnimeX/Ami icon.
- [x] Decide that notification rows use target thumbnails selectively.
- [x] Decide that users cannot delete or clear notifications manually in MVP.
- [x] Note future optional automatic cleanup for old notifications.
- [x] Decide whether new notifications are created between blocked users.
- [x] Decide whether followers receive notifications for new Posts and Reviews.
- [x] Decide whether MVP notifications are in-app only or include email/push.
- [x] Decide whether Follower Activity Notifications include anime titles when available.
- [x] Decide whether users receive notifications for new follows, comments, likes on their own feed cards, and Review Likes.
- [x] Decide whether self-likes create Account Interaction Notifications.
- [x] Decide whether Review Likes create Account Interaction Notifications.
- [x] Decide that Review Likes after Review Activity deletion still create Review Like Notifications when allowed.
- [x] Decide that Review Like Notifications stay in history after the liker removes the Review Like.
- [x] Decide whether Comment Likes create Account Interaction Notifications.
- [x] Decide that feed-card Like and Comment Like notifications stay in history after the liker removes the Like.
- [x] Decide that repeat like toggles do not create another like notification for the same actor and target.
- [x] Decide that MVP does not bundle notifications from different actors.
- [x] Decide that MVP does not show notification toasts, banners, or sounds.
- [x] Decide whether Comment Replies create Account Interaction Notifications.
- [x] Decide whether Comment Reply Notifications deduplicate with feed-card Comment notifications.
- [x] Decide whether editing Comment Reply Reply Tags changes notifications.
- [x] Decide whether Follower Activity Notifications can be disabled separately from Account Interaction Notifications.
- [x] Decide whether Completed Anime activity creates follower notifications.
- [x] Decide whether Rewatch Completion Activity bumps or Rewatch Activity Recreation create follower notifications.
- [x] Decide whether blocked users appear in user search and search autocomplete.
- [x] Decide whether stored comments and likes become visible after unblocking.
- [x] Decide whether users can delete generated activity cards.
- [x] Decide whether users can edit generated Activity card text.
- [x] Decide whether Activity Deletion removes prior notifications.
- [x] Decide whether Activity Deletion removes the Activity card's Comments, Comment Replies, feed-card Likes, and Comment Likes.
- [x] Decide whether Activity Deletion sends Comment Removal Notifications for removed Activity card Comments.
- [x] Decide whether prior interaction notifications remain after Activity Deletion removes their target interaction.
- [x] Decide whether deleting a Review Activity card deletes the Review source.
- [x] Decide that Review Summary remains on anime detail page after Review Activity deletion when Review Visibility allows.
- [x] Decide that anime detail pages do not show an Activity Deletion marker for Reviews.
- [x] Decide that deleted Review Activity cards have no manual restore option in MVP.
- [x] Decide that deleted Activity cards disappear from profile activity surfaces too.
- [x] Decide that profile activity does not backfill deleted Review Activity with Review source entries.
- [x] Rename Public Profile to User Profile.
- [x] Decide that User Profile has a Reviews tab sourced from visible Review sources.
- [x] Decide that Review Cards show an anime image, anime name, Review Rating, Review Summary, and Review Like action.
- [x] Decide that Review Likes belong to Review sources, not feed cards.
- [x] Decide that Review Detail Pages share the same Review Like as Review Cards.
- [x] Decide that Review Cards and Review Detail Pages show Review Visible Like Count when nonzero.
- [x] Decide that Activity Deletion does not remove source-level Review Likes.
- [x] Decide that Review Visibility changes keep source-level Review Likes stored.
- [x] Decide that authors see nonzero Review Visible Like Count on their own Private Reviews.
- [x] Decide that viewers cannot remove stored Review Likes while Review Visibility blocks access.
- [x] Decide whether Review Edits recreate a deleted Review Activity card.
- [x] Decide that Review Rating edits still update Anime Review Metrics after Review Activity deletion.
- [x] Decide that Review Rating edits update Anime Review Metrics without new Review Activity or feed bump.
- [x] Decide that Anime Review Metrics use current Review Rating, not a Review Activity snapshot.
- [x] Decide that Review Activity displays current Review Rating, not a publish-time snapshot.
- [x] Decide that Review Summary edits update Review Activity and anime-page review surfaces silently with `edited`.
- [x] Decide that Review Activity shows author name, anime title, Review Rating, and Review Summary, not full Review body.
- [x] Decide that Review Summary is a separate user-written field, not auto-generated or truncated.
- [x] Decide that Review Summary is required to publish Review.
- [x] Decide that Review Summary is capped at 280 characters.
- [x] Decide that Review Detail Pages do not have separate Comments.
- [x] Decide whether Review Visibility controls Review Detail Page and anime-page review surfaces.
- [x] Decide where old notifications for deleted Review Activity cards resolve.
- [x] Decide where old notifications for deleted Completed Anime and Rewatch Completion Activity cards resolve.
- [x] Decide whether deleting a Completed Anime or Rewatch Completion Activity card changes the underlying anime list entry.
- [x] Decide whether deleted completed-anime Activity cards can be recreated by ordinary re-completion.
- [x] Decide that ordinary Score changes do not recreate deleted Activity cards.
- [x] Decide that later Rewatched completions recreate a deleted Rewatch Completion Activity.
- [x] Decide that Rewatch Activity Recreation does not restore interactions removed with the deleted rewatch card.
- [x] Decide that Rewatch Activity Recreation uses the current Account-Level Default Visibility.
- [x] Decide whether Completed Anime and Rewatch Completion Activity cards are reportable or moderation-removable.
- [x] Decide what deleting a Review removes.
- [x] Decide what happens to comments and likes when a feed card is deleted.
- [x] Decide whether whole Post or feed-card deletion sends Comment Removal Notifications for removed Comments.
- [x] Decide whether prior interaction notifications remain after Feed Card Deletion removes their target interaction.
- [x] Decide whether prior Follower Activity Notifications remain after Feed Card Deletion removes a Post.
- [x] Decide that Review Deletion removes Review from Anime Review Metrics for every viewer.
- [x] Decide whether prior Follower Activity Notifications remain after Review Deletion removes a Review.
- [x] Decide that Review Deletion removes source-level Review Likes and their Visible Like Count.
- [x] Decide whether deleted feed cards leave visible placeholders.
- [x] Decide whether reviews have long-form detail pages and a character limit.
- [x] Decide whether reviews require ratings and what review rating bounds use.
- [x] Clarify that 50 is the default review rating, not the minimum rating.
- [x] Decide whether review publishing creates one combined activity card with rating.
- [x] Split Review Rating from Score and decide both allow decimals.
- [x] Decide Review Rating and Score decimal precision.
- [x] Decide whether Score Edits update existing completion or rewatch Activity cards.
- [x] Decide what happens when Score Removal affects completion or rewatch Activity cards.
- [x] Decide whether Score Restoration returns Score to an existing completion or rewatch Activity card.
- [x] Rename legacy anime-list rating terminology to Score while keeping Review Rating on the 0-100 scale.
- [x] Decide whether anime detail and anime list controls label the value as Score.
- [x] Decide whether Score has a default value.
- [x] Decide whether feed cards support comments and likes.
- [x] Decide whether users can like their own Posts, Reviews, or Activity cards.
- [x] Decide whether Comments can receive Likes.
- [x] Decide whether Comment Likes use the same Visible Like Count behavior as feed-card Likes.
- [x] Decide whether self-likes count in the Visible Like Count.
- [x] Decide that AnimeX does not expose liked-user previews or Likes Lists in MVP.
- [x] Decide whether hidden Likes count in the Visible Like Count.
- [x] Decide that Reporter Hide and Block hide Review Likes only for affected viewers, not unrelated viewers.
- [x] Decide whether zero-like content shows a Visible Like Count.
- [x] Decide whether the Like action remains visible when the Visible Like Count is hidden.
- [x] Decide whether the Visible Like Count includes `like` text.
- [x] Decide whether high Visible Like Counts use compact notation.
- [x] Decide whether compact Visible Like Counts use decimals.
- [x] Decide the default avatar for users without uploaded avatars.
- [x] Decide whether Mascot Avatars are ordinary user fallback avatars.
- [x] Decide the mascot name.
- [x] Decide the selected Mascot Avatar direction.
- [x] Decide the primary Mascot Avatar variant.
- [x] Decide Mascot Avatar consistency anchors.
- [x] Decide whether future Mascot Avatar poses can vary.
- [x] Decide whether users can choose Preset Avatars.
- [x] Decide whether users can upload their own User Avatar.
- [x] Decide whether Ami Notebook design can vary across avatar variants.
- [x] Decide whether the approved Ami variants are MVP Preset Avatars.
- [x] Decide whether the Site Logo should match Ami's theme.
- [x] Decide the Site Logo composition.
- [x] Decide canonical brand spelling.
- [x] Decide Site Logo variant usage.
- [x] Decide desktop Site Navigation placement.
- [x] Decide mobile Site Navigation placement.
- [x] Decide whether Discover and Quick Search are separate.
- [x] Decide how Quick Search is opened.
- [x] Decide Quick Search result groups.
- [x] Decide whether Quick Search copies AniList layout.
- [x] Lock Home Feed Visual Direction to `docs/visual/home/home-desktop-feed.png` and `docs/visual/home/home-mobile-feed.png`, with Seasonal Anime above feed, two desktop columns, right-column Trending, and no profile picture/follower/following/likes/average-rating/episodes-watched utility stats.
- [x] Lock Discover Visual Direction to `docs/visual/discover/discover-desktop.png` and `docs/visual/discover/discover-mobile.png`, using the same poster-forward dark theme with Trending, Seasonal, Genres, Recommendations, and only muted future Manga placeholders.
- [x] Lock Anime Detail Visual Direction to `docs/visual/anime-details/anime-details-desktop-frieren.png` and `docs/visual/anime-details/anime-details-mobile-frieren.png`, with Overview metadata only, Reviews/Characters/Staff in their own tabs, no duplicate My Anime card, and no top/right-column character lists.
- [x] Lock User Profile final-state Visual Direction to `docs/visual/user-profile/user-profile-desktop-mobile.png`; Phase 7 keeps its non-social cover/avatar, tabs, stats, favorites, and viewer-allowed Activity.
- [x] Lock Quick Search Visual Direction to `docs/visual/quick-search/quick-search-modal.png` for desktop and `docs/visual/quick-search/quick-search-mobile-drawer.png` for mobile, with dimmed overlays, compact grouped results, no category selector, and a bottom-pinned mobile search field.
- [x] Lock AniList Metadata Flow: search returns candidates, selected AniList `id` is stored as canonical external anime ID, and metadata is fetched by AniList `id`.
- [x] Lock Discover Anime Population MVP: Discover uses AnimeX-managed AniList list caches, stores lightweight anime summaries by AniList `id`, and hydrates full anime metadata only when an anime detail page opens.
- [x] Decide desktop header navigation does not show `Community` in MVP.
- [x] Decide desktop header navigation does not show `Stats` in MVP.
- [x] Note future Manga lists for Discover design.
- [x] Decide Manga is a future Quick Search group.
- [x] Decide Quick Search result layout.
- [x] Decide mobile Search opens the locked drawer; View all Anime routes to `/discover` with the query, while Notifications remain in the mobile header.
- [x] Elaborate Create behavior after Discover/Search decisions.
- [x] Decide desktop Create placement.
- [x] Decide that signed-out desktop navigation shows `Sign in` and hides account-only controls.
- [x] Decide whether the Post Composer includes Reviews.
- [x] Decide Review creation entry point.
- [x] Decide that signed-out users do not see the anime detail Review Button.
- [x] Decide mobile Create behavior.
- [x] Decide whether Post Composer allows per-Post visibility.
- [x] Decide that Post Composer and Review creation show a Creation Visibility Selector before publishing, defaulted to Account-Level Default Visibility.
- [x] Decide that generated Activity source actions do not show a Creation Visibility Selector and inherit Account-Level Default Visibility silently.
- [x] Decide that signed-out users do not see Create entry points for the Post Composer.
- [x] Decide signed-out users have read-only social browsing with visible counts, public comments, and public reviews but no social action controls.
- [x] Decide that signed-out direct access to account-only pages redirects to `/home`.
- [x] Decide that signed-out direct links to non-public feed cards or Reviews redirect to `/home`.
- [x] Decide that deleted or moderation-removed direct links show an unavailable notice instead of redirecting to `/home`.
- [x] Decide that unavailable notices use only `This content is unavailable` with no reason details.
- [x] Decide that signing in from public pages returns to the same public page, while signing in from `/home` opens the signed-in Home Feed.
- [x] Decide that if a post-sign-in return target becomes unavailable during sign-in, the user sees `This content is unavailable`.
- [x] Decide that already signed-in users who open the sign-in page directly are redirected to the signed-in Home Feed.
- [x] Decide that Password Sign-In uses Account Email and password only; Account Email matching is case-insensitive and Username sign-in is not supported in MVP.
- [x] Decide that Password Sign-In failure uses generic `Invalid email or password.` and does not reveal whether the Account Email exists.
- [x] Decide that Password Sign-In uses Sign-In Abuse Limit after too many failed attempts, temporarily blocks more attempts, and shows generic `Too many attempts. Try again later.`.
- [x] Decide that Password Sign-In shows `Forgot password?` under the password field and before the submit button, linking to the Password Reset request page.
- [x] Decide that `Forgot password?` remains visible during Sign-In Abuse Limit because the limit blocks sign-in attempts, not Password Reset entry.
- [x] Decide that Abuse Limit Messaging does not show countdowns or exact unlock times for Sign-In Abuse Limit, Sign-Up Abuse Limit, Password Reset Abuse Limit, Account Email Change OTP Abuse Limit, or Sensitive Action Abuse Limit.
- [x] Decide that Sign-In Abuse Limit, Sign-Up Abuse Limit, Password Reset Abuse Limit, Account Email Change OTP Abuse Limit, and Sensitive Action Abuse Limit do not send Security Email Notices in MVP.
- [x] Decide that Password Reset is MVP, starts from Account Email, always shows `If an account exists, reset instructions were sent.`, uses 30-minute reset link/token expiry, requires new password plus confirm new password following Password Rules, applies Password Reset Token Invalidation after success, shows Password Reset Success State, returns the user to Password Sign-In, and does not automatically sign them in.
- [x] Decide that the Password Reset request form validates Account Email format only, does not use inline Account Email availability checks, and does not reveal whether the Account Email exists, is unverified, has Password Sign-In, uses OAuth, is held by Pending OAuth Sign-Up, is rate-limited, or is missing.
- [x] Decide that Password Reset Email uses AnimeX branding and the reset action only, without Username, display name, User Avatar, profile identity, sign-in method, or account-type details.
- [x] Decide that requesting Password Reset Email does not send a separate Security Email Notice; Password Reset sends Security Email Notice only after successful reset.
- [x] Decide that Password Reset Email includes the visible expiry note `This link expires in 30 minutes.`.
- [x] Decide that Password Reset Email includes the minimal non-interactive warning `If you did not request this, you can ignore this email.` and no extra security action link in MVP.
- [x] Decide that the Password Reset Email "not you?" warning is informational only and creates no In-App Notification, Moderation Case, security case, or account flag in MVP.
- [x] Decide that Password Reset Email does not include device, IP, browser, or location details in MVP.
- [x] Decide that Password Reset Email does not repeat the Account Email address it was sent to.
- [x] Decide that Password Reset Email uses both a primary `Reset password` action and a visible fallback URL for email clients where the primary action does not work.
- [x] Decide that the Password Reset Email visible fallback URL appears as full raw URL text, not a short fallback link label.
- [x] Decide that Password Reset Email uses subject line `Reset your AnimeX password`.
- [x] Decide that Password Reset Email uses preview text `Use this link within 30 minutes to reset your password.`.
- [x] Decide that a valid-link Password Reset form shows only new password and confirm new password, without Account Email, Username, User Avatar, profile identity, OAuth hint, sign-in method, or account-type details.
- [x] Decide that the valid-link Password Reset form submit button text is `Reset password`.
- [x] Decide that the valid-link Password Reset form shows `8-24 characters.` near the new password field before submit and does not show `Choose a less common password.` or block common passwords in MVP.
- [x] Decide that Password Visibility Toggle appears on every AnimeX password input, stays hidden by default, and only changes local display.
- [x] Decide that each Password Visibility Toggle affects only its own field, not all password fields in the same form.
- [x] Decide that hidden password fields show an eye icon labeled `Show password`, while visible password fields show an eye-off icon labeled `Hide password`.
- [x] Decide that a visible password field stays visible after validation or submit errors while the user remains on the same form, and returns to hidden when the user leaves and later reopens the form.
- [x] Decide that every AnimeX password input allows paste and password-manager autofill.
- [x] Decide that after successful Password Reset, AnimeX relies on normal browser/password-manager saved-password update behavior and does not show a custom in-app save-password prompt.
- [x] Decide that each newer Password Reset request for the same account invalidates older reset links/tokens, so only the latest issued reset link/token can be used.
- [x] Decide that replaced, superseded, or already-used Password Reset links/tokens use the same generic `Reset link is invalid or expired. Request a new one.` message and do not reveal the reason.
- [x] Decide that an invalid or expired Password Reset link/token shows `Reset link is invalid or expired. Request a new one.` with a way back to the Password Reset request page, without revealing whether the Account Email exists.
- [x] Decide that the invalid or expired Password Reset link page does not prefill or expose Account Email from the failed token; users re-enter Account Email on the Password Reset request page.
- [x] Decide that successful Password Reset invalidates every outstanding reset link/token for that account, including the used token and any other token that could still be stored, so no reset token remains usable after the password changes.
- [x] Decide that after Password Reset succeeds and sessions are revoked, AnimeX shows `Password reset. Sign in with your new password`, starts a 5-second countdown redirect to Password Sign-In, and offers a `Sign in` link without automatically signing the user in.
- [x] Decide that Password Reset Success State countdown copy is `Redirecting to sign in in 5 seconds...`, with the number updating each second.
- [x] Decide that clicking `Sign in` before the Password Reset Success State countdown ends stops the countdown redirect and immediately navigates to Password Sign-In.
- [x] Decide that Password Sign-In reached from Password Reset Success State does not prefill Account Email.
- [x] Decide that Password Sign-In reached from Password Reset Success State does not show a reset-success notice.
- [x] Decide that Password Reset Success State does not show Account Email, Username, or any account identity.
- [x] Decide that Password Reset Success State does not mention Email OTP Verification for Email-Unverified Users; after Password Sign-In, existing Email-Unverified routing sends them to the Email OTP Verification Page.
- [x] Decide that Password Reset uses Password Reset Abuse Limit after too many reset requests, temporarily stops sending additional reset emails, and keeps the request response generic.
- [x] Decide that Password Reset does not reject the new password solely because it matches the current password.
- [x] Decide that successful Password Reset sends a Security Email Notice to the Account Email with no action link in MVP.
- [x] Decide that Security Email Notices include only the event copy and do not include device, IP, browser, or location details in MVP.
- [x] Decide that Security Email Notices can be sent to unverified Account Emails: Password Reset and Account Password Change send to the current Account Email, and Account Email Change sends to the previous Account Email.
- [x] Decide that Security Email Notices are mandatory transactional account-safety emails and cannot be disabled through Notification Preferences.
- [x] Decide that Security Email Notices are sent immediately after the completed account-security change and are not delayed or batched in MVP.
- [x] Decide that Security Email Notice delivery failure does not block or undo a completed Account Email Change, Account Password Change, or Password Reset.
- [x] Decide that failed Security Email Notice delivery does not show a user-facing warning or partial-success message after the account-security action succeeds.
- [x] Decide that Security Email Notices are email-only in MVP and do not appear in an Account Settings history or list.
- [x] Decide that successful Password Reset revokes all existing AnimeX sessions for that account regardless of sign-in method, requires sign-in again with the new password, and does not remove Linked Sign-In Methods.
- [x] Decide that Password Reset does not complete Email OTP Verification; Email-Unverified Users remain Email-Unverified and must complete Email OTP Verification after Password Sign-In.
- [x] Decide that Password Reset can create a new password for OAuth-created accounts without a password, while keeping the request response generic and not revealing account type.
- [x] Decide that Password Reset does not work for Pending OAuth Sign-Up accounts: request response stays generic, no Password Reset Email is sent, and the user must resume OAuth Sign-Up with the provider to finish Username completion.
- [x] Decide that after an OAuth-created account creates a password through Password Reset, OAuth sign-in still works; Password Reset adds Password Sign-In access and does not replace or unlink OAuth.
- [x] Decide that MVP has no user-facing sign-in method management; users cannot unlink OAuth or remove Password Sign-In after both methods exist.
- [x] Decide that self-service Account Deletion is non-MVP; users cannot delete their own account from Account Settings in MVP.
- [x] Decide that password-based new user sign-up form includes Account Email, password, and confirm password only, then sends Email OTP and opens the Email OTP Verification Page.
- [x] Decide that Password Rules are 8-24 characters, no forced symbol/number requirement, no common-password blocking in MVP, and confirm password must match.
- [x] Decide that Account Email is unique per account with case-insensitive matching.
- [x] Decide that verified users can change Account Email later in Account Settings, with inline Account Email availability validation to prevent Account Emails already active, held, or reserved by another account state.
- [x] Decide that Account Email Change keeps the current Account Email active for Password Sign-In and Password Reset until the new email passes OTP verification.
- [x] Decide that Pending Account Email Change survives sign-out until its OTP expires or a newer Account Email Change starts; users sign back in with the current Account Email.
- [x] Decide that Account Email Change Verification uses the same Email OTP Limits as Email OTP Verification.
- [x] Decide that Account Email Change Verification uses Account Email Change OTP Abuse Limit after too many send/resend attempts, blocks new OTP sends, keeps any Pending Account Email Change unchanged, keeps the current Account Email active, and shows `Too many attempts. Try again later.` with no countdown.
- [x] Decide that if Account Email Change OTP expires while Account Email Change OTP Abuse Limit is active, the Pending Account Email Change releases the requested Account Email reservation, keeps the current Account Email active, and the abuse limit still blocks starting or resending another Account Email Change OTP until it clears.
- [x] Decide that Pending Account Email Change temporarily reserves the requested new Account Email while OTP is valid and releases it when OTP expires or a newer Account Email Change starts.
- [x] Decide that a newer Account Email Change request for a different requested Account Email replaces an existing Pending Account Email Change before OTP expiry only after the newer request can send its OTP; replacement invalidates the old OTP, releases the old requested Account Email reservation, reserves the new requested Account Email, and sends the new OTP, while abuse-limit blocks keep the existing pending change unchanged.
- [x] Decide that repeat Account Email Change for the same requested Account Email is treated as Account Email Change OTP resend: allowed resend invalidates the old OTP, sends a new OTP, extends expiry, and keeps the same reservation; blocked resend keeps the existing Pending Account Email Change unchanged.
- [x] Decide that AnimeX does not provide Pending Account Email Change Cancellation; users can ignore an unwanted Account Email Change OTP until it expires while the current Account Email stays active.
- [x] Decide that successful Account Email Change sends a Security Email Notice to the previous Account Email with no action link in MVP.
- [x] Decide that Account Email Change requires reauthentication before sending OTP: current password for accounts with Password Sign-In, and future fresh OAuth reauthentication for OAuth-only accounts.
- [x] Decide that Account Email Change Reauthentication Failure shows `Incorrect password.` inline and does not use Password Sign-In Failure copy.
- [x] Decide that wrong current-password attempts in Account Email Change Reauthentication and Account Password Change can trigger one shared Sensitive Action Abuse Limit, temporarily block both Account Email Change and Account Password Change, and show `Too many attempts. Try again later.`.
- [x] Decide that Account Email Change keeps existing signed-in sessions active after success; MVP does not force sign-out or include log-out-other-sessions for Account Email Change.
- [x] Decide that Account Password Change is available for accounts with Password Sign-In, requires current password, new password, confirm new password, follows Password Rules, keeps all existing signed-in sessions active after success, and does not include log-out-other-sessions in MVP.
- [x] Decide that Account Password Change Failure shows `Incorrect password.` inline and does not use Password Sign-In Failure copy.
- [x] Decide that successful Account Password Change sends a Security Email Notice to the current Account Email with no action link in MVP.
- [x] Decide that Account Password Change rejects using the current password as the new password and shows `New password must be different from current password.` inline.
- [x] Decide that existing Account Email blocks Simplified Sign-Up or Verification Email Change inline with `Email already in use. Sign in instead.`, while sign-in errors stay generic.
- [x] Decide that repeat Simplified Sign-Up with an Account Email reserved by an Email-Unverified User shows `Email already in use. Sign in instead.`, then sign-in routes unverified owner to Email OTP Verification Page.
- [x] Decide that Simplified Sign-Up uses Sign-Up Abuse Limit after too many sign-up submissions or signup Email OTP send/resend attempts, temporarily blocks more attempts, and shows generic `Too many attempts. Try again later.` while keeping Account Email Conflict copy unchanged.
- [x] Decide that Sign-Up Abuse Limit blocks requesting new signup OTPs but does not block submitting the current OTP on the Email OTP Verification Page if it is still valid.
- [x] Decide that Sign-Up Abuse Limit also blocks Verification Email Change because it would send a new signup OTP and could bypass resend protection; current Account Email and current OTP stay unchanged.
- [x] Decide that if the current signup OTP expires while Sign-Up Abuse Limit is active, AnimeX shows the expired OTP message but keeps resend and Verification Email Change blocked by Sign-Up Abuse Limit without a countdown.
- [x] Decide that Verification Email Change cannot use an Account Email already used by another account; it shows `Email already in use. Sign in instead.` and keeps current Account Email and current OTP unchanged.
- [x] Decide that Simplified Sign-Up does not ask for Username until after Email OTP Verification.
- [x] Decide that Username Completion creates the initial display name, default avatar initials, and Private default visibility.
- [x] Decide that sign-up does not show an Account-Level Default Visibility control; users change it later in Privacy Settings.
- [x] Decide that email verification uses Email OTP Verification.
- [x] Decide that Home Feed opens only after Email OTP Verification and Username Completion both complete.
- [x] Decide that successful Email OTP Verification redirects to Username Completion when the account has no AnimeX User Record.
- [x] Decide that Email-Unverified Users are signed in but redirected to the Email OTP Verification Page, where they can request a new OTP if needed.
- [x] Decide that after Simplified Sign-Up submits, Email-Unverified User account exists and keeps Account Email reserved but does not reserve Username before verification.
- [x] Decide that Email-Unverified Users can change a mistyped email from the Email OTP Verification Page, which sends a new OTP and invalidates the old OTP immediately.
- [x] Decide that Email-Unverified Users cannot access normal signed-in surfaces or create user-authored content until verified.
- [x] Decide Email OTP expires after 10 minutes, resend cooldown is 60 seconds, and 5 wrong attempts invalidate the current OTP and require a new OTP.
- [x] Decide that 5 wrong OTP attempts clear the OTP field and show an inline message.
- [x] Decide that expired OTP keeps the user on the Email OTP Verification Page with an inline expired message and resend enabled when cooldown allows.
- [x] Decide that every new OTP invalidates older OTPs immediately, so only the latest OTP works.
- [x] Decide that usernames are unique with case-insensitive matching and checked with inline availability validation during Username Completion.
- [x] Decide that Username format is 3-30 characters, letters/numbers/underscore only, no spaces, no leading/trailing underscore, and preserves typed case for display.
- [x] Decide that Inline Username Availability checks after about 400ms of typing pause and validates again on submit.
- [x] Decide that `Mika` and `mika` cannot be separate usernames, while typed capitalization is preserved for display.
- [x] Decide that OAuth Sign-Up still requires a unique case-insensitive username before entering the Home Feed, without password fields.
- [x] Decide that OAuth Sign-Up uses OAuth Username Autofill when the provider supplies a username, shows the provider username as-is, keeps the field editable, does not generate username suggestions or silently sanitize it, and subjects it to normal Username validation.
- [x] Decide that OAuth Sign-Up still uses Username as the initial display name, uses provider profile picture as the initial User Avatar when available, and falls back to initials-based Default Avatar when provider picture is unavailable.
- [x] Decide that OAuth provider profile picture changes after sign-up do not automatically update User Avatar; provider picture is only an initial OAuth Sign-Up seed.
- [x] Decide that provider profile picture used during OAuth Sign-Up is copied and stored as an AnimeX-owned initial User Avatar and is not hotlinked long term.
- [x] Decide that OAuth Avatar Import Failure does not block OAuth Sign-Up; AnimeX continues with initials-based Default Avatar, shows no avatar-specific user-facing error, and lets the user change User Avatar later.
- [x] Decide that OAuth Sign-Up requires provider-verified email, has no AnimeX Email OTP Verification path, and blocks OAuth Sign-Up when provider email is missing or unverified.
- [x] Decide that Sign-In and Sign-Up screens both show the same OAuth Entry Button copy, `Continue with Google`, and let the provider result resolve to OAuth Sign-In, OAuth Sign-Up, or Account Email Conflict.
- [x] Lock Auth Form Visual Direction to `docs/visual/auth/auth-desktop-sign-in.png` for desktop Sign-In and `docs/visual/auth/auth-mobile-create-account.png` for mobile Create Account, with no mascot, notebook/notepad, pen, Japanese characters, or Japanese typography.
- [x] Decide that OAuth Sign-Up with an Account Email already used by an existing AnimeX account is blocked with `Email already in use. Sign in instead.` and does not auto-link OAuth to that account in MVP.
- [x] Decide that OAuth Account Linking is non-MVP: completed password-created users cannot link Google or other OAuth providers from Account Settings in MVP.
- [x] Decide that OAuth Sign-Up follows OAuth Provider Email Requirement: provider-verified email is required, and AnimeX has no user-entered email step during OAuth Sign-Up.
- [x] Decide that unverified provider email blocks OAuth Sign-Up before account creation, so AnimeX does not create an OAuth-created Email-Unverified User.
- [x] Decide that OAuth Sign-Up signs in a provider-verified user as Pending OAuth Sign-Up after Account Email Conflict checks pass, keeps them on Username completion, lets them sign out, and creates AnimeX User Record plus Auth-Profile Link only after final Username passes validation.
- [x] Decide that Username Completion shows the Account Email read-only as `Signed in with {Account Email}`, lets the user edit only Username, continue after valid Username, or sign out, and requires sign-out plus restarted OAuth to use another OAuth account when the user is completing OAuth Sign-Up.
- [x] Decide that Pending OAuth Sign-Up holds its Account Email unavailable to other sign-ups and Account Email Change until Username completion or Pending OAuth Sign-Up Cleanup.
- [x] Decide that closing the tab keeps a Pending OAuth Sign-Up session within its normal session lifetime, while signing out ends the current session; a later OAuth attempt with the same provider account ID resumes Pending OAuth Sign-Up instead of creating a duplicate account.
- [x] Decide that Pending OAuth Sign-Up Cleanup runs weekly, not daily, and removes only pending auth identities with no Auth-Profile Link, no active pending session, and a last pending session expiry older than 24 hours.
- [x] Decide that after Pending OAuth Sign-Up Cleanup removes old pending state, the same OAuth provider account starts a fresh OAuth Sign-Up with provider revalidation, Account Email Conflict checks, and Username completion again.
- [x] Decide that future OAuth Sign-In matches returning users by linked OAuth provider account ID, not Account Email; unlinked OAuth with an existing provider email is blocked with `Email already in use. Sign in instead.` instead of auto-linking.
- [x] Decide that OAuth provider email changes after account linking do not automatically update AnimeX Account Email; OAuth Sign-In still uses provider account ID, and Account Email Change is required to update AnimeX Account Email.
- [x] Decide that Better Auth-owned Authentication Identity and AnimeX-owned User Record stay separate ownership records in the same Convex backend, linked one-to-one: Authentication Identity owns Account Email, sign-in methods, sessions, and verification; AnimeX User Record owns Username, avatar, profile/privacy fields, social/feed ownership, and anime-list data.
- [x] Decide that sign-out keeps users on public pages but sends account-only or non-public pages to the public Home Feed.
- [x] Decide that signed-out mobile navigation hides the Profile tab.
- [x] Decide that signed-out mobile header shows `Sign in` instead of a notification icon.
- [x] Decide that Posts reference one external HTTPS media URL and do not upload or compress media files.
- [x] Decide whether comments are text-only or can include image attachments.
- [x] Decide whether comments support replies and nested threads.
- [x] Decide whether Comment Replies include removable Reply Tags.
- [x] Decide whether removing a Reply Tag prevents Comment Reply Notifications.
- [x] Decide what happens to Comment Replies when the original Comment is deleted.
- [x] Decide whether Posts and Comments support `@mentions`.
- [x] Decide whether MVP includes Direct Messages.
- [x] Decide whether posts can attach anime, and how many anime can be attached.
- [x] Decide whether posts need spoiler controls.
- [x] Decide whether comments and likes inherit feed-card visibility.
- [x] Decide exact visibility levels and whether users can override visibility per feed card.
- [x] Decide generated Activity card visibility behavior.
- [x] Decide what happens to existing comments and likes when a feed card becomes Private.
- [x] Decide whether old notifications remain after a Post or Activity card changes visibility.
- [x] Decide whether old notifications regain access after a card changes back to visible.
- [x] Decide whether account-level default visibility updates existing feed cards.
- [x] Decide whether users have a bulk tool for changing existing Post and Activity card visibility.
- [x] Decide where Bulk Visibility Change tool lives.
- [x] Decide Bulk Visibility Change target groups and no per-card selection.
- [x] Decide that Bulk Visibility Change for Activity cards includes active Review Activity cards.
- [x] Decide that Bulk Visibility Change for Review Activity updates Review Visibility source-wide.
- [x] Decide that Anime Review Metrics update when Bulk Visibility Change changes Review Visibility.
- [x] Decide that Anime Review Metrics are viewer-specific under Review Visibility.
- [x] Decide that authors count their own Private Reviews in Anime Review Metrics.
- [x] Decide that average Review Rating is absent when no Reviews are visible.
- [x] Decide that visible review count can show zero while average Review Rating is absent.
- [x] Decide that average Review Rating displays with one decimal place.
- [x] Decide that average Review Rating rounds to nearest one decimal instead of truncating.
- [x] Decide that Bulk Visibility Change excludes Review sources whose Review Activity card was deleted.
- [x] Decide that Bulk Visibility Change for Activity cards affects both active Completed Anime and active Rewatch Completion Activity cards.
- [x] Decide whether Bulk Visibility Change is silent.
- [x] Decide that Bulk Visibility Change from Private to visible restores stored comments and likes under the new visibility.
- [x] Decide whether Bulk Visibility Change requires confirmation.
- [x] Decide whether Bulk Visibility Change has an undo action.
- [x] Decide whether Bulk Visibility Change affects deleted or moderation-removed feed cards.
- [x] Decide whether Bulk Visibility Confirmation affected count includes already-matching cards.
- [x] Decide that Bulk Visibility Confirmation counts Completed Anime and Rewatch Completion Activity as separate affected cards when both change.
- [x] Decide that if one matching milestone card is already at the target visibility, only the changing card counts.
- [x] Decide that Bulk Visibility Confirmation shows separate Post and Activity card counts plus total affected count.
- [x] Decide whether Followers only visibility is relationship-based or snapshot-based.
- [x] Decide whether unfollowing removes access to Followers only feed cards.
- [x] Decide whether visibility changes show edited or bump the feed.
- [x] Decide who sees feed card visibility indicators.
- [x] Decide where authors change feed card visibility.
- [x] Decide whether Feed Card Menu actions differ for authors and other viewers.
- [x] Decide whether users need a private account mode in MVP.
- [x] Decide what User Profile surfaces show.
- [x] Keep User Profile signed-in-only and add separate Public/Private Profile Visibility without changing content-default visibility.
- [x] Use Activity default plus Reviews and Favorites `tab` query states.
- [x] Reject 10 favorite anime as the profile favorite-anime limit.
- [x] Decide whether profiles use favorite anime, and if yes, what limit they use.
- [x] Decide anime stats show completed, watching, planned, and dropped only; exclude Favorite Genres.
- [x] Decide whether profile anime stats include On Hold.
# Discover Feedback Fixes

Status: COMPLETE.

- [x] Theme filter selects. Remove native white hover/arrow surface.
- [x] Add one-step Clear filters. Preserve search query.
- [x] Add reusable controlled horizontal rails to Trending, Seasonal, Recommendations.
- [x] Add RED/GREEN tests for filters and rail behavior.
- [x] Run full automated gates, responsive browser QA, and review.
- [x] Commit verified implementation on `jeff-cx/phase-3-feedback`.

# Discover Dropdown And Search Score Fix

- [x] Add official shadcn Select backed by Base UI without changing the global shadcn preset.
- [x] Replace native Discover filter selects and preserve controlled URL behavior.
- [x] Add `averageScore` badges to search-result cards, using `—` when unavailable.
- [x] Add RED/GREEN regression tests for dropdowns and scores.
- [x] Run review, full automated gates, responsive browser QA, and console checks.
- [x] Commit the verified follow-up on `jeff-cx/phase-3-feedback`.

# Discover Dropdown Gutter And This Week Fidelity

- [x] Create snapshot branch `jeff-cx/snapshot-before-discover-ui-fix-20260713`.
- [x] Prevent filter dropdowns from replacing the page scrollbar with a white gutter.
- [x] Match desktop This Week rows to `docs/visual/discover/discover-desktop.png`.
- [x] Add RED/GREEN regression tests for both fixes.
- [x] Run review, full automated gates, Chromium responsive QA, and console checks.
- [x] Commit the verified fixes on `jeff-cx/phase-3-feedback`.

# Phase 4 Tab Visual References

Status: COMPLETE.

- [x] Inspect approved Anime Detail desktop/mobile Overview references.
- [x] Lock full-page Reviews, Characters, and Staff desktop/mobile design contract.
- [x] Write and self-review visual specification.
- [x] Generate and inspect six dedicated image references.
- [x] Save final assets under `docs/visual/anime-details/`.
- [x] Commit approved visual references on `jeff-cx/phase-4-tab-visuals`.

# Phase 4 Anime Detail Layout Consistency

Status: design approved; written spec ready for review.

- [x] Compare Reviews, Characters, and Staff references.
- [x] Select Staff desktop as canonical shared shell.
- [x] Lock stable desktop shell, sidebar, controls, tabs, and responsive translation.
- [x] Define tab-content boundaries and implementation constraints.
- [x] Write and self-review consistency specification.

# Phase 4 Anime Detail Implementation

Status: COMPLETE on `jeff-cx/phase-4-anime-detail`; final QA and integrated review PASS.

- [x] Lock and test shared contracts. Owner: contract worker.
- [x] Build server-only AniList detail transport and 24-hour Convex detail/page cache. Owner: server/cache worker.
- [x] Build authenticated user anime state, milestones, and paginated rewatch history. Owner: Convex worker.
- [x] Build canonical route shell, redirects, tabs, states, and responsive layout. Owner: route/shell worker.
- [x] Build tab content, pagination, user controls, and rewatch dialog. Owner: UI worker.
- [x] Link all Discover anime surfaces to canonical detail routes. Owner: Discover worker.
- [x] Integrate, regenerate routes, push Convex schema, review, validate, browser-QA, document, and close Phase 4. Owner: controller + reviewer + QA + docs mapper.

# Phase 4 Anime Detail Feedback Fixes

Status: COMPLETE on `jeff-cx/phase-4-anime-detail`; final review, gates, and hover-focused browser QA PASS.

- [x] Match canonical Staff desktop banner, controls, and sidebar shell. Owner: layout worker.
- [x] Gate public Status, Score, and Favorite before private controls mount. Owner: controls worker.
- [x] Add 0.5-step debounced Status/Score autosave with Sonner feedback. Owner: controls worker.
- [x] Preserve tabs/content; update approved layout spec. Owner: controller + docs mapper.
- [x] Run full gates plus hover, keyboard, responsive, console, and overflow browser QA. Owner: controller + reviewer + QA.

# Phase 4 Anime Controls Feedback Fixes

Status: COMPLETE on `jeff-cx/phase-4-anime-detail`.

- [x] Save approved control design reference and lock behavior/spec. Owner: controller.
- [x] Add regression coverage for score/status invariant and revised control UX. Owner: backend + frontend workers.
- [x] Atomically set first-score Status to Watching only when unset. Owner: Convex worker.
- [x] Match approved Status, Score, Favorite, and Rewatch history controls. Owner: UI worker.
- [x] Run full gates, design comparison, hover/focus/responsive browser QA, review, and closure. Owner: controller + reviewer + QA.

## Score Autosave Focus Follow-up

Status: COMPLETE on `jeff-cx/phase-4-anime-detail`.

- [x] Raise Status and Score trailing debounce to 750 ms.
- [x] Preserve Score focus and editing while its mutation is pending.
- [x] Coalesce edits made during a pending Score save without losing the latest draft.
- [x] Run focused, full, build, Fallow, and browser validation.

# Phase 5 Feed, Posts, Reviews

Status: COMPLETE and integrated on `dev`; authenticated browser QA and closure gates pass.

- [x] Create feature branch; verify clean 349-pass baseline. Owner: controller.
- [x] Add approved direct Lexical dependencies. Owner: controller.
- [x] Generate, inspect, approve Review Creation and Review Detail desktop/mobile references. Owner: controller.
- [x] Lock shared contracts and RED validator/integration coverage. Owner: contract worker.
- [x] Add Convex schema, Posts, Reviews, feed projection, metrics, storage, milestone projection. Owner: backend worker.
- [x] Add protected routes, editor/renderer, Review Detail, Anime Reviews. Owner: review UI worker.
- [x] Replace Home mocks with feed, Composer, card lifecycle, responsive states. Owner: feed UI worker.
- [x] Integrate generated routes/types; `src/routeTree.gen.ts` includes Phase 5 routes and `pnpm exec tsc --noEmit` passes. Owner: controller.
- [x] Run focused and full test/build gates: 75 files passed / 2 skipped; 478 tests passed / 3 skipped; TypeScript, client + SSR build, and `pnpm exec convex dev --once` pass. Owner: controller.
- [x] Complete dev milestone projection backfill: one cursor page, `isDone: true`, `processedCount: 2`, `verifiedCount: 2` (2/2). Owner: controller.
- [x] Resolve Fallow new-only audit: zero introduced dead-code, complexity, or duplication findings. Inherited complexity findings and the inherited `react-dom` test-only dependency warning remain outside the locked new-only gate. Owner: controller.
- [x] Sync current-state docs and data-flow notes. Owner: docs mapper.
- [x] Complete spec/thermo review and responsive browser QA at 390, 768, and 1280 px. Authenticated checks cover Posts, anime controls, Review draft/resume/publish/edit, owner visibility actions, full rich-text toolbar, Preview parity, published rendering, keyboard focus, pointer hover, and responsive states. Review pagination above 12 records remains integration-tested because dev data did not reach the live threshold; see `design-qa.md`. Owner: reviewer + QA.
- [x] Commit verified Phase 5 and stop for user review. Owner: controller.

## Optional Backlog

### Optional Metadata Image Proxy

Status: NOT SCHEDULED. Separate infrastructure feature; current MVP continues using direct external AniList image URLs.

- [x] Lock provider-neutral `/media/$entity/$id/$variant?v=$version` route and independent metadata/image cache strategy.
- [ ] Add server-only image-source/version storage and ensure public Convex payloads expose only proxy URLs.
- [ ] Add validated TanStack Start image route with indexed Convex resolution, allowlisted upstream fetch, bounded redirects/type/size/timeout, and no AniList GraphQL call.
- [ ] Add 24-hour browser, 30-day shared, and 7-day stale-while-revalidate cache headers without stale-if-error; verify Vercel and VPS cache parity.
- [ ] Migrate Anime, Character, and Staff image consumers; confirm Post and Review external media remain outside proxy scope.
- [ ] Validate cache hits/misses/version changes, abuse resistance, responsive image rendering, client bundle/network exposure, and direct-source removal.

### Other Optional Work

- [ ] Optional anime attachment in Post Composer.
- [ ] Mobile Home Explore tab or sheet for utility modules.
- [ ] Optional React Doctor advisory cleanup for Phase 5 hook, accessibility, performance, and maintainability warnings; keep Zod 4.4.3 and conventional shared-component false positives triaged separately.

# Phase 5 Home And Review Discovery Feedback

Status: COMPLETE and integrated on `dev`; implementation, migrations, browser QA, and closure gates pass.

- [x] Inspect current Home, Discover, feed, Review, user-anime, and cache flows.
- [x] Lock Home Seasonal, desktop utility order, List Progress metrics, and removed placeholders.
- [x] Lock feed-card visual-only fidelity boundary.
- [x] Lock `/reviews` visibility, search, filters, relevance behavior, and infinite pagination.
- [x] Generate and inspect desktop/mobile `/reviews` references.
- [x] Write and self-review current-state design specification.
- [x] User reviews and approves written specification.
- [x] Create detailed implementation plan with migration, ownership, validation, and signed-in QA workflow.
- [x] Audit implementation plan against current UI; lock Discover state reuse, compact Summary, image fallback, auth-ready normalization, and infinite-feed fixes.
- [x] Add shared Base UI shadcn Button, Input Group, Card, Badge, Skeleton, Empty, Progress, and Dropdown Menu foundations. Owner: shared UI worker.
- [x] Implement indexed Review discovery and verified migration. Owner: Convex Review worker.
- [x] Implement atomic List Progress projection and verified migration. Owner: Convex user-anime worker.
- [x] Reuse Discover Seasonal/This Week/Upcoming and restore Home desktop utilities. Owner: Home workers.
- [x] Match approved feed-card structure without fake social data. Owner: feed UI worker.
- [x] Build `/reviews` search, filters, visibility, and infinite pagination. Owner: Review discovery UI worker.
- [x] Integrate generated files and run closure gates: 83 test files passed / 2 skipped; 566 tests passed / 3 skipped; routes, Convex sync, TypeScript, client + SSR build, Fallow new-only audit, client AniList endpoint scan, and diff check pass. Authenticated browser QA covers full Review toolbar and owner actions, Home utility order, Review visibility/search/filter states, account-default visibility, 44 px touch targets, console, requests, and responsive overflow. Owner: controller + reviewer + QA.

# Phase 5 Editor, Post Media, And Feed Feedback

Status: COMPLETE and integrated on `dev`; implementation, migration, review, authenticated browser QA, and closure gates pass.

- [x] Inspect Review editor, Post storage, feed cards, Home utility, and Discover layout flows.
- [x] Verify RichTextEditor caret insertion, selection replacement, and Backspace media deletion behavior.
- [x] Lock Review cursor/top insertion, media deletion, and spoiler unwrap behavior.
- [x] Lock one URL media item per Post, optional contextual image description, linked video cards, media-only Posts, and no server fetch.
- [x] Approve deletion of legacy file-image Posts, feed projections, Post image rows, and referenced Convex Storage objects while preserving text-only Posts.
- [x] Lock feed metadata/menu copy, Home surface, and Discover Genres changes.
- [x] Write and self-review current-state design specification.
- [x] User reviews written specification.
- [x] Create detailed implementation plan with migration stages, ownership, validation, and authenticated browser QA.
- [x] User reviews and approves implementation plan.
- [x] Lock shared external-media and feed contracts. Owner: contracts worker + reviewer.
- [x] Implement cursor media editing, deletion, spoiler toggle, and structured-render parity. Owner: Review editor worker + reviewer.
- [x] Migrate legacy Post images and remove upload/storage schema after verified cleanup. Owner: Convex workers + reviewer.
- [x] Replace Post uploads with one external Image/Video URL and preserve Post lifecycle behavior. Owner: Post UI worker + reviewer.
- [x] Update feed metadata/menu actions and Home/Discover surfaces. Owner: feed/UI workers + reviewers.
- [x] Sync final Convex functions; update current-state docs; pass tests, TypeScript, build, Fallow, endpoint scan, and diff check. Owner: controller + docs mapper.
- [x] Complete whole-branch review and authenticated responsive browser QA at 390, 768, and 1280 px, including hover/focus, Review media editing, Post lifecycle, Home/Discover surfaces, console/network, overflow, and dark scrollbar states. Owner: reviewer + QA + controller.
- [x] Implement only after plan approval.

# Phase 5 Review Card, Avatar, And Rail Feedback

Status: COMPLETE and integrated on `dev`; final reviewer, independent QA, automated gates, and authenticated Chrome browser QA at 390, 768, and 1280 px pass.

- [x] Inspect Feed Review, Review discovery, Anime Reviews, Latest Reviews, writer fields, avatar renderers, and anime rails.
- [x] Lock whole-body Review links, activity-only Delete copy, exact shared Review card, and per-rail equal heights.
- [x] Lock Review-level spoiler badge with always-visible Summary.
- [x] Lock spinner-free Rating input and right-aligned Review spoiler checkbox.
- [x] Lock reuse-first shared Avatar with uppercase one-letter fallback.
- [x] Approve deletion of existing Reviews, drafts, and linked Review activities only.
- [x] Approve written design behavior.
- [x] Review and approve written specification.
- [x] Create detailed implementation plan.
- [x] Review and approve implementation plan.
- [x] Complete guarded Review cleanup before schema rename: 3 Reviews, 3 Review feed cards, and 2 Review-stat rows inventoried; 3 Reviews and 2 stats rows deleted; linked cards removed; 0 orphan Review cards found; second full pass deleted 0. Protected counts unchanged: 1 Post, 1 Post card, 4 Completed cards, and 1 Rewatched card. Temporary cleanup surface removed. Owner: controller + Convex migration worker.
- [x] Rename Review warning metadata to `containsSpoiler`; keep Summary and ordinary body visible; preserve independent rich-text spoiler blocks. Owner: controller + contracts worker.
- [x] Add spinner-free Rating draft input (default `50`, partial text, `0–100`, max one decimal) and right-aligned `Review contains spoiler` writer checkbox. Owner: Review UI worker.
- [x] Add shared `UserAvatar` and `ReviewSpoilerBadge`; replace feed activity icons and Review Detail avatar markup with shared primitives. Owner: shared UI worker.
- [x] Link Feed Review bodies and Latest Review rows to Review Detail; remove visible `Read Review`/`Read review` CTAs. Keep Review activity `Delete` action mapped to `reviews.removeActivity` with activity-only semantics. Owner: feed/Home worker.
- [x] Share `PublishedReviewCard` between `/reviews` and Anime Detail Reviews; preserve listing query, sorting, stats, pagination, visibility, and anime-cover layout. Owner: Review listing worker.
- [x] Equalize anime card heights within each rail through shared `HorizontalRail`/`DiscoverSectionRail`; preserve width, ratio, snapping, scrolling, arrows, and responsive behavior. Owner: Discover rail worker.
- [x] Complete final integrated review, independent QA, serialized full tests (631 passed / 3 skipped), Convex sync, TypeScript, client + SSR build, Fallow new-only, client AniList endpoint scan, diff check, and authenticated Chrome browser QA at 390, 768, and 1280 px. Responsive checks cover writer input/Preview, shared card parity, Review Detail, Avatar fallback, Latest Reviews, owner menu, desktop-only sidebar, per-rail equal heights, pointer hover/exit restoration, keyboard focus, themed Select options, scrollbar stability, console, failed requests, hydration symptoms, and horizontal overflow. Owner: controller + reviewer + QA.

# Phase 5 Review Layout, Media, And Checkbox Feedback

Status: COMPLETE and integrated on `dev`; final review, automated gates, and authenticated browser QA pass.

- [x] Inspect shared Review card, Home desktop grid, Review/Post image renderers, and native checkbox usage.
- [x] Lock mobile Rating/action row, 430px desktop utility column, scoped 4:5 image geometry, and responsive 65% cap.
- [x] Verify official shadcn Base UI Checkbox and existing `@base-ui/react`; no dependency addition needed.
- [x] Write and self-review current-state design specification.
- [x] User reviews written specification.
- [x] Create detailed implementation plan.
- [x] User reviews and approves implementation plan.
- [x] Implemented after plan approval; completed integration review, automated validation, and authenticated responsive browser QA.
- [x] Final suite: 91 test files passed, 2 skipped; 637 tests passed, 3 skipped. TypeScript, production build, scoped React Doctor, Fallow, client AniList endpoint scan, and diff check passed. Build retains the existing client chunk-size warning.
- [x] Authenticated browser QA passed at 390, 768, and 1280px: exact Review/Post media geometry, 430px Home sidebar, responsive Review Rating placement, Checkbox hover/focus/pending states, no overflow, no console errors, and no failed requests.
- [x] Browser-found desktop Rating, Review pending lock, and Base UI `data-disabled` styling gaps were fixed and regression-tested. No Convex, dependency, route, generated-file, or global-style changes.
- [x] Mobile Review Rating and Review Detail now share one centered action row; focused/full tests, TypeScript, build, React Doctor, Fallow, and live 390/768/1280px browser QA pass.

# Phase 5 Formal Closure

Status: COMPLETE on `dev`; stale docs, cumulative quality blockers, integration, validation, review, and signed-in browser smoke are complete.

- [x] Verify Phase 5 implementation, feedback rounds, migrations, automated gates, and authenticated browser QA are complete.
- [x] Confirm `dev` is an ancestor of `jeff-cx/phase-5-feed-reviews` and fast-forward integration is available.
- [x] Remove stale Phase 5 status, Post-media, Review-spoiler, owner-action, README, and QA-summary claims.
- [x] Commit reviewed closure docs on the feature branch.
- [x] Fast-forward `dev` to the verified feature branch without push or deployment.
- [x] Run post-merge full tests, TypeScript, production build, React Doctor, Fallow, endpoint scan, and diff/status checks.
- [x] Remove cumulative Phase 5 Fallow blockers: 23 introduced dead-code findings and 11 introduced complexity findings reduced to zero without schema, dependency, or product-behavior changes.
- [x] Complete signed-in in-app browser smoke for Home feed, owner menu and destructive hover theme, Review Detail, Anime Reviews, Review editor, and clean console.
- [x] Record Phase 5 complete on `dev`; keep optional anime attachment, mobile Home Explore, and advisory cleanup outside closure.

Post-merge validation: 91 test files passed / 2 skipped; 637 tests passed / 3 skipped; Convex sync, TypeScript, client and SSR production build, cumulative Fallow new-only audit with zero introduced dead-code, complexity, or duplication findings, client AniList endpoint scan, reviewer, QA, browser smoke, and diff check pass. React Doctor completed with exit 0 and 69 advisory warnings; no errors. The advisories are recorded as optional technical debt, led by Zod-v4 migration false positives under installed Zod 4.4.3 and conventional shared-component guidance. The inherited Fallow `react-dom` advisory and existing client chunk-size warning remain.

# Phase 6 Quiet Signal Landing

Status: COMPLETE. Quiet Signal landing, AnimeX favicon set, automated gates, review, and responsive browser QA pass.

- [x] Select and approve Quiet Signal design, desktop reference, responsive behavior, motion, route, header, and favicon contracts.
- [x] Write, review, and approve detailed implementation plan.
- [x] Replace `/` redirect with dedicated signed-out/signed-in landing composition; preserve shared public-shell behavior.
- [x] Implement responsive CSS signal, mobile content-only layout, and reduced-motion behavior.
- [x] Replace TanStack starter icons with AnimeX SVG, ICO, Apple touch, and manifest assets.
- [x] Complete focused/full tests, TypeScript, client/SSR build, React Doctor, Fallow, diff check, implementation review, and browser QA.

# Pre-Phase 7 Social UI Embargo

Status: COMPLETE. Active social interaction UI and Followers-only choices are absent; stale routes canonicalize before forbidden queries; preserved Followers records remain owner-readable.

- [x] Move social UI activation to Phase 9 and lock the embargo design and implementation plan.
- [x] Limit Home to Home/Global and Review discovery to All/Public/My Private.
- [x] Limit new and explicit owner visibility choices to Public/Private.
- [x] Map Followers account defaults to Private for new Posts and Reviews.
- [x] Preserve Followers during unrelated legacy Post/Review edits; allow explicit Public/Private migration.
- [x] Replace stale `feed=following` and `visibility=followers` URLs before hidden queries mount.
- [x] Preserve backend schemas, stored Followers values, authorization, and Phase 9 contracts without migration.
- [x] Remove social controls, counts, labels, placeholders, and temporary restore functions.
- [x] Complete automated gates, review, Convex dev redeploy, and signed-out/signed-in browser QA at 390 and 1280.
- [x] Keep `Remove feed activity` available only from Home feed owner actions, not Review Detail.

# Phase 7 User Profile, Catalog People, And Quick Search

Status: COMPLETE. Implemented on `jeff-cx/phase-7-user-profile-quick-search`; feedback fixes, final reviewer PASS, automated gates, and responsive browser QA are complete. The second-account private-profile scenario is verified. Three browser fixtures remain unexercised: real media upload/crop/remove, injected provider or Storage failure, and deep pagination. No production deploy, push, merge, or unexercised fixture is claimed.

- [x] Keep signed-in profile header, Activity/Reviews/Favorites tabs, latest 10 favorites, four list-progress stats, and viewer-allowed profile activity in Phase 7.
- [x] Add separate Public/Private Profile Visibility; Private shows header identity/bio and a privacy notice to non-owners.
- [x] Exclude Favorite Genres, Anime List, and every social control/count from Phase 7.
- [x] Plan guided 1:1 avatar and 4:1 banner crop with `react-easy-crop`, Convex Storage validation, replacement, removal, and cleanup.
- [x] Add Character `/characters/:id/:slug` and Staff `/staff/:id/:slug` destinations before Quick Search.
- [x] Assign locked desktop modal and mobile drawer Quick Search implementation to Phase 7.
- [x] Open Quick Search from desktop header Search for signed-out and signed-in visitors.
- [x] Open the locked Base UI-backed mobile Search drawer from the bottom Search tab, with scrollable results and the search field pinned at the bottom.
- [x] Show compact live groups capped at five results for Anime, Characters, Staff, and signed-in Users; omit Users for signed-out search and use chevron links instead of inline actions.
- [x] Route View all Anime to `/discover?q=...`, Characters to `/search/characters?q=...`, Staff to `/search/staff?q=...`, and Users to `/search/users?q=...`.
- [x] Cover loading, empty, error, keyboard, focus, scroll, dismissal, and responsive states without category-selection controls.
- [x] Keep Discover separate and Manga future-only.
- [x] Defer Follow actions, follower/following counts, Likes, Comments, Comment counts, Like counts, and social activity footers to Phase 9.
- [x] Write the combined Phase 7 design spec at `docs/superpowers/specs/2026-07-17-phase-7-user-profile-quick-search-design.md`.
- [x] Review and approve the committed Phase 7 design spec.
- [x] Write and self-review the Phase 7 implementation plan.
- [x] Review and approve the Phase 7 implementation plan.
- [x] Implement User Profile, Catalog People, dedicated result pages, Quick Search, shell entry points, generated routes/API, and Convex deployment.
- [x] Run automated gates: final full suite 122 passed + 2 skipped files / 889 passed + 3 skipped tests; focused header/Quick Search suite 5 files / 40 tests; TypeScript/build/Fallow/Convex dev deploy pass; React Doctor is 62 with one inherited Discover error.
- [x] Run desktop/tablet/mobile core browser QA; recheck landing and signed-out auth Search with one dialog/searchbox and zero console errors.
- [x] Complete code review (PASS after `5178706`) and sync current-state docs/data-flow maps.
- [x] Verify second-account private-profile browser fixture with both named QA accounts; restore visibility to Public after verification.
- [ ] Verify real media upload/crop/remove browser flow.
- [ ] Verify injected provider/storage failure lanes.
- [ ] Verify deep pagination Load more browser flow.

# Phase 7 Feedback Fixes

Status: COMPLETE. User feedback is implemented and locked in `docs/superpowers/specs/2026-07-18-phase-7-feedback-fixes-design.md`; final reviewer PASS and browser QA pass after the keyboard Profile fix.

- [x] Lock avatar reuse, Profile containment, server-auth-first routing, and Character/Staff layout direction.
- [x] Reuse `UserAvatar` in Quick Search and `/search/users`; scale Profile fallback geometry.
- [x] Replace complete-account header Sign out button with a shared-avatar shadcn dropdown containing Profile and Sign out.
- [x] Repair Profile phone/tablet/desktop overflow, wrapping, and non-deforming media.
- [x] Replace full-document Profile tab changes with router navigation that preserves the shell.
- [x] Resolve Profile auth on the server before DOM/query mount; remove `Checking authentication…`.
- [x] Reproduce and fix invalid-hook, QueryClientProvider, root not-found, hydration, and unauthenticated-query logs by exact source; final console/server logs are clean.
- [x] Reuse Anime Detail shell geometry for Character/Staff with only Overview and Anime tabs.
- [x] Canonicalize legacy Staff `?tab=works` to `?tab=anime` without changing provider/cache identities.
- [x] Use both repo QA accounts for private-viewer, avatar, auth, tab, and responsive browser checks.
- [x] Run focused/full tests, TypeScript, build, React Doctor, Fallow, review, and browser QA. No Convex source changed, so no Convex deploy was required.
- [x] Write and independently review the implementation plan.
- [x] Approve the implementation plan for execution.

Final validation: 131 test files passed / 2 skipped; 925 tests passed / 3 skipped (928 total); TypeScript and client + SSR build passed with the existing >500 kB warning; Fallow against `3fdda5c` passed with one pre-existing non-error finding, zero complexity, and zero duplication; React Doctor score 53, equal to baseline. Protected `src/routeTree.gen.ts` SHA-256 remained `14A6932D22316BF69AF6EA6C1E343EE0C4704DE66039C8A674888D11ABA92DDD`. No Convex source change or deploy. Browser QA passed at 390×844, 768×1024, and 1280×800 with both accounts, including keyboard/pointer menu behavior, Profile SPA navigation, Quick Search/User Search avatars, Character/Staff tab migration, private-profile visibility, redirects, root not-found, no overflow, and clean console/server logs. QA server stopped and port 3000 freed.

# Phase 7 Discover Mobile Search Feedback

Status: COMPLETE. The committed Profile avatar positioning/border adjustment in `ac084c6` remains unchanged.

- [x] Reproduce the `/discover` mobile search-result overflow.
- [x] Add a focused responsive containment regression test.
- [x] Apply the smallest Discover result-card fix.
- [x] Run focused/full automated gates and responsive browser QA with clean console output.

Validation: focused Discover results 7/7; full suite 131 passed + 2 skipped files / 926 passed + 3 skipped tests; TypeScript, client + SSR build, Fallow patch audit, and diff check pass. Browser QA at 390, 768, and 1280 px confirms result cards equal the available grid width, document/card scroll widths stay contained, pointer navigation works, keyboard focus reaches the result link, and console output has no warnings or errors. React Doctor's branch-wide scan repeated the pre-existing render-time ref diagnostic outside this patch and its score API timed out; neither changed containment line was flagged.

# Phase 7 Catalog Biography Feedback

Status: COMPLETE. Character and Staff biographies render supported lightweight formatting safely; AniList entity links stay inside AnimeX.

- [x] Verify Character and Staff biographies contain AniList lightweight Markdown.
- [x] Render bold labels, nested formatted links, and safe external links without new dependency or raw HTML.
- [x] Replace AniList anime, character, and staff links with AnimeX routes; remove other AniList links.
- [x] Run focused/full gates and responsive browser QA, including 10 random Characters and 10 random Staff from one random anime.

Validation: focused Catalog Person 5/5; full suite 131 passed + 2 skipped files / 927 passed + 3 skipped tests; TypeScript, client + SSR build, Fallow patch audit, diff check, and route-tree hash pass. Live Browser QA covers Aoi Yuuki, Viktoriya Serebryakov, and 20 random people from Chainsmoker Cat at mobile width. Random QA found and closed one nested bold-link gap; final rerun is 10/10 Characters and 10/10 Staff with zero raw Markdown, AniList anchors, unsafe external links, invalid internal routes, horizontal overflow, console errors, or app-log warnings. React Doctor repeats one pre-existing Discover ref-mutation error outside this patch; biography files have no finding.

# Phase 8 Notifications, Privacy, Moderation

Status: SCOPE ADJUSTED. Detailed planning has not started.

- [x] Keep notification foundations, required moderation notifications, Public/Private privacy tools, Block/Unblock, and Post/Review reports in Phase 8.
- [x] Defer social notifications, preferences, deduplication, Followers-only UI, Comment/Reply reports, social moderation, and social Block integrations to Phase 9.
- [ ] Write and approve Phase 8 design/spec and implementation plan after Phase 7 closes.

# Phase 9 Social Interactions

Status: FINAL MVP PHASE. Scope locked; detailed planning has not started.

- [x] Own Follow/Unfollow, follower/following counts, Following feed, and Followers-only UI.
- [x] Own feed-card Likes, Review Likes, Comment Likes, text-only Comments, flat Comment Replies, and Reply Tags.
- [x] Own social reports, moderation, Block enforcement, notifications, preferences, target access, and deduplication.
- [x] Require all approved social UI to become functional and visible together; no disabled placeholders remain.
- [ ] Write and approve Phase 9 design/spec and implementation plan after Phase 8 closes.
