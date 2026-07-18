# AnimeX

AnimeX is an anime community context centered on tracking anime and sharing user activity through a social feed.

## Temporary Social UI Embargo

Through Phase 8, active UI omits Follow, Like, Comment, Following-feed, social-count, and Followers-only choices. Home exposes Home and Global; Review discovery exposes All, Public, and My Private. Stale Following-feed and Followers-discovery URLs replace to canonical routes before hidden queries mount.

Backend social contracts, schemas, authorization, and stored Followers visibility remain intact for Phase 9. New Post and Review creation maps a stored Followers account default to Private. Owner edits to legacy Followers Posts and Reviews preserve Followers unless Public or Private is explicitly selected. No migration rewrites stored data.

Phase 7 User Profile, Catalog People, and responsive Quick Search is complete and merged into `dev` at `9fdfc6b` from the approved locked design. User Profiles are signed-in-only with Public/Private visibility, owner edit/media actions, Activity/Reviews/Favorites, and identity-only User Search. Character/Staff destinations use canonical ID + display slug, strict provider-neutral contracts, paginated work tabs, and separate 24-hour Convex caches/leases. Quick Search is shared across public, landing, and auth headers: desktop modal; mobile Base UI-backed bottom drawer; Anime/Characters/Staff plus Users only for complete authenticated profiles, independent failure lanes, and close-before-navigation. Phase 9 owns social UI reactivation. Automated gates, responsive browser QA, reviewer PASS, real media lifecycle, and Storage failure/retry checks passed. User confirmed Phase 7 closure; deep-pagination QA has no Codex-run evidence. No production push or deploy is claimed.

## Language

**Activity**:
A feed-visible record created when a user publishes a Review or changes Anime Status to Completed Anime or Rewatched. Score alone never creates an Activity; when Score is available, AnimeX can include the current Score on a Completed Anime or Rewatch Completion Activity card.
_Avoid_: Generic event, notification, audit log

**Generated Activity Text**:
System-authored wording shown on a generated Activity card. Authors cannot edit Generated Activity Text; they may only delete the Activity card or change its visibility; Rewatch Completion Activity uses simple actor-action-anime wording such as `Mika rewatched Frieren`, without Rewatch Count, `again`, or a history hint.
_Avoid_: User caption, editable activity post

**Review Activity**:
A feed-visible activity created when a review is published. It shows author name, anime title, current Review Rating, and Review Summary, links to the Review Detail Page while the Review source exists, does not show the full Review body, does not create a standalone Activity for Score, and uses Activity Deletion rather than Review Deletion when only the feed card is removed.
_Avoid_: Separate review and rating activities, full review preview

**Review Visibility**:
The Feed Card Visibility applied to a Review source. It controls access to the Review Activity, Review Detail Page, Review Cards, anime-page review surfaces, signed-in Review Like action, and Review Visible Like Count; new Reviews show a Creation Visibility Selector before publishing; authors keep access to their own Private Reviews and their nonzero Review Visible Like Count, Visibility Change hides or restores source-level Review Likes for affected viewers without deleting them, viewers who lose access cannot add or remove their stored Review Likes until access returns, Activity Deletion removes the feed card but leaves the Review source and Review Visibility intact, and Bulk Visibility Change for Activity cards updates Review Visibility source-wide for active Review Activity cards only.
_Avoid_: Review activity-only visibility, separate detail-page visibility

**Review**:
A user's written opinion about one anime, capped at 2500 characters and paired with a required Review Rating and required Review Summary. Reviews are started from an anime detail page, not from the Post Composer.
_Avoid_: Comment, post, composer option

**Review Summary**:
A required separate user-written field, capped at 280 characters, shown on Review Activity cards and anime-page review surfaces. Review Summary is not the full Review body, is not auto-generated, and should not be treated as truncated Review preview text.
_Avoid_: Full review preview, feed review body, auto-generated excerpt

**Review Card**:
A source-backed card for a visible Review on the User Profile Reviews tab or anime-page review surfaces. It shows an anime image, anime name, current Review Rating, Review Summary, and open affordance; it is separate from the Review Activity feed card. Phase 9 may add the Review Visible Like Count and Review Like action.
_Avoid_: Review Activity card, full review body

**Review Button**:
A signed-in anime-detail-page action for starting a Review for that anime. Signed-out users can browse anime detail pages but do not see the Review Button.
_Avoid_: Post composer review option, generic create action

**Review Detail Page**:
A shareable page for the full Review body. Review Activity cards and anime detail pages may show the Review Summary and access to the Review Detail Page, but not the full Review body; Review Visibility controls access to it, and in MVP Review Detail Pages share the same signed-in Review Like action and Review Visible Like Count as Review Cards but do not have separate Comments.
_Avoid_: Feed-only review, post page

**Review Deletion**:
A user action that deletes the Review source. Review Deletion removes the Review Detail Page, Review Activity, Review Cards, source-level Review Likes and their Visible Like Count, and Anime Review Metrics contribution for all viewers, keeps prior notifications in history, and makes those notification targets resolve to unavailable content.
_Avoid_: Activity-only deletion, review hiding

**Review Edit**:
A change to an existing Review source, including its text, Review Summary, or Review Rating. Review Edits update the Review Detail Page, Review Activity card, anime-page review surfaces, and Anime Review Metrics when relevant, including after Activity Deletion removed the Review Activity card, without creating new activity, without causing a feed bump, and without recreating the removed Review Activity card.
_Avoid_: New review activity, feed repost, review deletion

**Post**:
A short user-created feed entry that is not a Review or generated Activity. A Post may contain text and zero or one safe external HTTPS image/video media item. Post anime attachment and first-party Post media uploads are not part of Phase 5; anime attachment remains optional backlog.
_Avoid_: Review, activity

**Post Composer**:
A signed-in modal or mobile sheet for creating a Post from the post feed. On desktop, its entry point appears near the top of the post feed for signed-in users; on mobile, the signed-in Create tab opens the same Post Composer. The Post Composer shows a Creation Visibility Selector for each Post, and signed-out users do not see its Create entry points.
_Avoid_: Review composer, activity creator

**Signed-In Creation**:
An access rule where creating a new Post, Review, Comment, or Comment Reply requires a signed-in user who has completed Email OTP Verification. For the Post Composer, AnimeX hides desktop Create and the mobile Create tab from signed-out users; for Reviews, anime detail pages hide the Review Button from signed-out users; Email-Unverified Users are redirected to the Email OTP Verification Page before normal signed-in app access.
_Avoid_: Signed-out composer, gated Create prompt

**Account-Only Surface**:
A signed-in-only area that depends on the current user's account, such as the Notification Page, Privacy Settings, or Blocked Users List. Signed-out direct access to Account-Only Surfaces sends the visitor to the public Home Feed rather than showing a sign-in-required page.
_Avoid_: Public page, sign-in-required page

**Non-Public Direct Link**:
A direct link to a feed card or Review that a signed-out visitor cannot access because the current visibility is not Public. Signed-out Non-Public Direct Links send the visitor to the public Home Feed rather than showing unavailable content or a sign-in-required page.
_Avoid_: Signed-out unavailable page, sign-in-required content page

**Unavailable Content Notice**:
A minimal notice shown when a direct link or notification target points to content whose source was deleted or removed by moderation. It displays only `This content is unavailable`, does not redirect to the Home Feed, and does not expose reason details, removed content details, or interaction counts.
_Avoid_: Non-public redirect, hidden-content sign-in page

**Signed-Out Browsing**:
A read-only visitor state for users who are not signed in. Signed-out users can browse public content, the public read-only Home Feed, Discover, Quick Search without User results, anime detail pages, public Reviews, Visible Like Counts, Visible Comment Counts, and visible Comments on public feed cards, but cannot open User Profiles or User search, create Posts, Reviews, Comments, Comment Replies, Likes, Follows, Blocks, or Content Reports. Signed-out User Profile and User search routes send the visitor to sign-in with a validated `returnTo`; direct access to other Account-Only Surfaces and Non-Public Direct Links sends them to the public Home Feed.
_Avoid_: Guest interaction, anonymous action

**Post-Sign-In Return**:
A navigation behavior after a signed-out visitor uses `Sign in` from an AnimeX page or is redirected there from a signed-in-only User Profile/User search route. Successful sign-in returns the user to the validated relative target, such as an anime detail page, public Review Detail Page, or User Profile; when sign-in starts from the public Home Feed, it opens the signed-in Home Feed; if the return target becomes unavailable during sign-in, the user sees an Unavailable Content Notice.
_Avoid_: Forced generic landing, lost browsing context

**Signed-In Auth Redirect**:
A navigation behavior for a user who is already signed in and opens the sign-in page directly. AnimeX sends a complete signed-in user to the signed-in Home Feed, and sends a Pending OAuth Sign-Up user to Username completion rather than showing the sign-in form again.
_Avoid_: Duplicate login, auth loop

**Authentication Identity**:
The auth-owned identity for an AnimeX account. Authentication Identity owns Account Email, Email OTP Verification state, Password Sign-In credentials, OAuth provider account IDs, Linked Sign-In Methods, sessions, and account-security verification. It is the source of truth for sign-in, account recovery, and account-security actions, not for public profile display.
_Avoid_: User Profile identity, social profile, anime-list owner

**AnimeX User Record**:
The app-owned user identity linked one-to-one with an Authentication Identity. AnimeX User Record owns Username, display name, User Avatar, Account-Level Default Visibility, User Profile fields, social/feed ownership, and anime-list profile data. It uses Authentication Identity only to know which signed-in account is acting, and it does not own Account Email or sign-in methods.
_Avoid_: Auth user, credential store, session owner

**Auth-Profile Link**:
The one-to-one relationship between a completed Authentication Identity and an AnimeX User Record. App content, follows, blocks, reviews, posts, comments, likes, and anime-list data reference the AnimeX User Record, while sign-in and account-security checks resolve through Authentication Identity. Pending OAuth Sign-Up has an Authentication Identity without an Auth-Profile Link until Username completion.
_Avoid_: Duplicate profile, email-based profile link, many profiles per account

**Password Sign-In**:
A sign-in flow for existing password accounts that uses Account Email and password only. Account Email matching is case-insensitive. Username is not a sign-in identifier in MVP because Username is public-facing. Password Sign-In shows a `Forgot password?` link under the password field and before the submit button; the link opens the Password Reset request page.
_Avoid_: Username sign-in, display-name login, OAuth sign-in, hidden password reset link

**OAuth Entry Button**:
A provider-specific auth button shown on both Sign-In and Sign-Up screens with copy such as `Continue with Google`. The same OAuth Entry Button starts the provider flow from either screen, then AnimeX resolves the result after provider return: a linked provider account ID signs in through OAuth Sign-In, a provider-verified Account Email without conflict starts OAuth Sign-Up, and an unavailable Account Email shows Account Email Conflict copy. The button text does not change between Sign-In and Sign-Up screens.
_Avoid_: Separate Google sign-in copy, separate Google sign-up copy, provider email auto-linking

**Auth Form Visual Direction**:
The locked visual direction for AnimeX authentication screens. Desktop Sign-In follows `docs/visual/auth/auth-desktop-sign-in.png`: dark AnimeX shell, top desktop navigation, consistent AnimeX `A/X` logo, centered auth panel, `Continue with Google` above the `or` divider, Account Email and password fields, `Forgot password?`, coral Sign-In button, and create-account switch. Mobile Sign-Up follows `docs/visual/auth/auth-mobile-create-account.png`: compact logo header, single large Create Account panel, `Continue with Google` above the `or` divider, Account Email, password, confirm password, teal Create Account button, and sign-in switch. Username availability feedback appears on the post-verification Username Completion page. Both references exclude mascot art, notebook/notepad, pen imagery, Japanese characters, and Japanese typography.
_Avoid_: Mascot auth art, notebook auth art, pen auth art, Japanese auth text, inconsistent auth logo

**OAuth Sign-In**:
A possible future sign-in flow for accounts with a linked external identity. AnimeX matches returning OAuth users by the OAuth provider account ID already linked to an AnimeX account, not by Account Email. OAuth Sign-In does not automatically update Account Email when the provider email changes. If the OAuth provider account ID is not linked yet and the provider email triggers Account Email Conflict, AnimeX blocks with `Email already in use. Sign in instead.` and does not auto-link by email.
_Avoid_: Account Email matching, automatic account linking, duplicate account merge

**OAuth Provider Email Drift**:
A state where a linked OAuth provider account reports a different email than the user's AnimeX Account Email. AnimeX keeps OAuth Sign-In tied to the linked provider account ID, keeps the AnimeX Account Email unchanged, and requires Account Email Change if the user wants the AnimeX Account Email updated.
_Avoid_: Automatic email sync, provider-email overwrite, implicit Account Email Change

**OAuth Provider Email Requirement**:
An OAuth Sign-Up rule where the OAuth provider must supply a verified email address used as the Account Email. OAuth Sign-Up has no user-entered email step and no AnimeX Email OTP Verification path; if the provider does not supply an email address or does not report the email as verified, AnimeX cannot continue OAuth Sign-Up in MVP and the user must use another sign-up method or OAuth provider.
_Avoid_: User-entered OAuth signup email, missing-provider-email signup, unverified provider email, email entry step, OAuth Email OTP

**OAuth Provider Avatar Drift**:
A state where a linked OAuth provider account reports a different profile picture than the user's AnimeX User Avatar. AnimeX treats the provider profile picture as an initial OAuth Sign-Up seed only; when used, the provider picture becomes an AnimeX-owned initial User Avatar and is not hotlinked long term. After sign-up, User Avatar does not depend on the provider image URL and does not automatically change when the provider picture changes.
_Avoid_: Automatic avatar sync, provider-avatar overwrite, implicit profile edit, long-term provider avatar hotlink

**OAuth Avatar Import Failure**:
A non-critical OAuth Sign-Up avatar state where AnimeX cannot make a provider-supplied profile picture into the user's AnimeX-owned initial User Avatar. OAuth Sign-Up continues with the initials-based Default Avatar, does not show an avatar-specific user-facing error, and lets the user change User Avatar later from the User Profile.
_Avoid_: OAuth Sign-Up failure, provider hotlink fallback, avatar setup blocker

**Linked Sign-In Methods**:
The account state where one AnimeX account can use more than one sign-in method. In MVP, this state can happen when an OAuth-created account creates a password through Password Reset: OAuth Sign-In still works because the OAuth provider account ID remains linked, and Password Reset adds Password Sign-In access without replacing or unlinking OAuth Sign-In. MVP has no user-facing sign-in method management, so users cannot link OAuth from Account Settings, unlink OAuth, or remove Password Sign-In after both methods exist.
_Avoid_: Separate duplicate accounts, OAuth replacement, unlinking flow, Account Settings OAuth linking

**OAuth Account Linking**:
A non-MVP Account Settings action where a completed account would add an OAuth provider to an existing AnimeX account. Password-created users cannot link Google or other OAuth providers from Account Settings in MVP. OAuth Sign-Up with an Account Email already used by an existing AnimeX account remains blocked with `Email already in use. Sign in instead.` instead of linking automatically.
_Avoid_: OAuth auto-linking, Account Settings OAuth connect, duplicate account merge

**Account Deletion**:
A non-MVP self-service account removal action. AnimeX MVP does not let users delete their own account from Account Settings; any future Account Deletion policy is separate from Moderation Removal, author content deletion, abandoned Unverified Account Reservation cleanup, and admin-only account enforcement.
_Avoid_: Moderation removal, content deletion, unverified-account cleanup

**Password Sign-In Failure**:
A failed Password Sign-In state caused by wrong Account Email, wrong password, or both. AnimeX shows the generic message `Invalid email or password.` and does not reveal whether the Account Email exists.
_Avoid_: Account Email Conflict, email existence hint, username sign-in failure

**Sign-In Abuse Limit**:
A temporary Password Sign-In protection state reached after too many failed sign-in attempts. AnimeX blocks more Password Sign-In attempts for a short time and shows the generic message `Too many attempts. Try again later.` without revealing whether the Account Email exists. Password Sign-In still shows the `Forgot password?` link during Sign-In Abuse Limit because the abuse limit blocks sign-in attempts, not entry to Password Reset.
_Avoid_: Account lockout, account existence disclosure, password reset limit, forgot-password hiding

**Sign-Up Abuse Limit**:
A temporary signup protection state reached after too many Simplified Sign-Up submissions, OAuth Sign-Up submissions, or signup Email OTP send/resend attempts. AnimeX temporarily blocks more sign-up submissions or signup OTP sends and shows `Too many attempts. Try again later.` If an Email-Unverified User is already on the Email OTP Verification Page, Sign-Up Abuse Limit blocks requesting a new signup OTP and blocks Verification Email Change, because changing the Account Email would send a new signup OTP. It does not block submitting the current OTP; a still-valid current OTP can complete Email OTP Verification. If the current OTP expires while Sign-Up Abuse Limit is active, AnimeX keeps the user on the Email OTP Verification Page, shows the expired OTP message, and keeps resend plus Verification Email Change blocked until Sign-Up Abuse Limit clears. When Sign-Up Abuse Limit blocks Verification Email Change, the current Account Email and current OTP stay unchanged. Sign-Up Abuse Limit is separate from Account Email Conflict, Inline Account Email Availability, and Email OTP Limits; real Account Email conflicts still show `Email already in use. Sign in instead.`
_Avoid_: Account Email Conflict, email existence disclosure, OTP cooldown, OTP verification block, email-change bypass, resend-after-expiry bypass, account lockout

**Abuse Limit Messaging**:
A generic feedback rule for temporary abuse-limit states. AnimeX does not show countdowns or exact unlock times for Sign-In Abuse Limit, Sign-Up Abuse Limit, Password Reset Abuse Limit, Account Email Change OTP Abuse Limit, or Sensitive Action Abuse Limit. Sign-In Abuse Limit, Sign-Up Abuse Limit, Account Email Change OTP Abuse Limit, and Sensitive Action Abuse Limit show `Too many attempts. Try again later.` while Password Reset Abuse Limit keeps the Password Reset request response generic.
_Avoid_: Countdown timer, exact unlock time, security threshold disclosure

**Password Reset**:
An MVP recovery flow that starts from Account Email and can reset an existing password or create a new password for a completed account that does not yet have one. Password Reset request entry follows Password Reset Request Validation. After a user submits the Password Reset request, AnimeX always shows `If an account exists, reset instructions were sent.` and does not reveal whether the Account Email exists, what sign-in method the account uses, whether the Account Email is held by Pending OAuth Sign-Up, or whether Password Reset Abuse Limit is active. If the Account Email belongs to an eligible completed account and Password Reset Abuse Limit is not active, AnimeX sends a Password Reset Email; if the Account Email is held only by Pending OAuth Sign-Up, AnimeX sends no Password Reset Email and the user must resume OAuth Sign-Up with the provider to finish Username completion. The reset link or token expires after 30 minutes, follows Password Reset Link Replacement, the valid-link reset form asks only for new password and confirm new password, shows concise Password Rules text `8-24 characters.` near the new password field before submit, uses submit button text `Reset password`, the new password follows Password Rules, and successful reset applies Password Reset Token Invalidation and Password Reset Session Revocation, sends a Security Email Notice to the Account Email, shows Password Reset Success State, and returns the user to Password Sign-In without automatically signing them in. A valid-link reset form does not show Account Email, Username, User Avatar, profile identity, OAuth hint, sign-in method, or account-type details. An invalid or expired reset link or token follows Password Reset Link Failure. Password Reset does not reject the new password solely because it matches the current password. Password Reset does not complete Email OTP Verification; an Email-Unverified User remains Email-Unverified after Password Reset and is routed to the Email OTP Verification Page after Password Sign-In. If the completed account was created through OAuth, Password Reset adds Password Sign-In access without replacing OAuth sign-in.
_Avoid_: Username recovery, email existence hint, permanent reset link

**Password Reset Request Validation**:
A Password Reset request-form behavior that validates only Account Email format before submit. AnimeX does not use Inline Account Email Availability, Account Email Conflict, or any other account-existence signal on the Password Reset request form, and it does not reveal whether the Account Email exists, is unverified, has Password Sign-In, uses OAuth, is held by Pending OAuth Sign-Up, is rate-limited, or is missing.
_Avoid_: Inline Account Email Availability, Account Email Conflict, account existence hint

**Password Reset Email**:
A transactional recovery email sent when Password Reset can proceed for an eligible completed account and Password Reset Abuse Limit is not active. It uses AnimeX branding and the reset action only, uses subject line `Reset your AnimeX password`, uses preview text `Use this link within 30 minutes to reset your password.`, uses both a primary `Reset password` action and a visible fallback URL, includes the visible expiry note `This link expires in 30 minutes.`, includes the minimal warning `If you did not request this, you can ignore this email.`, and does not include Account Email, Username, display name, User Avatar, profile identity, sign-in method, account-type details, device, IP, browser, or location details. The visible fallback URL appears as full raw URL text so the recipient can copy it directly if the primary action does not work. The warning is informational only and does not create an In-App Notification, Moderation Case, security case, or account flag. Sending Password Reset Email does not also send a Security Email Notice; Security Email Notice is sent only after successful Password Reset.
_Avoid_: Security Email Notice, personalized greeting, personalized subject, personalized preview text, profile identity, account-type hint, Account Email repeat, Username in subject, Account Email in subject, sign-in method in subject, button-only reset email, hidden fallback URL, short fallback link label, hidden expiry, extra security action link, automatic security case, request metadata

**Password Reset Link Replacement**:
A Password Reset link behavior where a newer Password Reset request for the same account invalidates older reset links or tokens. Only the latest issued reset link or token can be used.
_Avoid_: Multiple active reset links, reusable reset token, permanent reset link

**Password Reset Token Invalidation**:
A cleanup behavior after successful Password Reset where AnimeX invalidates every outstanding reset link or token for that account, including the used token and any other token that could still be stored. No reset link or token remains usable after Password Reset succeeds.
_Avoid_: Used-token-only invalidation, remaining reset token, post-reset reset link reuse

**Password Reset Success State**:
A short confirmation state after successful Password Reset. AnimeX shows `Password reset. Sign in with your new password`, shows countdown copy `Redirecting to sign in in 5 seconds...` with the number updating each second before redirecting to Password Sign-In, and also offers a `Sign in` link for immediate navigation. If the user clicks `Sign in` before the countdown ends, immediate navigation wins and the countdown redirect stops. The Password Sign-In page reached from Password Reset Success State does not prefill Account Email and does not show a reset-success notice. Password Reset Success State does not automatically sign the user in, does not show Account Email, Username, or account identity, and does not mention Email OTP Verification. Email-Unverified Users follow the normal Email OTP Verification Page routing after Password Sign-In.
_Avoid_: Automatic sign-in, Account Email prefill, sign-in success notice, silent redirect without countdown, detailed account-security summary, account identity display, email verification prompt, secondary account links

**Password Reset Link Failure**:
A Password Reset state caused by an invalid, expired, already used, or replaced reset link or token. AnimeX shows `Reset link is invalid or expired. Request a new one.` and provides a way back to the Password Reset request page without revealing whether the Account Email exists. AnimeX does not say whether the link was replaced, superseded, or already used. AnimeX does not prefill or expose Account Email from the failed token; the user re-enters Account Email on the Password Reset request page.
_Avoid_: Account Email lookup result, token diagnostics, automatic sign-in, email prefill from failed token, replaced-link message

**Password Reset Abuse Limit**:
A temporary Password Reset protection state reached after too many Password Reset requests. AnimeX temporarily stops sending additional reset emails while keeping the Password Reset request response generic: `If an account exists, reset instructions were sent.`
_Avoid_: Sign-In Abuse Limit, account existence disclosure, visible reset lockout

**Password Reset Session Revocation**:
A session behavior after successful Password Reset. AnimeX revokes all existing signed-in sessions for that account after Password Reset succeeds, regardless of whether a session came from Password Sign-In or OAuth sign-in, and requires sign-in again with the new password. Password Reset Session Revocation does not remove Linked Sign-In Methods.
_Avoid_: Account Password Change session retention, Account Email Change session retention, normal sign-out

**Sensitive Action Abuse Limit**:
A temporary protection state for password-protected Account Settings actions reached after too many wrong current-password attempts. AnimeX temporarily blocks both Account Email Change and Account Password Change, regardless of which action triggered the limit, and shows `Too many attempts. Try again later.` Sensitive Action Abuse Limit is shared across sensitive account actions and is separate from Sign-In Abuse Limit and Password Reset Abuse Limit.
_Avoid_: Password Sign-In Failure, Password Reset Abuse Limit, account lockout

**Account Password Change**:
An Account Settings action for accounts that already have Password Sign-In. Account Password Change requires current password, new password, and confirm new password; the new password follows Password Rules, confirm new password must match, must be different from the current password, applies Account Password Change Session Retention after success, sends a Security Email Notice to the current Account Email after success, and OAuth-only accounts do not use Account Password Change unless they first add Password Sign-In through Password Reset.
_Avoid_: Password Reset, OAuth reauthentication, sign-up password

**Account Password Change Session Retention**:
A session behavior after successful Account Password Change. AnimeX keeps all existing signed-in sessions active after Account Password Change succeeds; MVP does not force sign-out or include a log-out-other-sessions action for Account Password Change.
_Avoid_: Password Reset Session Revocation, forced logout, session management

**Account Password Change Failure**:
A failed Account Password Change state caused by entering the wrong current password or trying to reuse the current password as the new password. When the current password is wrong, AnimeX shows `Incorrect password.` inline and does not use Password Sign-In Failure copy; repeated wrong current-password attempts can trigger Sensitive Action Abuse Limit. When the new password matches the current password, AnimeX shows `New password must be different from current password.` inline.
_Avoid_: Password Sign-In Failure, password reset, account email change

**Simplified Sign-Up**:
A password-based new-account flow whose sign-up form includes Account Email, password, and confirm password only. The password follows Password Rules. The email becomes the Account Email. Simplified Sign-Up sends an Email OTP after form submission, redirects to the Email OTP Verification Page, and after successful Email OTP Verification sends the verified user to Username Completion before private access. Username, initial display name, Default Avatar initials, and Account-Level Default Visibility are created only when Username Completion succeeds. Repeated submissions or signup OTP sends can trigger Sign-Up Abuse Limit. Custom avatar and privacy changes happen later from the User Profile or Privacy Settings.
_Avoid_: Pre-verification username, required avatar selection, separate display name setup

**Password Rules**:
The password requirements for Simplified Sign-Up, Password Reset, and Account Password Change. Password must be 8-24 characters, has no forced symbol or number requirement, does not block common passwords in MVP, and confirm password must match password.
_Avoid_: Passphrase policy, OAuth credential, common-password block, forced symbol, forced number

**Password Visibility Toggle**:
An eye-style show/hide control available on every AnimeX password input: Password Sign-In password, Simplified Sign-Up password and confirm password, valid-link Password Reset new password and confirm new password, Account Password Change current password, new password, and confirm new password, and Account Email Change Reauthentication current-password entry. Password fields stay hidden by default. A hidden password field shows an eye icon with accessible label `Show password`; a visible password field shows an eye-off icon with accessible label `Hide password`. Each Password Visibility Toggle affects only its own field, even when several password fields are in the same form. If validation or submit fails, a visible password field stays visible while the user remains on that form; password fields return to hidden when the user leaves and later reopens the form. The toggle only changes local display and does not change validation, submission, session, or account-security behavior.
_Avoid_: Password field without toggle, visible by default, reset-to-hidden after inline error, missing accessible label, form-wide password visibility toggle, shared password visibility state, account identity hint

**Password Input Assistance**:
The entry behavior for every AnimeX password input. Password fields allow paste and password-manager autofill on Password Sign-In, Simplified Sign-Up, valid-link Password Reset, Account Password Change, and Account Email Change Reauthentication. After successful Password Reset, AnimeX relies on normal browser and password-manager behavior to offer saved-password updates; AnimeX does not show a custom in-app save-password prompt.
_Avoid_: Blocked paste, disabled autofill, password-manager blocking, custom save-password prompt

**Account Email**:
A unique email address attached to one AnimeX account or Pending OAuth Sign-Up. Account Email uniqueness is case-insensitive, so `Mika@x.com` and `mika@x.com` are the same Account Email and cannot belong to separate accounts. Simplified Sign-Up, OAuth Sign-Up with provider-verified email, Verification Email Change, and Account Email Change use Account Email uniqueness.
_Avoid_: Email notification destination, optional contact email, case-sensitive email identity

**Account Email Conflict**:
A Simplified Sign-Up, OAuth Sign-Up, Verification Email Change, or Account Email Change validation state where the Account Email already belongs to another account, is held by Unverified Account Reservation, is held by Pending OAuth Sign-Up, or is reserved by another Pending Account Email Change. AnimeX blocks the action inline with `Email already in use. Sign in instead.` Sign-in errors stay generic and do not use Account Email Conflict copy; if the owner signs in while still unverified, AnimeX routes them to the Email OTP Verification Page. During Verification Email Change or Account Email Change, Account Email Conflict keeps the current Account Email and current OTP unchanged.
_Avoid_: Sign-in failure, duplicate account merge, email recovery

**Inline Account Email Availability**:
An Account Email input validation behavior that checks whether the entered Account Email is already unavailable with case-insensitive matching because it is active on an account, held by Unverified Account Reservation, held by Pending OAuth Sign-Up, or reserved by another Pending Account Email Change. Simplified Sign-Up, Verification Email Change, and Account Email Change use Inline Account Email Availability during entry and validate again on submit.
_Avoid_: Email OTP Verification, username availability, password reset

**Email OTP Verification**:
A required account verification flow where AnimeX sends a one-time passcode to the user's email address. Completing Email OTP Verification changes the user from Email-Unverified User to verified, redirects to Username Completion when the account has no AnimeX User Record, and allows normal signed-in app access only after Username Completion succeeds; OTP behavior follows Email OTP Limits. Sign-Up Abuse Limit can block requesting a new signup OTP, but it does not block submitting the current OTP.
_Avoid_: Email link verification, optional email check

**Email OTP Limits**:
The shared validation limits for Email OTP Verification and Account Email Change Verification. An OTP expires after 10 minutes, OTP resend has a 60-second cooldown, every new OTP invalidates older OTPs immediately so only the latest OTP works, and 5 wrong attempts invalidate the current OTP, clear the OTP field, show an inline message, and require the user to request a new OTP; if an OTP expires while the user remains on the verification surface, AnimeX keeps the user on that surface and shows an inline expired message. Resend becomes available when cooldown allows unless a more specific abuse limit blocks sending a new OTP, such as Sign-Up Abuse Limit for signup verification or Account Email Change OTP Abuse Limit for Account Email Change Verification.
_Avoid_: Password lockout, account ban

**Email OTP Verification Page**:
A signed-in verification page where an Email-Unverified User can enter the OTP sent after Simplified Sign-Up, request a new OTP after signing in with an unverified email, or use Verification Email Change after a mistyped email. It is the redirect target for Email-Unverified Users until Email OTP Verification completes, then redirects to Username Completion when no AnimeX User Record exists. If Sign-Up Abuse Limit is active, the page still accepts the current OTP when it is valid but blocks requesting a new signup OTP and blocks Verification Email Change until the limit clears. If the current OTP expires while Sign-Up Abuse Limit is active, the page shows the expired OTP message and keeps resend plus Verification Email Change blocked with Sign-Up Abuse Limit messaging.
_Avoid_: Home Feed verification banner, soft creation gate

**Verification Email Change**:
An Email OTP Verification Page action for Email-Unverified Users who mistyped their Account Email during Simplified Sign-Up. Changing the Account Email sends a new OTP to the new Account Email and invalidates the old OTP immediately; changing to an Account Email already used by another account triggers Account Email Conflict and keeps the current Account Email and current OTP unchanged. If Sign-Up Abuse Limit is active, Verification Email Change is blocked because it would send a new signup OTP; the current Account Email and current OTP stay unchanged.
_Avoid_: Profile email edit, verified-account email change, signup OTP resend bypass

**Account Email Change**:
A verified-account Account Settings action for changing Account Email after Email OTP Verification. Account Email Change is allowed in MVP, uses Inline Account Email Availability to prevent choosing an Account Email already active, held, or reserved by another account state, requires Account Email Change Reauthentication before sending OTP to the requested new Account Email, creates a Pending Account Email Change only after successful reauthentication and eligible OTP send, starts Account Email Change Verification, keeps the current Account Email active until verification succeeds, does not offer Pending Account Email Change Cancellation, and is separate from Verification Email Change for Email-Unverified Users. If a user starts Account Email Change for the same requested Account Email as an existing Pending Account Email Change, AnimeX treats it as an Account Email Change OTP resend. If a user starts Account Email Change for a different requested Account Email while another Pending Account Email Change still exists, the newer request replaces the existing pending change only after the newer request passes validation, reauthentication, abuse-limit checks, and can send the new OTP.
_Avoid_: Verification Email Change, password reset, sign-up email

**Account Email Change Reauthentication**:
A security check required before Account Email Change sends OTP to the requested new Account Email. For accounts with Password Sign-In, the user must re-enter their current password; for OAuth-only accounts, AnimeX will require fresh OAuth reauthentication when OAuth Sign-Up is implemented. Without successful Account Email Change Reauthentication, AnimeX does not create a Pending Account Email Change or reserve the requested new Account Email.
_Avoid_: Password reset, email OTP verification, normal sign-in

**Account Email Change Reauthentication Failure**:
A failed Account Email Change Reauthentication state for password accounts. When the current password is wrong, AnimeX shows `Incorrect password.` inline, does not create a Pending Account Email Change, does not reserve the requested new Account Email, and does not use Password Sign-In Failure copy; repeated wrong current-password attempts can trigger Sensitive Action Abuse Limit.
_Avoid_: Password Sign-In Failure, email conflict, password reset

**Pending Account Email Change**:
A requested new Account Email that has not passed Account Email Change Verification yet. Pending Account Email Change temporarily reserves the requested new Account Email from other accounts while the OTP is valid, survives sign-out until its OTP expires or a newer Account Email Change starts, and releases its reservation when the OTP expires or a newer Account Email Change starts; OTP expiry releases the reservation even when Account Email Change OTP Abuse Limit is active. A repeat Account Email Change for the same requested Account Email is an OTP resend: the old OTP becomes invalid, a new OTP is sent when cooldown and abuse limits allow, the OTP expiry extends, and the same requested Account Email reservation stays in place. A newer Account Email Change for a different requested Account Email invalidates the old OTP, releases the old requested Account Email reservation, reserves the new requested Account Email, and sends a new OTP. If Account Email Change OTP Abuse Limit or another validation step blocks the newer OTP send, the existing Pending Account Email Change remains unchanged. AnimeX does not provide a user-facing cancel option for Pending Account Email Change; users can ignore an unwanted Account Email Change OTP until it expires. During that time, the current Account Email remains the active Account Email.
_Avoid_: Active account email, unverified account reservation, email conflict

**Pending Account Email Change Cancellation**:
A non-MVP account action. AnimeX does not let users cancel a Pending Account Email Change from Account Settings; an unwanted Pending Account Email Change is ignored until its OTP expires, or replaced by a newer Account Email Change. The current Account Email stays active while the Pending Account Email Change is unresolved.
_Avoid_: Cancel email change button, manual reservation release, account deletion, active email change, password reset

**Account Email Change Verification**:
An OTP confirmation step for Account Email Change that follows Email OTP Limits. AnimeX sends the OTP to the requested new Account Email when Account Email Change OTP Abuse Limit is not active; the current Account Email remains the active Account Email for Password Sign-In and Password Reset until the new email passes OTP verification. If Account Email Change Verification is not completed, the current Account Email stays unchanged. When Account Email Change Verification succeeds, AnimeX applies Account Email Change Session Retention and sends a Security Email Notice to the previous Account Email.
_Avoid_: Immediate email replacement, sign-up verification, password reset

**Account Email Change OTP Abuse Limit**:
A temporary Account Email Change Verification protection state reached after too many Account Email Change OTP send or resend attempts. AnimeX blocks sending or resending a new Account Email Change OTP and shows `Too many attempts. Try again later.` without a countdown. Account Email Change OTP Abuse Limit keeps any existing Pending Account Email Change unchanged while its OTP is still valid, keeps the current Account Email active, and does not create a new Pending Account Email Change or reserve a newly requested Account Email when the OTP cannot be sent. A blocked newer Account Email Change does not release the old requested Account Email reservation or invalidate the old OTP. If the current Account Email Change OTP expires while Account Email Change OTP Abuse Limit is active, the Pending Account Email Change releases the requested Account Email reservation and the current Account Email stays active; Account Email Change OTP Abuse Limit still blocks starting or resending another Account Email Change OTP until it clears. It is separate from Sign-Up Abuse Limit and Sensitive Action Abuse Limit.
_Avoid_: Sign-Up Abuse Limit, Sensitive Action Abuse Limit, Account Email Change Reauthentication Failure, countdown

**Account Email Change Session Retention**:
A session behavior after successful Account Email Change. AnimeX keeps the user's existing signed-in sessions active after Account Email Change succeeds; MVP does not force sign-out or include a log-out-other-sessions action for Account Email Change.
_Avoid_: Forced logout, session revocation, password reset session policy

**Security Email Notice**:
A mandatory transactional account-safety email that is separate from In-App Notifications and Notification Preferences. After Account Email Change succeeds, AnimeX immediately sends a short Security Email Notice to the previous Account Email with the copy `Your AnimeX account email was changed.` After Account Password Change succeeds, AnimeX immediately sends a short Security Email Notice to the current Account Email with the copy `Your AnimeX password was changed.` After Password Reset succeeds, AnimeX immediately sends a short Security Email Notice to the Account Email with the copy `Your AnimeX password was reset.` Security Email Notices are email-only in MVP and do not appear in an Account Settings history or list. Security Email Notices are not delayed or batched. Security Email Notice delivery failure does not block or undo a completed Account Email Change, Account Password Change, or Password Reset, and does not show a user-facing warning after the account-security action succeeds. Security Email Notices can be sent to an unverified Account Email; Password Reset and Account Password Change send to the current Account Email, and Account Email Change sends to the previous Account Email, even if that destination email is unverified. AnimeX does not send Security Email Notices for Sign-In Abuse Limit, Sign-Up Abuse Limit, Password Reset Abuse Limit, Password Reset request, Password Reset Email delivery, Account Email Change OTP Abuse Limit, or Sensitive Action Abuse Limit in MVP. Security Email Notices cannot be disabled by Notification Preferences, have no action link, and do not include device, IP, browser, or location details in MVP.
_Avoid_: In-app notification, marketing email, notification preference

**Email-Unverified User**:
A signed-in user who has not completed Email OTP Verification. Email-Unverified Users are redirected to the Email OTP Verification Page when signing in or trying to enter the normal signed-in app, cannot access normal signed-in surfaces or create user-authored content until verification completes, and hold only Account Email through Unverified Account Reservation.
_Avoid_: Signed-out user, banned user

**Unverified Account Reservation**:
A reservation state created after Simplified Sign-Up submits and before Email OTP Verification completes. The Email-Unverified User account exists, so its Account Email remains unavailable to other accounts. No Username is reserved before Email OTP Verification; Username is created only during Username Completion.
_Avoid_: Soft hold without account, temporary username claim, verified account

**Username**:
A unique account name used as the user's MVP display name. Username is required during Username Completion after Email OTP Verification or provider-verified OAuth Sign-Up, must be 3-30 characters, may contain letters, numbers, and underscores only, cannot contain spaces, cannot start or end with an underscore, preserves typed case for display, must not collide with an existing Username case-insensitively, does not allow distinct accounts such as `Mika` and `mika`, and can generate the Default Avatar initials.
_Avoid_: Optional nickname, separate display name

**Inline Username Availability**:
A Username Completion validation behavior that checks whether the entered Username already exists before creating the AnimeX User Record. AnimeX checks availability after a short typing pause, about 400ms, and validates again on submit. If the Username is taken, AnimeX shows the problem inline and does not create the AnimeX User Record until the user chooses an available Username.
_Avoid_: Submit-only collision surprise, duplicate username

**OAuth Username Autofill**:
An OAuth Sign-Up behavior where AnimeX pre-fills the Username field from a provider-supplied username when one is available. The pre-filled Username is shown as-is, remains editable, does not get sanitized into a generated suggestion, still uses Inline Username Availability, and must pass normal Username format and uniqueness validation before OAuth Sign-Up can finish. If the provider-supplied username is invalid or already taken, AnimeX shows the normal inline validation problem on that field until the user edits it.
_Avoid_: Locked provider username, automatic account creation, display name autofill, generated username suggestion, silent username sanitization

**Username Completion**:
The signed-in page where a verified password user or Pending OAuth Sign-Up finishes account creation by choosing a valid Username. It shows the Account Email read-only as `Signed in with {Account Email}`, shows one editable Username field with normal Username validation, and offers `Continue` plus `Sign out`. It does not allow Account Email editing from this step. Submitting a valid Username creates the AnimeX User Record and Auth-Profile Link, uses Username as the initial display name, applies the initial User Avatar rule, applies Private default visibility, and sends the user to the signed-in Home Feed.
_Avoid_: Email edit, hidden pending Account Email, private access before Username, auto-created User Profile without Username

**Pending OAuth Sign-Up**:
A signed-in but incomplete OAuth Sign-Up state after AnimeX accepts a provider account ID and provider-verified email but before the user submits a final valid Username. Pending OAuth Sign-Up has an Authentication Identity and holds its Account Email unavailable to other sign-ups or email changes until Username completion or Pending OAuth Sign-Up Cleanup. It may sign out, but has no AnimeX User Record, Auth-Profile Link, Username reservation, User Profile, feed/social owner, private-page access, or private actions until Username completion. Closing the tab does not end the pending session within its normal session lifetime; opening AnimeX again returns the user to Username completion, while signing out ends the current session and a later OAuth attempt with the same provider account ID resumes Pending OAuth Sign-Up.
_Avoid_: Full account, Email-Unverified User, Unverified Account Reservation, abandoned User Profile, private access before Username

**Pending OAuth Sign-Up Cleanup**:
A weekly cleanup policy for abandoned Pending OAuth Sign-Up records. Cleanup applies only when there is no Auth-Profile Link, no active pending session, and the last pending session expiry is older than 24 hours; it removes only the pending auth identity and pending OAuth state, never a completed AnimeX account. If the same OAuth provider account starts sign-up after cleanup, AnimeX treats it as a fresh OAuth Sign-Up, revalidates the provider response, reruns Account Email Conflict checks, and opens Username completion again.
_Avoid_: Daily pending cleanup, deleting completed accounts, cleanup by creation date, active pending session removal, stale pending resume after cleanup

**OAuth Sign-Up**:
A possible future new-account flow that uses an external identity provider instead of password and password confirmation. OAuth Sign-Up follows OAuth Provider Email Requirement, enters Pending OAuth Sign-Up after provider-verified email passes Account Email Conflict checks, still requires a unique case-insensitive Username before the user enters the Home Feed, uses OAuth Username Autofill when a provider-supplied username is available, and the final valid Username becomes the initial display name with typed capitalization preserved. OAuth Sign-Up does not use AnimeX Email OTP Verification; missing provider email or unverified provider email blocks OAuth Sign-Up in MVP. If the OAuth provider email triggers Account Email Conflict, AnimeX blocks OAuth Sign-Up with `Email already in use. Sign in instead.` and does not automatically link the OAuth identity to the existing AnimeX account. If the OAuth provider supplies a profile picture, AnimeX copies and stores it as the user's AnimeX-owned initial User Avatar; if provider avatar import fails or no profile picture is supplied, AnimeX uses the initials-based Default Avatar. Provider profile pictures are an initial seed only, are not hotlinked long term, and do not create ongoing avatar sync. Completing OAuth Sign-Up creates the AnimeX User Record and Auth-Profile Link, enables normal signed-in access, and keeps the OAuth provider account ID linked for later OAuth Sign-In. An OAuth-created account can later create a password through Password Reset if the user requests it.
_Avoid_: Required MVP auth method, password sign-up

**Post-Sign-Out Landing**:
A navigation behavior after a signed-in user signs out. If the current page is public, AnimeX keeps the user on that same page in signed-out mode; if the current page is an Account-Only Surface or otherwise non-public, AnimeX sends the user to the public Home Feed.
_Avoid_: Forced public home from every page, staying on private page after sign-out

**User-Owned Content**:
A Post, Review, or Comment created by a user. User-Owned Content can normally be edited or deleted by its author; after Moderation Removal, the author can delete it but cannot edit it.
_Avoid_: System activity, generated card

**Content Report**:
A signed-in user report against a Post, Review, or Comment. Comment Replies use the same Comment report flow and do not have a separate report type. Content Reports are private moderation signals and do not notify the reported content author by themselves or send Report Outcome Notifications to reporters in MVP. Content Reports require a Report Reason, create a Report Snapshot, belong to a Moderation Case, follow Report Uniqueness, and stay active when reported content is edited or deleted; Completed Anime and Rewatch Completion Activity cards are not reportable; when a Review appears through a Review Activity the report targets the Review source; Blocked Report Access can prevent reporting between blocked users.
_Avoid_: Activity report, user report

**Moderation Case**:
A moderator-facing review grouping for one reported Post, Review, or Comment. A Moderation Case contains one or more Content Reports for the same content item while preserving each report's reporter, Report Reason, and Report Snapshot, and is not visible to normal users; while a Review is under moderation review, its Review Like action, source-level Review Likes, and Review Visible Like Count are hidden from normal user surfaces, including author-facing Review surfaces, so users cannot add Review Likes, but if the case closes without Moderation Removal, those Review Likes and counts return under normal access rules.
_Avoid_: Duplicate queue item, report pile, global takedown

**Moderation Removal**:
A moderator action from a Moderation Case that makes a reported Post, Review, or Comment unavailable to normal users globally; Completed Anime and Rewatch Completion Activity cards are not Moderation Removal targets. Moderation Removal also removes interactions associated with the removed target from normal user surfaces and Profile Counts: a removed feed card hides its Comments, Comment Replies, feed-card Likes, and Comment Likes; a removed Review deletes its source-level Review Like records while preserving only private moderation snapshots of them; a removed Comment hides its Comment Replies and Comment Likes; a removed Comment Reply hides only that reply and its Comment Likes. It prevents author edits but still allows silent author deletion, creates one Moderation Removal Notification for the content author, is separate from Reporter Hide, does not remove Content Reports, Report Snapshots, or the Moderation Case, and cannot be undone in MVP.
_Avoid_: Reporter hide, author deletion, global delete

**Moderation Restore**:
A non-MVP moderator action that would make content available again after Moderation Removal. AnimeX MVP does not include Moderation Restore.
_Avoid_: Appeal restore, undo removal, unremove

**Report Outcome Notification**:
A non-MVP notification that tells a reporter how a Moderation Case was resolved. AnimeX MVP does not send Report Outcome Notifications; reporters only see their Content Report submission result and any Reporter Hide effect.
_Avoid_: Case status notification, moderation result message

**Report Snapshot**:
A private moderation record of the reported content as it existed when the Content Report was created. Report Snapshots preserve report-time text, Post-media copies and display metadata, attached anime metadata when present on the source type, author identity, Reply Tag when present, and any moderation-needed Review Like snapshot if the reported content is a Review; snapshots are not live Like records, do not count in user-visible totals, and are not shown to public users.
_Avoid_: Public revision history, user-visible archive

**Report Uniqueness**:
A rule where one reporting user may have only one active Content Report for the same reported content item. Edits to the reported content do not allow the same reporting user to submit another Content Report for that item, but other users may still report the same content item.
_Avoid_: Duplicate report, report spam, report count

**Report Reason**:
The reason selected for a Content Report. MVP reasons are Spam, Harassment, Spoiler, Inappropriate, and Other; Other requires a short explanation.
_Avoid_: Freeform-only report, activity reason

**Reporter Hide**:
A viewer-specific hide applied when a user submits a Content Report. Reporter Hide immediately hides the reported Post, Review, or Comment from the reporting user only, remains active if the reported content is edited, no longer affects display after the reported content is deleted, and cannot be undone by the reporter in MVP; for a Comment Reply, it hides only that reported Comment Reply and not the original Comment it replied to; for a Review, it also hides the Review Detail Page, review-derived feed surfaces, Anime Review Metrics contribution, and the Review's Visible Like Count for that reporter without deleting the Review Likes for unrelated viewers.
_Avoid_: Global takedown, moderation action

**Manual Hide**:
A non-MVP action where a user hides content without reporting it. AnimeX MVP does not include Manual Hide.
_Avoid_: Hide without report, mute content

**Block**:
A private user safety relationship where one user blocks another user. Block removes existing Follow relationships in both directions, prevents either user from following the other, creates a Blocked Profile State, applies blocked feed, interaction, report, and notification boundaries, and does not create a Content Report.
_Avoid_: Mute, manual hide, automatic report

**Unblock**:
A user action that removes an active Block and ends its Blocked Profile State, Blocked Feed Visibility, Blocked Interaction, Blocked Report Access, Blocked Notification Access, and Blocked Notification Delivery. Unblock does not restore Follow relationships removed by the Block; stored Comments, Likes, and Anime Review Metrics hidden only by the Block return under current access rules, and normal Content Report rules apply again for visible reportable content.
_Avoid_: Restore follow, undo block

**Blocked Users List**:
A private settings list of users the current user has blocked. It lets the blocking user review active Blocks and unblock users later.
_Avoid_: Public block list, moderation queue

**Blocked Profile State**:
The minimal profile surface shown when either side of a Block views the other. It uses neutral unavailable wording for the blocked viewer, explicit block-management wording for the blocking user, and replaces User Profile content while the Block is active.
_Avoid_: Public profile, hidden profile, you are blocked message

**Blocked Feed Visibility**:
A viewer-specific boundary where each side of a Block cannot see the other side's Posts, Reviews, Comments, or Activity in feed surfaces, and those hidden Reviews do not count in Anime Review Metrics for either side. It does not delete the underlying content or hide it from unrelated users.
_Avoid_: Content deletion, global hide

**Blocked Interaction**:
A boundary where either side of a Block cannot add Comments, feed-card Likes, Review Likes, or Comment Likes to the other side's Posts, Reviews, Activity, or Comments, including through direct links or old notifications. Existing Comments, feed-card Likes, Review Likes, and Comment Likes between the blocked users stay stored, are hidden from both sides while the Block is active, and return to normal visibility after Unblock.
_Avoid_: Limited interaction, soft block, automatic deletion

**Blocked Report Access**:
A boundary where either side of a Block cannot create Content Reports against the other side's content while the Block is active. If a direct link or old notification resolves to unavailable content because of the Block, report actions are not shown; after Unblock, visible reportable content can be reported under normal Content Report rules.
_Avoid_: Report bypass, block report, automatic report

**Blocked Notification Access**:
A boundary where old notifications involving a blocked user may remain in notification history, but opening them follows active Block rules. If the Block prevents access, the notification target resolves to unavailable content.
_Avoid_: Notification deletion, notification bypass

**Blocked Notification Delivery**:
A boundary where no new notifications are created between blocked users while a Block is active. It covers notifications caused by Posts, Reviews, Comments, Likes, Follows, and Activity.
_Avoid_: Muted notification, queued notification

**In-App Notification**:
A user-facing app notification delivered inside AnimeX. MVP feed, social, and moderation notification features are in-app only and do not include email or push delivery; Security Email Notices are separate transactional account-safety emails.
_Avoid_: Email notification, push notification, security email notice

**Notification Source Icon**:
The visual source marker shown on an In-App Notification row. User-caused notifications use the actor's User Avatar, while system or moderation notifications use a neutral AnimeX/Ami system icon and never expose reporter identity.
_Avoid_: Reporter avatar, hidden actor avatar

**Notification Target Thumbnail**:
An optional visual target marker shown on an In-App Notification row when it helps identify the target. Anime-related notifications may show an anime cover, Posts with external image media may show that image, and plain comments, likes, follows, or moderation notices do not need a target thumbnail.
_Avoid_: Required notification image, source avatar

**Notification Timestamp**:
A relative time label shown on In-App Notification rows, such as `2m ago`, `1h ago`, or `3d ago`. It supports newest-first ordering in Notification Preview and Notification Page.
_Avoid_: Absolute-only timestamp, hidden timestamp

**Notification Read State**:
The read or unread state of an In-App Notification. Opening the Notification Preview marks its displayed unread notifications read, the Notification Page has a `Mark all as read` action for all current unread notifications, and opening an individual In-App Notification also marks it read even when Notification Target Access resolves to unavailable content.
_Avoid_: Target availability, notification deletion

**Notification Badge**:
A compact unread-count indicator on the signed-in desktop notification icon or signed-in mobile notification header. It reflects the current unread In-App Notification count, updates after Notification Preview marks displayed unread notifications read, is hidden when there are no unread In-App Notifications, and caps the displayed count at `99+`.
_Avoid_: Total notification count, history count

**Notification Preview**:
The compact notification surface opened from the signed-in desktop notification icon or signed-in mobile notification header. It shows up to 50 unread In-App Notifications with Notification Timestamps, newest first, marks those displayed notifications read when opened, shows a `Show more` action to navigate to the Notification Page when more unread notifications remain, and shows an empty state with a history link to the Notification Page when there are no unread notifications.
_Avoid_: Full notification history, notification page

**Notification Page**:
The full notification history surface reached from the Notification Preview's `Show more` action or direct navigation. It loads 50 In-App Notifications with Notification Timestamps by default, newest first, uses a Load More action while older unloaded notifications remain, provides `Mark all as read` for unread notifications, shows unread notifications with subtle visual emphasis, and does not include notification filters in MVP.
_Avoid_: Notification preview, notification popover, notification filters

**Notification Alert**:
A non-MVP interruptive notice, such as a toast, banner, or sound, shown when a new In-App Notification arrives while the user is active. AnimeX MVP does not use Notification Alerts; notification awareness comes from the Notification Badge, Notification Preview, and Notification Page.
_Avoid_: Required toast, notification sound, pop-up banner

**Notification Retention**:
The rule for how long In-App Notifications remain in history. AnimeX MVP does not let users delete or clear notifications manually; a future optional automatic cleanup may remove old notifications.
_Avoid_: Manual notification deletion, clear all notifications

**Notification Target Access**:
The current access check applied when a user opens an In-App Notification. Notifications may remain in history, but their targets follow current Feed Card Visibility, Review Visibility, Feed Card Deletion, Review Deletion, Block, active Moderation Case, Moderation Removal, and Activity Deletion rules; Review Like Notification targets resolve to the Review Detail Page whenever the Review source exists and current Review Visibility allows access, including after restored access or after a Moderation Case closes without Moderation Removal, but resolve to unavailable content while the Review is under moderation review or after Moderation Removal removes the Review and deletes its source-level Review Like records, deleted Review Activity targets can resolve to the Review Detail Page only while the Review source remains accessible, while deleted Review source, Post feed-card, Completed Anime Activity, Rewatch Completion Activity, Activity-card interaction, and feed-card interaction targets resolve to unavailable content.
_Avoid_: Notification bypass, notification deletion

**Follower Activity Notification**:
A short In-App Notification a user may receive when someone they follow creates a Post or Review Activity. It uses concise actor-action wording, includes the anime title when available, is not created for Score changes, Completed Anime activity, Rewatch Completion Activity bumps, or Rewatch Activity Recreation, and remains in history if the Post feed card is later removed by Feed Card Deletion or the Review is later removed by Review Deletion.
_Avoid_: Feed item, long notification

**Account Interaction Notification**:
A short In-App Notification a user receives when another user follows them, comments on their own feed card, likes their own feed card, likes their Review, likes their Comment, replies to their Comment with a Reply Tag, or removes their Comment from a feed card. It is not created for self-actions, passive participation, or Comment Replies where the Reply Tag was removed before posting; like-based Account Interaction Notifications stay in history if the liker later removes the Like, and AnimeX does not create unlike notifications.
_Avoid_: Thread notification, discussion subscription

**Comment Reply Notification**:
A short Account Interaction Notification sent to a Comment author when another user posts a Comment Reply with a Reply Tag pointing to that Comment. It uses concise copy such as `Mika replied to your comment`, is created only at initial posting, is not created when the Reply Tag is removed before posting, and is not created, deleted, or resent by later Comment Reply edits.
_Avoid_: Mention notification, thread subscription

**Review Like Notification**:
A short Account Interaction Notification sent to a Review author when another user adds a source-level Review Like to that Review from any visible Review surface, including after Activity Deletion removed the related Review Activity. It uses concise copy such as `Mika liked your review`, follows Notification Preferences and Blocked Notification Delivery, is not created when users like their own Reviews, and stays in notification history if the liker later removes the Review Like without creating an unlike notification.
_Avoid_: Feed-card like notification, follower activity notification

**Comment Like Notification**:
A short Account Interaction Notification sent to a Comment author when another user adds a Comment Like to that Comment. It uses concise copy such as `Mika liked your comment`, is not created when users like their own Comments, and stays in notification history if the liker later removes the Comment Like without creating an unlike notification.
_Avoid_: Feed card like notification, thread notification

**Comment Removal Notification**:
A short Account Interaction Notification sent to a Comment author when a feed card author deletes that Comment from their own feed card. It may include the feed card author's display name and feed card type, but not the feed card title or anime title; it is not created when users delete their own Comments, when Activity Deletion removes a whole Activity card with its Comments, or when Feed Card Deletion removes a whole feed card with its Comments.
_Avoid_: Moderation notice, report notification

**Moderation Removal Notification**:
A required In-App Notification sent only to the removed content author when Moderation Removal makes their Post, Review, Comment, or Comment Reply unavailable. It uses concise target-specific copy such as `Your post was removed by moderation` or `Your reply was removed by moderation`, opens only an Unavailable Content Notice showing `This content is unavailable`, does not include reporter identity, report count, Moderation Case status, removed content details, or interaction counts, does not notify commenters, repliers, or the original Comment author when a Comment Reply is removed, and cannot be disabled by Notification Preferences.
_Avoid_: Report Outcome Notification, reporter notice, case status notification

**Notification Preference**:
A user setting for controlling optional In-App Notification categories. Users can turn off Follower Activity Notifications separately while keeping Account Interaction Notifications on; Account Interaction Notifications, including Review Like Notifications, Comment Reply Notifications, Comment Like Notifications, and Comment Removal Notifications, are on by default in MVP. Notification Preferences do not disable required Moderation Removal Notifications or Security Email Notices.
_Avoid_: Global mute, email preference

**Notification Deduplication**:
A rule that prevents redundant Account Interaction Notifications for the same recipient. When a Comment Reply with a Reply Tag would also count as a normal Comment on the recipient's feed card, AnimeX sends only the more specific Comment Reply Notification; for like-based notifications, AnimeX creates at most one notification per actor and target even if the actor unlikes and later likes the same feed card, Review, or Comment again.
_Avoid_: Notification merge, notification bundle

**Notification Bundling**:
A non-MVP behavior that would combine notifications from different actors into one row, such as `Mika and 3 others liked your review`. AnimeX MVP keeps different actors as separate In-App Notifications instead of bundling them.
_Avoid_: Notification Deduplication, notification merge

**Blocked Search Visibility**:
A search behavior where users in a Block still appear in each other's user search results and search autocomplete suggestions. Selecting a blocked user from search still follows active Block rules and may show a Blocked Profile State.
_Avoid_: Search hide, autocomplete suppression

**User Search Matching**:
A search behavior for user search and autocomplete. Username uniqueness uses case-insensitive matching, and user search and autocomplete match typed queries case-insensitively while showing preserved username capitalization.
_Avoid_: Username uniqueness, exact-case-only search

**Edited Indicator**:
A visible `edited` text marker showing that User-Owned Content has changed after it was created. Posts, Reviews, and Comments show `edited` without an edited time, public revision history, new activity, or feed bump; Feed Card Visibility changes do not show `edited`.
_Avoid_: Silent content edit, edited timestamp, revision history, feed bump, visibility marker

**Activity Deletion**:
A user action that removes one generated Activity card, including Review Activity, from feeds and profile activity surfaces. Activity Deletion removes the Activity card's Comments, Comment Replies, feed-card Likes, and Comment Likes without Comment Removal Notifications, but does not delete source content, source state, source-level Review Likes, Anime Review Metrics contribution, prior notifications created by those interactions, or create an anime-page marker; deleted Activity cards have no manual restore option in MVP. Ordinary Review Edits, Score changes, and re-completion do not recreate deleted Activity cards, while a later Rewatched completion can still create or recreate the separate Rewatch Completion Activity. Deleting a Rewatch Completion Activity does not delete or hide the separate Completed Anime activity.
_Avoid_: Anime list deletion, source deletion

**Feed Card Deletion**:
A user action that removes a feed card from feeds. Feed Card Deletion makes the card disappear completely, leaves no visible placeholder, removes the card's Comments, Comment Replies, feed-card Likes, and Comment Likes without Comment Removal Notifications, and keeps prior notifications created by the card or its interactions in history.
_Avoid_: Deleted-card placeholder, orphaned comments, orphaned likes

**Comment Deletion**:
A user action that removes a Comment and its Comment Likes. Comment authors can delete their own Comments, and feed card authors can delete Comments on their own feed cards; deleted Comments leave no visible placeholder, do not remove prior notifications, and do not delete existing Comment Replies.
_Avoid_: Content report, feed card deletion, deleted-comment placeholder

**Review Rating**:
A numeric value required by a Review. Review Ratings use a 0-100 scale, allow up to one decimal place, and start at 50 by default.
_Avoid_: Score, reaction, rank

**Anime Review Metrics**:
Viewer-specific anime-detail-page summary numbers derived from Reviews for one anime, such as visible review count and average Review Rating. Anime Review Metrics use the Review source's current Review Rating rather than any historical Review Activity value, include only Reviews visible to the current viewer under Review Visibility, including the viewer's own Private Reviews; visible review count may show `0`, but average Review Rating is absent rather than `0` when no Reviews are visible. When present, average Review Rating is rounded to the nearest one decimal place, including trailing `.0` for whole-number averages. They update when Review Visibility changes through Visibility Change or Bulk Visibility Change or when Review Rating changes through Review Edit, exclude Reviews hidden from that viewer by Reporter Hide or Block rules, exclude Reviews globally hidden by Moderation Removal and Review sources removed by Review Deletion; Block-only exclusions return after Unblock only when current access allows.
_Avoid_: Profile anime stats, Score average, moderation stats

**Score**:
A numeric value a user gives to an anime outside a Review. Scores use a 0-10 scale, allow up to one decimal place, start empty until the user sets one, use the label `Score` across AnimeX, act as the current anime-detail-page source of truth wherever shown, and never create a standalone Activity.
_Avoid_: Anime Rating, Review Rating, reaction, rank

**Score Addition**:
A user action that sets a Score where none existed. Score Addition updates the anime list entry and can add the Score to an existing Completed Anime or Rewatch Completion Activity card, but does not create a standalone Activity or feed bump.
_Avoid_: Score activity, rating post

**Score Edit**:
A change to an existing Score. Score Edits update the anime list entry and any existing Completed Anime or Rewatch Completion Activity card that displays the Score, without creating a new Activity or feed bump.
_Avoid_: New score activity, feed repost

**Score Removal**:
A user action that clears a Score from an anime list entry. Score Removal removes the Score from any existing Completed Anime or Rewatch Completion Activity card, but does not delete that card or create a feed bump.
_Avoid_: Activity Deletion, Moderation Removal, Score Edit

**Score Restoration**:
A user action that adds a Score back after Score Removal. If a Completed Anime or Rewatch Completion Activity card still exists, Score Restoration silently restores the Score on that card without new Activity or feed bump; Activity Deletion still suppresses deleted Activity cards.
_Avoid_: New score activity, feed repost, card recreation

**Completed Anime**:
A status where the user has marked an anime as fully watched. Completed Anime creates feed activity, includes the current Score when Score is available, and can coexist with the user's Rewatch Completion Activity for the same anime.
_Avoid_: Finished media, watched item

**Completion Reversal**:
A change from Completed Anime back to another Anime Status. A Completion Reversal updates the user's Anime Status quietly, keeps any existing original completion activity, and does not recreate a deleted completion activity.
_Avoid_: Activity removal, correction post

**Rewatch Completion Activity**:
A feed-visible Activity created when a user's Anime Status changes to Rewatched, even if the user previously removed the Completed Anime activity for the same anime. There is at most one Rewatch Completion Activity per anime per user; it can coexist with the user's Completed Anime activity for the same anime, and later Rewatched completions bump the same rewatch card, keep its current Feed Card Visibility, update its timestamp, and include the current Score when Score is available.
_Avoid_: Duplicate completion activity, automatic rewatch card

**Rewatch Activity Recreation**:
The creation of a new Rewatch Completion Activity after the author previously removed that anime's rewatch card through Activity Deletion. Rewatch Activity Recreation happens only when the user completes another rewatch, uses the latest rewatch timestamp, inherits the current Account-Level Default Visibility, and does not restore Comments, Comment Replies, feed-card Likes, or Comment Likes removed with the old card.
_Avoid_: Score recreation, ordinary re-completion, interaction restore, old visibility restore

**Rewatch Count**:
The owner-only number of times a user has completed a rewatch for one anime. Rewatch Count appears only on the owner's anime detail page, is not shown on feed cards, and is not visible to other users.
_Avoid_: Public rewatch count, duplicate cards, completion count, feed badge

**Rewatch History**:
The owner-only list of times a user completed a rewatch for one anime. Rewatch History belongs on the anime detail page, is separate from the single Rewatch Completion Activity shown in feeds, and is not visible to other users.
_Avoid_: Public rewatch log, feed duplicates, activity thread

**Rewatch Entry Removal**:
An owner-only correction that removes the latest Rewatch History entry for one anime. MVP does not allow removing older Rewatch History entries directly; when another entry remains, Rewatch Entry Removal updates Rewatch Count, rolls the Rewatch Completion Activity timestamp back, keeps the current Score display if Score is available, keeps its Comments, Comment Replies, feed-card Likes, and Comment Likes, and moves the card to the rolled-back timestamp position in feeds without notifications or a new bump. When no rewatch entries remain, it removes the Rewatch Completion Activity and those interactions without Comment Removal Notifications; prior interaction notifications remain in history but resolve to unavailable content.
_Avoid_: Full history editing, arbitrary entry removal, public deletion, orphaned rewatch card

**Anime Status**:
A user's list state for an anime, such as Watching, Planned, Dropped, Completed Anime, or Rewatched. Completed Anime and Rewatched create feed activity; Watching, Planned, and Dropped update the user's list and profile stats without creating feed activity.
_Avoid_: Progress note, feed status

**Feed Card Visibility**:
The audience allowed to see a feed card. Visibility levels are Public, Followers only, and Private; new feed cards use the user's account-level default visibility unless the creation surface allows a per-card choice, and users can change visibility per card after creation. Changing visibility updates access silently without an Edited Indicator or feed bump.
_Avoid_: Privacy mode, sharing status

**Account-Level Default Visibility**:
A user's chosen Feed Card Visibility for newly created feed cards. New accounts start with Private as the Account-Level Default Visibility. It does not update existing Posts or Activity cards; those require a Visibility Change or Bulk Visibility Change.
_Avoid_: Privacy mode, private account, retroactive visibility

**Creation Visibility Selector**:
An author-facing visibility choice shown before creating a user-authored Post or Review. It displays the current Feed Card Visibility, defaults to the user's Account-Level Default Visibility, and can be changed before publishing; for new accounts, that default is Private.
_Avoid_: Visibility Indicator, generated activity source selector

**Privacy Settings**:
A Settings area for account-level visibility controls. Account-Level Default Visibility and Bulk Visibility Change live in Privacy Settings, not in the Feed Card Menu.
_Avoid_: Feed card menu, private account mode

**Bulk Visibility Change**:
A deliberate author action in Privacy Settings that changes the Feed Card Visibility of all of that user's active existing Posts, all active existing Activity cards, or both selected groups. Activity cards include active Review Activity, active Completed Anime activity, and active Rewatch Completion Activity; for active Review Activity, the change updates Review Visibility source-wide, including Review Detail Page and anime-page review surfaces. Bulk Visibility Change follows Visibility Change rules for stored Comments and Likes, is separate from Account-Level Default Visibility, does not allow selecting individual feed cards inside the chosen group, excludes Feed Card Deletion, Activity Deletion, and Moderation Removal targets, requires Bulk Visibility Confirmation, has no undo action in MVP, and updates access silently without an Edited Indicator, feed bump, or notifications.
_Avoid_: Automatic privacy change, default visibility update, account privacy mode, per-card bulk selection, undo restore

**Bulk Visibility Confirmation**:
A required review step before a Bulk Visibility Change applies. It identifies the selected groups, target Feed Card Visibility, separate affected counts for Posts and Activity cards, and total affected count; affected count is feed-card-based, so a Completed Anime card and Rewatch Completion Activity for the same anime count separately when both change, but only changing cards count because already-matching feed cards are no-ops.
_Avoid_: Silent bulk update, undo prompt

**Visibility Change**:
An author's update to a feed card's Feed Card Visibility after creation. A Visibility Change keeps existing Comments and Likes stored but hidden when the card becomes Private, restores them under the new visibility when the card becomes Public or Followers only, and keeps prior notifications in history; Notification Target Access follows the latest visibility, so restored access can make an old notification usable again.
_Avoid_: Content edit, feed repost, deletion

**Visibility Indicator**:
An author-only passive feed card icon showing that card's Feed Card Visibility. Other viewers do not see Visibility Indicators on feed cards, and authors change visibility through the Feed Card Menu instead of the indicator.
_Avoid_: Public audience badge, viewer-facing privacy label, visibility toggle

**Feed Card Menu**:
A per-card action menu for secondary feed card actions. Authors see author actions such as edit, delete, and Visibility Change where allowed; for generated Activity cards, author actions are limited to Activity Deletion and Visibility Change.
_Avoid_: Header toggle, visible privacy control

**Activity Visibility**:
The Feed Card Visibility assigned to a generated Activity. New Activity cards and Rewatch Activity Recreation silently inherit the user's current account-level default visibility when created, even if another Activity card for the same anime already exists; generated Activity source actions do not show a Creation Visibility Selector, but authors can change visibility after the Activity card exists; existing Activity cards keep their current Feed Card Visibility when bumped, so a Private bumped Activity stays visible only to its author and a Followers only bumped Activity uses current Follow relationships.
_Avoid_: Source action visibility selector, forced public activity

**Followers Only Visibility**:
A Feed Card Visibility level resolved using the viewer's current Follow relationship to the author. New followers can see older or bumped Followers only cards if current visibility, Block rules, and other access rules allow it; users who unfollow immediately lose access to Followers only cards.
_Avoid_: Frozen follower snapshot, historical audience

**Home Feed**:
The default home page feed view. For signed-in users, it is hybrid: followed users' visible activity appears first, with public activity from the wider community blended in; for signed-out users, it is a single public read-only feed without Following or Global feed tabs.
_Avoid_: Timeline, wall

**Home Feed Visual Direction**:
The locked visual direction for the AnimeX Home Feed. Desktop follows `docs/visual/home/home-desktop-feed.png`: Proposal 3 poster-forward theme as the base, Proposal 1 `AnimeX` logo/header direction, two-column layout with no left column, Seasonal Anime above the feed, central feed cards below, and a right utility column. The right column includes anime-list utility surfaces and Trending, but no profile picture, follower count, following count, like stats, average rating, or episodes watched. Mobile follows `docs/visual/home/home-mobile-feed.png`: the same dark poster-forward theme stacked into a single column with top header, Seasonal Anime first, feed tabs, composer, feed cards, mobile utility modules, and bottom navigation.
_Avoid_: Three-column Home Feed, left utility rail, profile-card sidebar, follower stats, following stats, like stats, average rating, episodes watched

**Following Feed**:
A signed-in feed view showing visible activity from users the viewer follows.
_Avoid_: Followers feed

**Global Feed**:
A signed-in feed view showing public activity from the wider community.
_Avoid_: Public timeline

**Follow**:
A one-way relationship where one user chooses to receive another user's visible activity in the Following Feed. Following is open by default, so public accounts can be followed without approval; the followed user gains a follower.
_Avoid_: Friend, subscribe

**Private Account Mode**:
A non-MVP account setting that would require follower approval or make all account content relationship-gated. AnimeX MVP does not include private account mode. Phase 7 Profile Visibility may hide profile modules from non-owners, but it does not require follower approval, change Account-Level Default Visibility, or change per-record access.
_Avoid_: Locked account

**Profile Visibility**:
A User Profile setting separate from Account-Level Default Visibility. Phase 7 supports Public and Private. Existing and new profiles default to Public. A Private profile shows its banner, avatar, display name, username, bio, and a privacy notice to another signed-in user while hiding stats, favorites, Reviews, and Activity; the owner always sees the full profile. Followers Profile Visibility is deferred to Phase 9.
_Avoid_: Content default visibility, private account mode, Followers profile before Phase 9

**User Profile**:
A signed-in, viewer-filtered profile surface at `/users/:username`. It shows the profile header, bio, list-progress stats, latest 10 favorited anime, and Activity, Reviews, and Favorites tabs controlled by the `tab` query; Activity is default. Profile Visibility may reduce the surface to its header and privacy notice. Deleted feed cards and deleted Activity cards do not appear in profile Activity, and deleted Review Activity is not backfilled there by a Review source entry. Phase 7 omits all social controls and counts.
_Avoid_: Public Profile, User page

**User Profile Visual Direction**:
The locked final-state visual direction for AnimeX User Profile pages. Desktop and mobile follow `docs/visual/user-profile/user-profile-desktop-mobile.png`. Phase 7 keeps the poster-forward dark theme, wide cover, circular User Avatar, display name, username, bio, Edit Profile for the owner, Activity/Reviews/Favorites tabs, list-progress stats, Latest Favorites, and viewer-allowed Activity. It removes Follow, follower/following counts, Review Likes/counts, Favorite Genres, Anime List tab, and social footers until their owning phases.
_Avoid_: Public Profile wording, top-level Stats page, Community nav, like-total profile stats, liked-user preview, average rating, episodes watched

**Reviews Tab**:
A User Profile section that lists visible Reviews as Review Cards. The Reviews tab is source-backed rather than activity-backed, so it may show a Review when Review Visibility allows even if the related Review Activity feed card was deleted.
_Avoid_: Profile activity backfill, Review Activity tab

**Profile Counts**:
Phase 9 user-visible social totals shown on a User Profile, such as visible Posts, Reviews, Comments, and Likes if AnimeX chooses to show them. Profile Counts are absent through Phase 8. When active, they exclude content and interactions hidden by an active Moderation Case or Moderation Removal; private moderation records do not contribute to normal user-visible totals.
_Avoid_: Moderation stats, audit counts

**User Avatar**:
A circular visual identity shown beside a user's display name in profiles, feeds, comments, and notifications. Users may upload their own User Avatar or choose a Preset Avatar. OAuth Sign-Up may set the initial User Avatar by copying and storing the OAuth provider profile picture when one is available, but later provider picture changes or provider image URL breakage do not automatically update it. If no uploaded, selected, or provider-supplied avatar exists, AnimeX shows an initials-based Default Avatar.
_Avoid_: Profile picture only, mascot fallback

**Default Avatar**:
An initials-based User Avatar generated from the user's display name, falling back to the username initial when needed. During Simplified Sign-Up, the username is the initial display name, so the Default Avatar uses username initials. During OAuth Sign-Up, the Default Avatar is used when the provider does not supply a profile picture or OAuth Avatar Import Failure occurs. The Default Avatar is the MVP fallback for missing uploaded, selected, or provider-supplied avatars.
_Avoid_: Blank avatar, mascot avatar

**Preset Avatar**:
A built-in User Avatar option a user may select instead of uploading their own avatar. MVP Preset Avatars are the three approved Ami variants, and Ami-based Preset Avatars must match the original Ami reference for hair clip, hair style, outfit, scarf, face shape, and notebook design while allowing pose changes.
_Avoid_: Default Avatar, uploaded avatar

**Mascot Avatar**:
A brand-owned circular avatar featuring Ami, the AnimeX chibi mascot. The right-side Ami concept is the primary reference; future Mascot Avatars may change pose or props, but must compare against the original and keep Ami's character style consistent.
_Avoid_: Default Avatar, user initials

**Ami Notebook**:
Ami's consistent dark navy spiral notebook with the same cover shape, scale, cyan and coral square marks, and small star mark. Ami may hold it in different poses, but the notebook design should not drift between Mascot Avatars or Ami-based Preset Avatars.
_Avoid_: Generic notebook, redesigned prop

**Site Logo**:
The AnimeX brand mark used for navigation, favicon, and app identity. The primary Site Logo is a horizontal Ami Notebook and coral star mark paired with the `AnimeX` wordmark; the compact icon uses only the notebook-star mark, while the badge-style logo is decorative.
_Avoid_: Unrelated logo, mascot portrait only, badge as primary nav logo

**Site Navigation**:
The primary way users move between AnimeX areas such as Home, Discover, search, creation, notifications, profile, and settings. Desktop Site Navigation uses a top navigation layout with Home, Discover, a search icon, notification icon, and profile/settings entry for signed-in users; the desktop search icon opens Quick Search, and desktop navigation does not show `Community` or `Stats` in MVP. Desktop Post Create stays near the Home Feed composer entry rather than as a global header label. Signed-out desktop navigation hides account-only controls, including the notification icon and Post Create entry, and shows `Sign in`; signed-in mobile Site Navigation uses bottom tabs for Home, Discover, Search, Create, and Profile, where Search opens the mobile Quick Search drawer, Create opens the Post Composer, and Notifications stay in the mobile header; signed-out mobile navigation keeps Search but omits User results, hides Create and Profile tabs, hides the notification icon, and shows `Sign in` in the header.
_Avoid_: Desktop sidebar, Community nav before community features exist, top-level Stats page in MVP

**Discover**:
A browse destination for finding anime through trending anime, seasonal anime, genres, and recommendations. Discover is separate from Quick Search, and its design should reserve room for future Manga lists.
_Avoid_: Search page, quick search overlay

**Discover Visual Direction**:
The locked visual direction for the AnimeX Discover page. Desktop follows `docs/visual/discover/discover-desktop.png`; mobile follows `docs/visual/discover/discover-mobile.png`. Discover uses the same poster-forward dark theme, AnimeX logo/header direction, fixed poster-frame image system, teal/coral accents, and navigation rules as the Home Feed. It is a browse page with Trending Anime, Seasonal Anime, Genres, Recommendations, and supporting right-column or stacked discovery modules. It does not show feed cards, Post Composer, profile utility stats, or active Manga lists; Manga may appear only as a muted future placeholder.
_Avoid_: Feed page, post composer, active Manga lists, profile utility stats, Quick Search clone

**Discover Anime Population**:
The MVP Discover page uses AnimeX-managed list caches populated from the AniList GraphQL API. When a user opens Discover, AnimeX reads cached Discover sections such as Trending Anime, Seasonal Anime, Recommendations, and the local Genres list from Convex; Manga remains a muted future placeholder. If a list cache is missing or expired, a server-side fetch calls AniList list queries, normalizes lightweight anime summaries by provider `id`, ensures AnimeX catalog identity, stores the section anime IDs with `fetchedAt` and `expiresAt`, and returns opaque `publicId` rows to the browser. Discover cards do not hydrate full anime details for every anime; they use public display fields while server cache rows retain provider IDs. Full description, studio, staff, characters, relations, trailer, and external links load later when the user opens the publicId anime detail route. MVP refresh cadence is a few hours for Trending Anime, daily for Seasonal Anime, daily for Recommendations, and local/static for Genres. If AniList refresh fails for a missing or expired section, the section shows a clear metadata loading error instead of fake data or silent substitution.
_Avoid_: Full detail hydration for every Discover card, rendering raw AniList responses directly, fake Discover data after API failure, active Manga lists in MVP

**Anime Detail Visual Direction**:
The locked visual direction for AnimeX anime detail pages. Desktop follows `docs/visual/anime-details/anime-details-desktop-frieren.png`; mobile follows `docs/visual/anime-details/anime-details-mobile-frieren.png`. Anime detail pages use the same poster-forward dark theme, AnimeX logo/header direction, fixed poster-frame image system, teal/coral accents, and navigation rules as Home and Discover, but the header omits `Community` in MVP. The Overview tab is selected by default and contains anime metadata only, while Reviews, Characters, and Staff belong in their own tabs. User anime controls stay once under the synopsis, including Status, Score, favorite, Review Button, and Rewatch History when available; the page does not duplicate this as a right-column `My Anime` card. The right column or stacked mobile modules use non-duplicate discovery/support content such as Related Anime, Recommendations, Trailer, and External Links.
_Avoid_: Overview review cards, top characters, right-column character list, duplicate My Anime card, Community nav

**Quick Search**:
A responsive search-triggered overlay for direct lookup across Anime, Characters, Staff, and signed-in Users, with Manga reserved for future Manga lists. Desktop Quick Search opens from Site Navigation as a modal; mobile Quick Search opens from the bottom Search tab as a drawer. Both use compact live groups capped at five results, omit category-selection controls, and use chevrons instead of inline add or Follow actions. Signed-out search omits Users. View all Anime routes to `/discover` with the query; View all Characters, Staff, and Users use matching dedicated result pages.
_Avoid_: Discover, full browse page, AniList clone

**Quick Search Visual Direction**:
The locked Quick Search visual direction follows `docs/visual/quick-search/quick-search-modal.png` for the desktop dimmed modal shell and `docs/visual/quick-search/quick-search-mobile-drawer.png` for mobile. Desktop keeps its large top search input but removes category-selection controls. Mobile customizes the shadcn Base UI Drawer at `https://ui.shadcn.com/docs/components/base/drawer` with a swipe handle, dimmed page, independently scrollable results, and a large search field pinned above the safe area in the drawer footer. Both show compact Anime, Character, Staff, and eligible User groups with View all links and right chevrons. Manga stays future-only until Manga lists are first-class.
_Avoid_: Discover page clone, AniList column clone, active Manga results in MVP, full search page as default interaction

**AniList Metadata Flow**:
The MVP anime metadata flow uses the AniList GraphQL API behind server-only provider/cache modules. Search requests return candidate anime results for Quick Search, Discover linking, and anime detail entry points; AnimeX ensures a catalog entity and returns opaque `publicId` to browser contracts. AniList numeric `id` remains canonical external provider identity and cache key, never public route or durable client identity. Search rank is not treated as source of truth because queries can return specials, shorts, or related entries before the main series. Stored cache metadata may include provider `id`, MAL `idMal` when available, titles, format, status, season, season year, episodes, duration, genres, description, studio, cover image, banner image, and AniList URL. AniList API errors should fail clearly at the metadata operation boundary rather than silently substituting another anime.
_Avoid_: Search-first match as canonical anime, title-only anime records, silent metadata fallback, wrong related special as main anime

**Metadata Image Proxy**:
An optional future infrastructure feature for hiding upstream metadata-image URLs behind provider-neutral AnimeX routes. Public image URLs use `/media/$entity/$id/$variant?v=$version`, where supported entities are Anime, Character, and Staff; variants include cover, banner, and portrait where applicable. The version is derived from the stored upstream source so a source change creates a new cache key. Upstream URLs remain server-only in Convex metadata and are resolved through indexed internal reads; image bytes are not stored in Convex, Convex actions are not used, and an image request never triggers AniList GraphQL. Metadata TTLs remain independent from image caching. Image responses use a 24-hour browser cache, 30-day shared CDN or reverse-proxy cache, and 7-day stale-while-revalidate window without stale-if-error. The TanStack Start server route accepts only validated entity, ID, variant, and version values, fetches only stored allowlisted HTTPS image hosts, revalidates redirects, bounds response type and size, and fails clearly when the source is missing or invalid. This contract can use Vercel CDN headers or an equivalent VPS Nginx/Caddy cache. It does not proxy Post or Review external media and is not active in MVP.
_Avoid_: Provider name in public route, raw source URL query parameter, arbitrary open proxy, AniList GraphQL call per image, image bytes in Convex, Convex action, Post-media proxy

**Favorite Anime**:
Anime a user marks as a favorite. The User Profile previews up to 10 latest favorited anime and offers a see more option to view the full favorite anime list.
_Avoid_: Top anime, ranked favorites

**Anime Stats**:
Personal anime-list summary shown on a user's profile. Phase 7 Anime Stats include completed, watching, planned, and dropped counts. They exclude On Hold, Favorite Genres, average rating, and episodes watched.
_Avoid_: Global anime stats, rating summary, watch time

**Image Attachment**:
Legacy Post-media term. Current Posts use one optional external HTTPS image/video media item; AnimeX performs no file upload, compression, or first-party Post media storage during normal Post creation. Keep this term only when referring to the historical migration or future moderation snapshot copies.
_Avoid_: Gallery item, media blob

**Comment**:
A short text-only response created on a feed card. Comments inherit the feed card's visibility, can receive Comment Likes, may be created as flat Comment Replies by signed-in users, and can be read by signed-out users on visible public feed cards.
_Avoid_: Review, post

**Visible Comment Count**:
The comment total shown to a viewer for a feed card. Signed-out users can see the Visible Comment Count on public feed cards and open the comment list to read visible Comments, but cannot create Comments or Comment Replies.
_Avoid_: Raw comment count, hidden comment total

**Comment Reply**:
A Comment created by replying to another Comment. Comment Replies stay in the same flat comment list as other Comments, do not create nested threads, use the same Content Report flow as Comments, remain visible if the original Comment is deleted, are hidden from normal user surfaces if the original Comment receives Moderation Removal, and do not hide the original Comment if the Comment Reply itself receives Moderation Removal.
_Avoid_: Nested reply, subthread, direct message

**Reply Tag**:
A removable label on a Comment Reply that names the original Comment author being replied to. Reply Tags are scoped to Comment Replies, are optional before posting, trigger Comment Reply Notifications when present at initial posting, are not general Mention support, and are removed if the original Comment is deleted.
_Avoid_: Mention, ping, user tag

**Like**:
A positive reaction that a signed-in user can add to or remove from a feed card, Review source, or Comment, including their own Posts, Reviews, Activity cards, and Comments. Feed-card Likes belong to feed cards, Review Likes belong to Review sources and appear on visible Review Cards and Review Detail Pages, and Comment Likes belong to Comments; for signed-in viewers, the Like action remains visible on visible content even when the Visible Like Count is hidden.
_Avoid_: Rating, score

**Comment Like**:
A Like added to a Comment. Comment Likes are separate from the parent feed card's Likes, inherit the parent Comment's visibility, use the same Visible Like Count behavior as feed-card Likes, do not expose liked-user previews, and disappear when the Comment or feed card is deleted.
_Avoid_: Reply reaction, comment rating

**Visible Like Count**:
The label-free like total shown to a viewer for a feed card, Review source, or Comment. It counts only Likes visible to that viewer, excludes Likes hidden by Reporter Hide, Block rules, an active Moderation Case, Moderation Removal, or content visibility, is not shown when the total is zero, uses compact `k` notation with one decimal when needed at 1000 and above, and does not open a liked-user preview; viewer-specific hides do not delete underlying Likes or change counts for unrelated viewers.
_Avoid_: Raw like count, global reaction total, like label

**Liked Users Preview**:
A non-MVP surface that would show which users liked a feed card, Review source, or Comment. AnimeX does not expose Liked Users Preview or Likes Lists in MVP; users see only the Like action and the Visible Like Count when nonzero.
_Avoid_: Likes List, `Liked by` modal, liker avatars

**Mention**:
A non-MVP interaction where a user freely tags another user inside a Post or Comment. AnimeX MVP does not include general `@mention` parsing, mention autocomplete, or mention notifications inside Posts or Comments; Reply Tags are a separate scoped affordance for Comment Replies.
_Avoid_: Tag, ping

**Direct Message**:
A non-MVP private conversation between users. AnimeX MVP does not include Direct Messages; user communication happens through feed cards, text-only Comments, and Comment Replies.
_Avoid_: DM, private chat, inbox message

**Spoiler**:
A warning on a Post or Review. A Post spoiler covers its body text and external media until revealed. Review-level `containsSpoiler` is warning metadata only: Summary stays visible, while validated rich-text spoiler blocks reveal independently. Safe metadata, such as author, anime title, and timestamp, remains visible.
_Avoid_: Content warning

## Example Dialogue

Developer: Should changing an avatar create an activity?
Domain Expert: No. Activity means reviews, Completed Anime, and Rewatch Completion Activity.

Developer: If a user adds a Score without changing Anime Status, does that create activity?
Domain Expert: No. Score alone never creates an Activity.

Developer: If a user completes or rewatches an anime while a Score is available, what happens?
Domain Expert: AnimeX creates the Completed Anime or Rewatch Completion Activity card and includes the current Score on that card.

Developer: Does editing an existing Score create a new feed activity?
Domain Expert: No. Score Edits update the user's anime list entry quietly and can update Score shown on an existing completion or rewatch Activity card.

Developer: If a user changes the Score after a completion or rewatch Activity card exists, what happens?
Domain Expert: The Score Edit silently updates the Score shown on the existing Activity card without creating a new activity or feed bump.

Developer: Does a Completed Anime card show the Score from the completion date or the user's current Score?
Domain Expert: It shows the current Score from the anime detail page because Score is not a historical Activity snapshot.

Developer: If a user removes the Score after a completion or rewatch Activity card exists, what happens?
Domain Expert: Score Removal removes the Score from that Activity card, but the completion or rewatch card remains.

Developer: If a completed-anime or rewatch Activity card no longer shows Score, then the user scores the anime again, what happens?
Domain Expert: Score Restoration silently adds the Score back to the existing Activity card without creating new activity or a feed bump, unless Activity Deletion removed that card.

Developer: Do Watching, Planned, or Dropped status changes create feed activity?
Domain Expert: No. Completed Anime and Rewatched create feed activity. Watching, Planned, and Dropped update the list and profile stats quietly.

Developer: What happens if a user changes Completed Anime back to another Anime Status?
Domain Expert: That is a Completion Reversal. The Anime Status updates quietly, the original completion activity stays, and no new feed activity is created.

Developer: If a user marks the same anime Completed Anime again later, does AnimeX create another completion activity?
Domain Expert: No. If the original completion activity already exists, AnimeX does not create a duplicate completion activity.

Developer: If the user already has a Completed Anime card and later marks the same anime Rewatched, should both cards exist?
Domain Expert: Yes. The Completed Anime activity and the single Rewatch Completion Activity can coexist because they represent different milestones; both show the current Score when available.

Developer: Does the new Rewatch Completion Activity copy visibility from the existing Completed Anime card?
Domain Expert: No. It uses the user's current Account-Level Default Visibility when created, and each card can have its own Visibility Change after it exists.

Developer: If a user deletes a completed-anime Activity card, then later marks the same anime Completed Anime again, is the card recreated?
Domain Expert: No. Activity Deletion suppresses that completed-anime Activity card for ordinary Anime Status toggles.

Developer: If a user deletes the Completed Anime card, then later marks the same anime Rewatched, can AnimeX create or use Rewatch Completion Activity?
Domain Expert: Yes. The deleted Completed Anime card suppresses only that completed milestone card; Rewatch Completion Activity follows the normal rewatch rules because it is a separate milestone.

Developer: If a user deletes the Rewatch Completion Activity, does the Completed Anime card stay?
Domain Expert: Yes. Activity Deletion is per card; deleting the rewatch milestone card does not delete or hide the separate completed milestone card.

Developer: If a user deletes a completion or rewatch Activity card, then later changes Score, is the card recreated?
Domain Expert: No. Activity Deletion suppresses that Activity card for ordinary Score changes.

Developer: If a user changes Anime Status to Rewatched, does AnimeX create a feed card?
Domain Expert: Yes. AnimeX creates a Rewatch Completion Activity and includes Score when Score is available.

Developer: If the user later rewatches the same anime again, does AnimeX create another rewatch card?
Domain Expert: No. AnimeX keeps one Rewatch Completion Activity per anime per user, bumps that card, and updates its timestamp; Rewatch Count updates only on the anime detail page.

Developer: If a rewatch bumps an existing Rewatch Completion Activity, does it reuse the account-level default visibility?
Domain Expert: No. The existing card keeps its current Feed Card Visibility; Account-Level Default Visibility applies only when a card is created or recreated.

Developer: If the existing Rewatch Completion Activity is Private, does a later rewatch bump make it visible to others?
Domain Expert: No. The card stays Private; the bump only updates its timestamp inside surfaces where the author can see it.

Developer: If the existing Rewatch Completion Activity is Followers only, does a later rewatch bump freeze the audience?
Domain Expert: No. Followers only uses current Follow relationships, so new followers can see the bumped card and users who unfollow lose access.

Developer: What does the bumped rewatch card say?
Domain Expert: Use simple Generated Activity Text such as `Mika rewatched Frieren`. Do not show Rewatch Count, `again`, or a history hint on the feed card.

Developer: If the user deleted the Rewatch Completion Activity before rewatching again, what happens?
Domain Expert: AnimeX uses Rewatch Activity Recreation to create the rewatch feed card again with the latest rewatch timestamp.

Developer: Does Rewatch Activity Recreation restore the deleted card's old visibility?
Domain Expert: No. It uses the user's current Account-Level Default Visibility, like a newly generated Activity card.

Developer: Where does the full rewatch information live?
Domain Expert: Owner-only Rewatch Count and Rewatch History live on the anime detail page; the feed only shows the single Rewatch Completion Activity.

Developer: Can the owner remove a mistaken Rewatch History entry?
Domain Expert: Yes. Rewatch Entry Removal lets the owner remove only the latest Rewatch History entry in MVP and updates Rewatch Count.

Developer: What happens to the Rewatch Completion Activity after Rewatch Entry Removal?
Domain Expert: If another Rewatch History entry remains, the Activity timestamp rolls back to that latest remaining rewatch. If no rewatch entries remain, the Rewatch Completion Activity is removed.

Developer: If Rewatch Entry Removal only rolls the rewatch card timestamp back, what happens to comments and likes?
Domain Expert: They stay because the Rewatch Completion Activity still exists.

Developer: Does the rollback keep the card in its old feed position?
Domain Expert: No. The card moves to the rolled-back timestamp position in feeds, but the change is silent and does not create notifications or a new bump.

Developer: After rollback, does the rewatch card show the Score from the old rewatch date or the user's current Score?
Domain Expert: It shows the current Score from the anime detail page because Score is not a historical Activity snapshot.

Developer: If Rewatch Entry Removal removes the rewatch card, what happens to comments and likes?
Domain Expert: The card's Comments, Comment Replies, feed-card Likes, and Comment Likes are removed silently without Comment Removal Notifications. Prior interaction notifications remain in history and resolve to unavailable content.

Developer: Are Reviews, Posts, and generated Activity cards private by default?
Domain Expert: Yes for new accounts. New accounts use Private as the account-level default, and new feed cards inherit the user's account-level default unless a creation surface allows a per-card choice; Score follows the anime list entry or Activity card where it appears.

Developer: Should the home feed show only people the user follows?
Domain Expert: No. The default home feed is hybrid, with followed users prioritized and public community activity included for discovery.

Developer: Which feed views does AnimeX have?
Domain Expert: AnimeX has Home, Following, and Global feed views. It has Follow and Unfollow behavior, but no Followers feed view.

Developer: Do signed-out users see Home, Following, and Global feed tabs?
Domain Expert: No. Signed-out users only see the public read-only Home Feed; Following and Global feed tabs are signed-in surfaces.

Developer: Do users need approval before following another user?
Domain Expert: No. Following is open by default. The UI should make clear that public accounts can be followed without approval.

Developer: Should short text posts exist separately from reviews and activities?
Domain Expert: Yes. They are called Posts, and each may include zero or one external HTTPS image/video media item. AnimeX does not upload or compress Post media; Post anime attachment remains optional backlog.

Developer: Does creating a review create activity?
Domain Expert: Yes. Creating a review creates one combined Review Activity card that includes the rating.

Developer: Can users edit or delete their own posts, reviews, and comments?
Domain Expert: Yes, normally. Posts, Reviews, and Comments are User-Owned Content, so authors can edit or delete them unless Moderation Removal limits the content.

Developer: Can feed card authors delete other users' comments on their own feed cards?
Domain Expert: Yes. Comment Deletion lets feed card authors delete Comments on their own feed cards, and the Comment author receives a Comment Removal Notification.

Developer: Does a deleted Comment leave a visible placeholder?
Domain Expert: No. Comment Deletion removes the Comment from the thread completely.

Developer: Does Comment Deletion remove old notifications for that Comment?
Domain Expert: No. Prior notifications remain in history, but opening them follows Notification Target Access and may show unavailable content.

Developer: Should edited posts, reviews, and comments be visibly marked?
Domain Expert: Yes. Edited User-Owned Content shows the `edited` text only, without an edited time.

Developer: Does editing a post, review, or comment move it back to the top of the feed?
Domain Expert: No. Edits update content in place, show `edited`, and do not create new activity or refresh feed order.

Developer: If the author edits a Review Rating, do Anime Review Metrics update?
Domain Expert: Yes. Review Rating is part of the Review source, so metrics use the latest value without creating a new Review Activity or feed bump.

Developer: Do Anime Review Metrics use the Review Rating from when the Review Activity was first created?
Domain Expert: No. Metrics use the current Review Rating on the Review source; Review Activity is not a historical metrics snapshot.

Developer: Does the Review Activity card also show the current Review Rating after edits?
Domain Expert: Yes. The Review source is truth, so the Review Activity card updates its displayed Review Rating silently without a feed bump.

Developer: If the author edits only Review Summary, does the Review Activity card update?
Domain Expert: Yes. Review Summary belongs to the Review source, so Review Activity and anime-page review surfaces update silently, show `edited`, and do not bump feed order.

Developer: Does the Review Activity card show full Review text?
Domain Expert: No. Review Activity shows author name, anime title, current Review Rating, and Review Summary, then links to the Review Detail Page while it exists.

Developer: Is Review Summary generated from the full Review body?
Domain Expert: No. Review Summary is a separate user-written field, not an auto-generated or truncated Review preview.

Developer: Can a user publish a Review without Review Summary?
Domain Expert: No. Review Summary is required because Review Activity and anime-page review surfaces depend on it.

Developer: How long can Review Summary be?
Domain Expert: Review Summary is capped at 280 characters so Review Activity cards stay compact.

Developer: Does the Feed Card Menu show the same actions to authors and other viewers?
Domain Expert: No. Authors see edit, delete, and Visibility Change actions where allowed; other viewers see Content Report only for reportable sources.

Developer: Which feed items can users report?
Domain Expert: Signed-in users can create a Content Report for Posts, Reviews, and Comments. Generated activity cards are not reportable.

Developer: Can Completed Anime or Rewatch Completion Activity cards be reported or removed by moderation?
Domain Expert: No. Completed Anime and Rewatch Completion Activity cards are outside Content Reports and Moderation Removal in MVP.

Developer: Does a Content Report require a reason?
Domain Expert: Yes. A Content Report requires a Report Reason: Spam, Harassment, Spoiler, Inappropriate, or Other.

Developer: Does the Other report reason require extra text?
Domain Expert: Yes. Other requires a short explanation; the predefined Report Reasons do not.

Developer: Can the same user report the same content more than once?
Domain Expert: No. Report Uniqueness allows only one active Content Report per reporting user and reported content item. Other users can still report the same content.

Developer: If three users report the same Post, how many Moderation Cases exist?
Domain Expert: One Moderation Case exists for that Post, containing three Content Reports. Each Content Report keeps its own reporter, Report Reason, and Report Snapshot.

Developer: Does a single Content Report create a Moderation Case?
Domain Expert: Yes. A Moderation Case can start with one Content Report and collect later Content Reports for the same content item.

Developer: Can normal users see a Moderation Case or its status?
Domain Expert: No. Moderation Cases are private moderator-facing records; normal users only see their own report submission result and any Reporter Hide effect.

Developer: Does a reporter receive a notification when a Moderation Case is resolved?
Domain Expert: No. AnimeX MVP has no Report Outcome Notification. The reporter only gets the Content Report submission result and any Reporter Hide effect.

Developer: Can moderators remove reported content after reviewing a Moderation Case?
Domain Expert: Yes. Moderation Removal makes the reported Post, Review, or Comment unavailable to normal users globally, separate from Reporter Hide.

Developer: Does Moderation Removal notify the content author?
Domain Expert: Yes. AnimeX sends a short Moderation Removal Notification such as `Your post was removed by moderation`; it does not include reporter identity, report count, or Moderation Case status.

Developer: Can users disable Moderation Removal Notifications?
Domain Expert: No. Moderation Removal Notifications are required moderation notices and are not controlled by Notification Preferences.

Developer: What does the author see when they open a Moderation Removal Notification?
Domain Expert: They see only `This content is unavailable`. Normal user UI does not show reason details, removed text, images, Review Like count, other interaction counts, or other removed content details after Moderation Removal.

Developer: Does Moderation Removal delete the Content Reports, Report Snapshots, or Moderation Case?
Domain Expert: No. Those remain private moderation records after the reported content is removed from normal user surfaces.

Developer: Can moderators restore content after Moderation Removal?
Domain Expert: No. AnimeX MVP has no Moderation Restore; Moderation Removal is one-way for MVP.

Developer: Can the author edit or delete content after Moderation Removal?
Domain Expert: The author cannot edit it, but can delete it as cleanup. Author deletion after Moderation Removal does not remove the Content Reports, Report Snapshots, or Moderation Case.

Developer: Does author deletion after Moderation Removal send another notification?
Domain Expert: No. Author cleanup deletion after Moderation Removal is silent and does not notify reporters, moderators, commenters, or the author again.

Developer: Does Moderation Removal keep old likes and comments visible?
Domain Expert: No. Removed content disappears as a whole from normal user surfaces, including associated Comments, feed-card Likes, and Comment Likes. If the removed content is a Review, its source-level Review Like records are deleted, with only private moderation snapshots preserved.

Developer: What happens to Review Likes while a Review is under moderation review?
Domain Expert: They are hidden from normal user surfaces while the Moderation Case is under review.

Developer: Does the Review author still see the Review Like count while the Review is under moderation review?
Domain Expert: No. The moderation-review hide also applies to author-facing Review surfaces.

Developer: Can users add Review Likes while a Review is under moderation review?
Domain Expert: No. The Review Like action is unavailable while the Moderation Case is active.

Developer: If the Moderation Case closes without Moderation Removal, do hidden Review Likes return?
Domain Expert: Yes. The temporary moderation-review hide ends, and the Review Likes and Visible Like Count return under normal Review Visibility, Block, and Reporter Hide rules.

Developer: What happens to Review Likes if Moderation Removal removes that Review?
Domain Expert: The source-level Review Like records are completely removed, but private moderation snapshots remain for moderation history.

Developer: If a Comment gets Moderation Removal, do its Comment Replies stay visible?
Domain Expert: No. The removed Comment and its Comment Replies are hidden from normal user surfaces as one removed conversation segment. Private moderation records remain.

Developer: If a Comment Reply gets Moderation Removal, does the original Comment stay visible?
Domain Expert: Yes. Only the removed Comment Reply and its Comment Likes are hidden from normal user surfaces; the original Comment stays visible unless another rule hides it.

Developer: Who receives a Moderation Removal Notification when a Comment Reply is removed?
Domain Expert: Only the removed Comment Reply author receives a notification such as `Your reply was removed by moderation`. The original Comment author is not notified.

Developer: If a Post, Review, or top-level Comment gets Moderation Removal, do commenters or repliers get notified?
Domain Expert: No. Only the removed content author receives a Moderation Removal Notification. Commenters and repliers only encounter unavailable content through normal access rules.

Developer: Does moderation-removed content still count in profile totals?
Domain Expert: No. Profile Counts exclude moderation-removed Posts, Reviews, Comments, Comment Replies, feed-card Likes, and Comment Likes from normal user-visible totals. Private moderation records keep their own history.

Developer: Does a moderation-removed Review still affect anime page review totals or average Review Rating?
Domain Expert: No. Anime Review Metrics exclude moderation-removed Reviews from public review counts and average Review Rating. Private moderation records keep their own history.

Developer: What happens if reported content is edited after the Content Report?
Domain Expert: The Content Report stays active, its Report Snapshot preserves the report-time content, Reporter Hide remains active for the reporter, and Report Uniqueness still prevents the same reporter from reporting that content item again.

Developer: What does a Report Snapshot preserve?
Domain Expert: It preserves the reported content's text, Post-media copies and display metadata, attached anime metadata when present on the source type, author identity, and Reply Tag when present as they existed when the Content Report was created.

Developer: If a reported Post's external media is removed or replaced later, what happens to the Report Snapshot?
Domain Expert: The Report Snapshot keeps the report-time Post-media copy and display metadata. It does not depend on the Post's current media field.

Developer: What happens if reported content is deleted after the Content Report?
Domain Expert: The Content Report and Report Snapshot stay active as moderation records, but the reported content becomes unavailable because it was deleted. Reporter Hide no longer affects display because there is no content to show.

Developer: Can public users see the Report Snapshot?
Domain Expert: No. Report Snapshots are private moderation records. Public users only see the current visible content state or deletion state.

Developer: Do Comment Replies have a separate report type?
Domain Expert: No. A Comment Reply is reported as a Comment, and the Content Report targets the Comment Reply content itself, not the original Comment it replied to.

Developer: Does reporting content hide it immediately?
Domain Expert: Yes, but only for the reporting user. A Content Report creates a Reporter Hide, not a global takedown.

Developer: Can the reporter undo Reporter Hide after submitting a Content Report?
Domain Expert: No. Reporter Hide is one-way in MVP; the reported content stays hidden from the reporter after the report is submitted.

Developer: If a user reports a Comment Reply, what does Reporter Hide hide?
Domain Expert: Reporter Hide hides only the reported Comment Reply from the reporting user. The original Comment remains visible unless it is separately reported, blocked, deleted, or hidden by feed-card visibility.

Developer: Are content authors notified when their Post, Review, Comment, or Comment Reply is reported?
Domain Expert: No. Content Reports are private moderation signals and do not notify reported content authors by themselves. Authors are notified only if moderation later takes a separate action that requires notification.

Developer: If a user reports a Review, what does Reporter Hide hide?
Domain Expert: It hides the Review Detail Page and review-derived feed surfaces, including the Review Activity, for the reporting user only.

Developer: If a user reports a Review, does it still count in Anime Review Metrics for that reporter?
Domain Expert: No. Reporter Hide removes that Review from the reporter's Anime Review Metrics only.

Developer: Does Reporter Hide remove a Review's Likes for everyone?
Domain Expert: No. It hides that Review and its Visible Like Count from the reporter only; unrelated viewers still count the Review Likes when they can see the Review.

Developer: Can users hide posts, reviews, or comments without reporting them?
Domain Expert: No. AnimeX MVP has no Manual Hide feature. Reporter Hide only happens after a Content Report.

Developer: Can users block other users?
Domain Expert: Yes. Block is in scope for MVP as a private safety action, separate from Content Reports.

Developer: What happens to Follow relationships when user A blocks user B?
Domain Expert: Blocking removes existing Follow relationships in both directions. While the Block is active, neither user can follow the other.

Developer: Does blocking another user automatically create a Content Report?
Domain Expert: No. A Block is private and only affects the blocked relationship. Content Reports are created only when a user explicitly reports a Post, Review, or Comment with a Report Reason.

Developer: Can blocked users report each other's content through an old notification or direct link?
Domain Expert: No. Blocked Report Access follows active Block rules first; if the content is unavailable because of the Block, report actions are not shown.

Developer: After Unblock, can users report old visible content from before the Block?
Domain Expert: Yes. Once Unblock ends Blocked Report Access, normal Content Report rules apply again. If the content is visible and reportable, it can be reported.

Developer: Does unblocking restore the old Follow relationships?
Domain Expert: No. Unblock removes the Block only. Either user must follow again manually after the Block ends.

Developer: After Unblock, do the two users count each other's Reviews in Anime Review Metrics again?
Domain Expert: Yes, when current access allows it. Public Reviews count again, but Followers only Reviews require a current Follow relationship because Unblock does not restore removed follows.

Developer: Can users see and manage the people they have blocked?
Domain Expert: Yes. The Blocked Users List is private to the blocking user and lets them unblock users later.

Developer: Can blocked users see each other's User Profiles?
Domain Expert: No. A Block creates a Blocked Profile State in both directions, so neither user sees the other's User Profile content while the Block is active.

Developer: Should the blocked viewer be told directly that they are blocked?
Domain Expert: No. The blocked viewer sees neutral unavailable wording. Only the blocking user sees explicit block-management wording and unblock affordances.

Developer: Can blocked users see each other's posts, reviews, comments, or activity in feeds?
Domain Expert: No. Blocked Feed Visibility hides those feed surfaces from both sides while the Block is active, without deleting the underlying content.

Developer: Do blocked users still count each other's Reviews in Anime Review Metrics?
Domain Expert: No. Blocked Feed Visibility excludes those Reviews from Anime Review Metrics for the two blocked users only; unrelated viewers still count them when they have access.

Developer: Can blocked users comment on or like each other's feed cards through a direct link or old notification?
Domain Expert: No. Blocked Interaction prevents either side from adding Comments, feed-card Likes, Review Likes, or Comment Likes to the other side's content while the Block is active.

Developer: What happens to comments and likes that already existed before the Block?
Domain Expert: Existing Comments, feed-card Likes, Review Likes, and Comment Likes stay stored but are hidden from both blocked users while the Block is active. They are not automatically deleted.

Developer: Do Review Likes hidden by a Block still count for unrelated viewers?
Domain Expert: Yes. The Block hides those Review Likes only for the blocked relationship; unrelated viewers still count them when they can see the Review.

Developer: Do old notifications from blocked users remain visible?
Domain Expert: Yes. Old notifications may remain in notification history, but opening them follows Block rules and may show unavailable content.

Developer: Are new notifications created between blocked users while the Block is active?
Domain Expert: No. Blocked Notification Delivery prevents new notifications caused by each other's Posts, Reviews, Comments, Likes, Follows, or Activity.

Developer: If a user opens a notification and the target is unavailable, does the notification stay unread?
Domain Expert: No. Opening an In-App Notification marks its Notification Read State as read even when the target resolves to unavailable content.

Developer: Does the notification icon show an unread count?
Domain Expert: Yes. The Notification Badge shows the unread notification count, is hidden at zero, and displays `99+` when the unread count exceeds 99.

Developer: Does opening the notification icon or mobile notification header mark all notifications read?
Domain Expert: It marks the unread notifications shown in the Notification Preview as read. If more unread notifications remain beyond the preview limit, the user can open the Notification Page and use `Mark all as read`.

Developer: If more than 50 unread notifications exist and the Notification Preview marks 50 read, what happens to the Notification Badge?
Domain Expert: It updates to the remaining unread count, still capped at `99+`, or hides if no unread notifications remain.

Developer: How many notifications does the Notification Preview show?
Domain Expert: It shows up to 50 unread notifications, newest first. If more unread notifications remain, the `Show more` action navigates to the Notification Page.

Developer: What does the Notification Preview show when there are no unread notifications?
Domain Expert: It shows an empty state with a link to notification history. It does not show recent read notifications inside the preview.

Developer: How many notifications does the Notification Page load?
Domain Expert: It loads 50 notifications by default, newest first, and shows Load More while older unloaded notifications remain.

Developer: Does the Notification Page have a bulk read action?
Domain Expert: Yes. The Notification Page has a `Mark all as read` action for all current unread notifications.

Developer: Does the Notification Page have filters such as `All` and `Unread`?
Domain Expert: No. AnimeX MVP shows one unfiltered notification history list, newest first.

Developer: How does the Notification Page distinguish unread notifications without filters?
Domain Expert: Unread notifications use subtle visual emphasis such as stronger text, a small unread dot, or a lightly tinted row, while read notifications stay visually quieter.

Developer: Should notification rows show relative timestamps?
Domain Expert: Yes. Notification rows show relative Notification Timestamps such as `2m ago`, `1h ago`, or `3d ago`.

Developer: What source icon should notification rows show?
Domain Expert: User-caused notifications show the actor's User Avatar. System or moderation notifications show a neutral AnimeX/Ami system icon and do not expose reporter identity.

Developer: Should notification rows show a target thumbnail?
Domain Expert: Yes, selectively. Anime-related notifications may show an anime cover, Posts with external image media may show that image, and plain comments, likes, follows, or moderation notices can omit the target thumbnail.

Developer: Can users delete or clear notifications from history?
Domain Expert: No. Notification history is read-only in MVP. Old notifications may only be removed by a future optional automatic cleanup.

Developer: Can users receive notifications when someone they follow creates new feed content?
Domain Expert: Yes. Users can receive short Follower Activity Notifications for new Posts and Review Activity from users they follow.

Developer: Are MVP notifications in-app, email, or push?
Domain Expert: In-app only. AnimeX MVP does not include email or push notifications.

Developer: Should Follower Activity Notifications include anime titles?
Domain Expert: Yes, when available. Use concise copy such as `Mika posted` or `Mika reviewed Frieren`.

Developer: Do users get notifications for direct interactions on their own content?
Domain Expert: Yes. Account Interaction Notifications are created for new Follows, Comments on the user's own feed cards, Likes on the user's own feed cards, Review Like Notifications, Comment Reply Notifications, Comment Like Notifications, and Comment Removal Notifications.

Developer: Does a Comment Reply notify the original Comment author?
Domain Expert: Yes, when the Comment Reply keeps its Reply Tag. If the user removes the Reply Tag before posting, no Comment Reply Notification is created for the original Comment author.

Developer: If the original Comment author is also the feed card owner, does one Comment Reply create two notifications?
Domain Expert: No. Notification Deduplication sends only the more specific Comment Reply Notification to that user. If the Reply Tag is removed, the action can create the normal feed-card Comment notification instead.

Developer: If the original Comment author and feed card owner are different users, can both receive notifications?
Domain Expert: Yes. One recipient can receive the Comment Reply Notification, and the feed card owner can receive the normal feed-card Comment notification.

Developer: Do later Comment Reply edits create, remove, or resend Comment Reply Notifications?
Domain Expert: No. Comment Reply Notifications are evaluated only at initial posting. Editing a Comment Reply later to add or remove a Reply Tag does not change notifications.

Developer: Does a user get notified when another user likes their Comment?
Domain Expert: Yes. A Comment Like Notification tells the Comment author that another user liked their Comment, using short copy such as `Mika liked your comment`.

Developer: If someone likes a feed card or Comment and later removes that Like, does the old notification disappear?
Domain Expert: No. The notification stays in history, no unlike notification is created, and the current Visible Like Count remains the source of truth.

Developer: Does a user get notified when another user likes their Review?
Domain Expert: Yes. A Review Like Notification tells the Review author that another user liked their Review, using short copy such as `Mika liked your review`.

Developer: If the Review Activity card was deleted, does a new Review Like from the Review Detail Page or Reviews tab still notify the Review author?
Domain Expert: Yes. It is still a source-level Review Like, so it can create a Review Like Notification unless self-like, Blocked Notification Delivery, or Notification Preferences prevent it.

Developer: If someone likes a Review and later removes that Review Like, does the old Review Like Notification disappear?
Domain Expert: No. The notification stays in history, no unlike notification is created, and the current Review Visible Like Count remains the source of truth.

Developer: If someone likes, unlikes, then likes the same feed card, Review, or Comment again, does AnimeX create another like notification?
Domain Expert: No. Notification Deduplication allows at most one like-based notification per actor and target; the current Visible Like Count remains the live state.

Developer: Should AnimeX bundle multiple users into one notification row?
Domain Expert: No. AnimeX MVP keeps different actors as separate In-App Notifications; Notification Bundling such as `Mika and 3 others liked your review` is not part of MVP.

Developer: Does AnimeX show a toast, banner, or sound when a new notification arrives?
Domain Expert: No. AnimeX MVP does not use Notification Alerts; it updates the Notification Badge, Notification Preview, and Notification Page quietly.

Developer: What happens if a user opens an old Review Like Notification after the Review becomes hidden, deleted, or blocked?
Domain Expert: The notification remains in history, but opening it follows Notification Target Access. It opens the Review Detail Page only when current access allows; otherwise it resolves to unavailable content.

Developer: If a Review Like Notification stopped working because a Review became Private, does it work again after the Review becomes Public?
Domain Expert: Yes. Review Like Notifications follow current Review Visibility, so restored access makes the old notification usable again while the Review source still exists.

Developer: While a Review is under moderation review, can an old Review Like Notification open the Review Detail Page?
Domain Expert: No. It remains in history, but Notification Target Access resolves to unavailable content while the Moderation Case is active.

Developer: If the Moderation Case closes without Moderation Removal, does that old Review Like Notification work again?
Domain Expert: Yes. The temporary moderation-review block ends, so Notification Target Access follows normal Review Visibility, Block, and deletion rules again.

Developer: If Moderation Removal deletes a Review's source-level Review Like records, do old Review Like Notifications stay in history?
Domain Expert: Yes. They stay in history, but Notification Target Access resolves to unavailable content because the Review was moderation-removed.

Developer: Does a user get notified when their comment is deleted by the feed card author?
Domain Expert: Yes. A Comment Removal Notification tells the Comment author that their Comment was removed, using short context such as `Your comment was removed from Alex's post` without a post, review, or anime title.

Developer: Which Notification Preference controls Comment Removal Notifications?
Domain Expert: Comment Removal Notifications use the Account Interaction Notification preference, not a separate MVP toggle.

Developer: Does liking your own feed card, Review, or Comment create a notification?
Domain Expert: No. Account Interaction Notifications require another user as the actor; self-actions never notify the same user.

Developer: Can users like their own Posts, Reviews, Activity cards, or Comments?
Domain Expert: Yes. Self-likes are allowed, but they do not create Account Interaction Notifications.

Developer: Do self-likes count in the Visible Like Count?
Domain Expert: Yes. A visible self-like counts like any other Like, but it does not create an Account Interaction Notification.

Developer: How can users inspect who liked a feed card, Review, or Comment?
Domain Expert: They cannot in MVP. AnimeX does not expose liked-user previews or Likes Lists; signed-in users see the Like action, and all allowed viewers see the Visible Like Count when nonzero.

Developer: Do Likes hidden by Block rules still count in the displayed total?
Domain Expert: No. The Visible Like Count only counts Likes visible to that viewer, so it does not leak hidden Likes.

Developer: What should appear when the Visible Like Count is zero?
Domain Expert: Nothing. AnimeX does not show `0 likes`, and there is no liked-user preview to open.

Developer: Do Comment Likes use different count behavior from feed-card Likes?
Domain Expert: No. Comment Likes use the same Visible Like Count behavior as feed-card Likes, and neither exposes a liked-user preview.

Developer: What should appear after the first visible Like?
Domain Expert: Show `1`, without the text `like`. Counts at 1000 and above use compact notation such as `1k`, `1.5k`, or `2k`.

Developer: Does hiding the zero Visible Like Count also hide the Like action?
Domain Expert: No for signed-in viewers. The Like action remains visible so signed-in users can still like the feed card.

Developer: Can users turn off follower activity notifications without turning off account interaction notifications?
Domain Expert: Yes. Notification Preferences let users disable Follower Activity Notifications separately while Account Interaction Notifications stay on by default.

Developer: Does Completed Anime activity notify followers?
Domain Expert: No. Completed Anime activity stays in feeds and does not create Follower Activity Notifications.

Developer: Do Rewatch Completion Activity bumps or Rewatch Activity Recreation notify followers?
Domain Expert: No. They stay visible through feed ordering, but they do not create Follower Activity Notifications.

Developer: Do blocked users appear in each other's user search results and search autocomplete suggestions?
Domain Expert: Yes. Blocked Search Visibility keeps them discoverable in search, but selecting them still follows Block rules.

Developer: Do those stored comments and likes become visible again after Unblock?
Domain Expert: Yes. After Unblock, stored Comments and Likes return to normal visibility rules.

Developer: Can users delete generated activity cards?
Domain Expert: Yes. Activity Deletion removes the generated card from feeds without deleting the underlying anime list entry, Score, completed status, Review, or Review Detail Page.

Developer: If a user deletes a Review Activity card, does that delete the Review?
Domain Expert: No. Activity Deletion removes only the feed card; the Review source, Review Detail Page, anime-page review surfaces, and Anime Review Metrics remain under Review Visibility until Review Deletion.

Developer: After deleting only the Review Activity, should the Review Summary still appear on the anime detail page?
Domain Expert: Yes. Review Summary remains available on anime-page review surfaces when Review Visibility allows because Activity Deletion removes only the feed card.

Developer: Should the anime detail page show that the Review Activity feed card was deleted?
Domain Expert: No. Anime-page review surfaces show the Review normally when Review Visibility allows; Activity Deletion is not review-state metadata.

Developer: Can the author manually restore a deleted Review Activity feed card?
Domain Expert: No. In MVP, Activity Deletion is final for that feed card; the Review source remains available through Review Visibility, but the deleted Review Activity card stays gone.

Developer: Does a deleted Review Activity still appear on the author's profile activity or history surfaces?
Domain Expert: No. Activity Deletion removes the Activity card anywhere Activity cards appear, including profile activity surfaces; the Review source remains available on review and anime surfaces under Review Visibility.

Developer: Should profile activity show the Review source after its Review Activity was deleted?
Domain Expert: No. Profile activity shows active feed cards only; deleted Review Activity is not replaced by a Review source entry.

Developer: Does the User Profile still have a Review list?
Domain Expert: Yes. The Reviews tab lists visible Review sources as Review Cards, separate from profile activity.

Developer: What does a Review Card show on the User Profile?
Domain Expert: In Phase 7 it shows an anime image, anime name, current Review Rating, Review Summary, and open affordance. Phase 9 adds the Review Visible Like Count when nonzero and Review Like action.

Developer: If a user edits a Review after deleting its Review Activity card, is the feed card recreated?
Domain Expert: No. Review Edits update the Review source, Review Detail Page, and Anime Review Metrics when the Review Rating changes, but Activity Deletion keeps that Review Activity card suppressed.

Developer: Do Review Detail Pages have their own Comments?
Domain Expert: No. In MVP, Comments belong to feed cards and Comments, not to the Review Detail Page itself.

Developer: Does the Review Detail Page show the same Like action as the Review Card?
Domain Expert: Yes for signed-in viewers. Review Cards and Review Detail Pages share one source-level Review Like; it is not tied to the deleted Review Activity feed-card Like.

Developer: If the Review Activity card was deleted, can users still like the Review from the Review Detail Page or Reviews tab?
Domain Expert: Yes. Activity Deletion removes only the feed-card Like surface; source-level Review Likes remain available anywhere the Review source is visible.

Developer: Do Review Cards and Review Detail Pages show a like count?
Domain Expert: Yes. They show the Visible Like Count for the Review source when nonzero, but they do not expose a liked-user preview.

Developer: Does Review Activity visibility also control the Review Detail Page and anime-page review surfaces?
Domain Expert: Yes. Review Visibility is source-wide, so the Review Activity, Review Detail Page, anime-page review previews, and Anime Review Metrics all follow the same access rule.

Developer: If a user deletes a Completed Anime or Rewatch Completion Activity card, does that change their anime list?
Domain Expert: No. The feed card disappears, but the Score, completed status, and rewatch history remain on the anime list entry.

Developer: Does Activity Deletion remove prior notifications for that activity?
Domain Expert: No. Prior notifications remain in history, but opening them follows Notification Target Access and may show unavailable content.

Developer: If Activity Deletion removes a Comment, Comment Reply, Like, or Comment Like that already created a notification, does that old notification stay?
Domain Expert: Yes. The notification remains in history, but opening it follows Notification Target Access and resolves to unavailable content because the Activity card interaction surface is gone.

Developer: If a user opens an old notification for a deleted Review Activity card, can it still open the Review?
Domain Expert: Yes. If the Review source still exists and current access rules allow it, Notification Target Access resolves to the Review Detail Page instead of unavailable content.

Developer: If a user opens an old notification for a deleted Completed Anime or Rewatch Completion Activity card, can it resolve anywhere else?
Domain Expert: No. Those Activity cards have no durable detail page, so Notification Target Access resolves to unavailable content after Activity Deletion.

Developer: What happens to comments and likes when an Activity card is deleted?
Domain Expert: Activity Deletion removes the Activity card's Comments, Comment Replies, feed-card Likes, and Comment Likes with it.

Developer: Does Activity Deletion send Comment Removal Notifications to users whose Comments disappear with the card?
Domain Expert: No. Activity Deletion removes the Activity card's interaction surface silently and does not notify Comment authors.

Developer: Can users edit generated Activity card text?
Domain Expert: No. Generated Activity Text is system-authored; authors can only delete the Activity card or change its visibility.

Developer: What happens when a user deletes a Review?
Domain Expert: Review Deletion removes the Review source, its Review Detail Page, and its Review Activity.

Developer: Does Review Deletion remove that Review from Anime Review Metrics?
Domain Expert: Yes. Review Deletion removes the Review source, so it stops counting for every viewer; Activity Deletion removes only the feed card and does not remove the Review from metrics.

Developer: Does Review Deletion remove source-level Review Likes?
Domain Expert: Yes. Review Deletion removes Review Likes and their Visible Like Count because the Review source is gone.

Developer: If Review Deletion removes a Review that already created a Follower Activity Notification, does that old notification stay?
Domain Expert: Yes. The notification remains in history, but opening it follows Notification Target Access and resolves to unavailable content because the Review source and Review Detail Page are gone.

Developer: What happens to comments and likes when a feed card is deleted?
Domain Expert: Feed Card Deletion removes the card's Comments, Comment Replies, feed-card Likes, and Comment Likes with it.

Developer: Does deleting a whole Post feed card send Comment Removal Notifications to users whose Comments disappear with the Post?
Domain Expert: No. Feed Card Deletion removes the whole interaction surface silently; Comment Removal Notifications are only for individual Comment Deletion by the feed card author.

Developer: If Feed Card Deletion removes a Comment, Comment Reply, Like, or Comment Like that already created a notification, does that old notification stay?
Domain Expert: Yes. The notification remains in history, but opening it follows Notification Target Access and resolves to unavailable content because the feed card interaction surface is gone.

Developer: If Feed Card Deletion removes a Post that already created a Follower Activity Notification, does that old notification stay?
Domain Expert: Yes. The notification remains in history, but opening it follows Notification Target Access and resolves to unavailable content because the Post feed card no longer exists.

Developer: Does a deleted feed card leave a visible placeholder?
Domain Expert: No. Deleted feed cards disappear completely.

Developer: Do reviews only appear in the feed?
Domain Expert: No. Reviews have their own detail pages with a 2500-character limit, while feeds and anime detail pages show Review Summary cards.

Developer: Can a user publish a text-only review without rating?
Domain Expert: No. Reviews require a Review Rating. Review Ratings use a 0-100 scale and start at 50 by default.

Developer: Is 50 the minimum review rating?
Domain Expert: No. 50 is only the default starting Review Rating; users can choose a lower or higher value within the 0-100 scale.

Developer: Does the required Review Rating create its own standalone Activity for Score?
Domain Expert: No. A review and its required Review Rating are shown as one combined Review Activity. Scores are separate and use a 0-10 scale.

Developer: Are Review Ratings and Scores the same thing?
Domain Expert: No. Review Ratings belong to reviews and use a 0-100 scale; Scores belong to anime list entries and use a 0-10 scale.

Developer: How much decimal precision do Review Ratings and Scores allow?
Domain Expert: Review Ratings and Scores both allow up to one decimal place.

Developer: Should anime detail pages label the user's anime-list value as `Your Score`?
Domain Expert: No. AnimeX uses the label `Score` everywhere, including anime detail pages and anime list controls.

Developer: Does Score have a default value when the user opens the scoring control?
Domain Expert: No. Score starts empty until the user intentionally sets one; Review Rating is the required value that starts at 50.

Developer: Can users discuss and react to feed cards?
Domain Expert: Yes. Feed cards support short comments and like or unlike.

Developer: Does AnimeX upload or compress Post media?
Domain Expert: No. A Post may reference one safe external HTTPS image or video URL. AnimeX validates and stores the reference but does not upload, compress, or proxy the remote file.

Developer: Can comments include image attachments?
Domain Expert: No. Comments are text-only.

Developer: Can users like Comments?
Domain Expert: Yes. Comments can receive Comment Likes that are separate from the parent feed card's Likes.

Developer: Can users reply to Comments?
Domain Expert: Yes. Replying creates a flat Comment Reply in the same feed-card comment list. AnimeX does not create nested comment threads.

Developer: How does AnimeX show which Comment a user is replying to?
Domain Expert: A Comment Reply can include a Reply Tag naming the original Comment author. The composer includes the Reply Tag by default, and the user can remove it before posting; removing it also prevents the Comment Reply Notification.

Developer: What happens to Comment Replies when the original Comment is deleted?
Domain Expert: Comment Replies stay visible, but the Reply Tag pointing to the deleted Comment is removed.

Developer: Do Posts or Comments support `@mentions`?
Domain Expert: No. Mention is not in MVP, so Posts and Comments do not have general `@mention` parsing, mention autocomplete, or mention notifications. Reply Tags are only for Comment Replies.

Developer: Does AnimeX MVP include Direct Messages?
Domain Expert: No. AnimeX MVP has no Direct Messages. User communication stays on feed cards through text-only Comments and Comment Replies.

Developer: Can a Post attach an anime or multiple media items?
Domain Expert: Not in Phase 5. Anime attachment remains optional backlog, and a Post may reference at most one safe external HTTPS image or video URL.

Developer: Do Posts and Reviews need spoiler controls?
Domain Expert: Yes. A Post spoiler covers its body text and external media until revealed. A Review-level spoiler flag warns readers without hiding Summary, while rich-text spoiler blocks reveal independently.

Developer: Do comments and likes have their own visibility?
Domain Expert: No. Comments, feed-card Likes, and Comment Likes inherit feed-card visibility. Private feed cards have no audience, so comments and likes are disabled.

Developer: What happens to existing comments and likes when a feed card becomes Private?
Domain Expert: Existing Comments, feed-card Likes, and Comment Likes stay stored but hidden while the card is Private. If the author changes the card back to Public or Followers only, they reappear according to the new Feed Card Visibility.

Developer: Does changing Feed Card Visibility show `edited` or bump the feed card?
Domain Expert: No. A Visibility Change updates access silently without an Edited Indicator and without refreshing feed order.

Developer: What happens to an old notification if its Post or Activity card becomes Private?
Domain Expert: The notification stays in history, but opening it follows current Feed Card Visibility and may show unavailable content for viewers who no longer have access. Visibility changes do not create new notifications.

Developer: If that card becomes Public or Followers only again, does the old notification work again?
Domain Expert: Yes. Notification Target Access follows current Feed Card Visibility, so the old notification becomes usable again for viewers with access unless the card or source was deleted, blocked, or moderation-removed.

Developer: Which visibility levels does AnimeX support?
Domain Expert: AnimeX supports Public, Followers only, and Private. Users can set an account-level default and override visibility per feed card.

Developer: If a user changes their Account-Level Default Visibility, do older Posts and Activity cards change too?
Domain Expert: No. Account-Level Default Visibility only applies to newly created feed cards; older cards keep their current Feed Card Visibility unless the author changes them directly.

Developer: Can a user change all existing Posts and Activity cards to one visibility?
Domain Expert: Yes. A Bulk Visibility Change lets the user explicitly change all of their existing Posts and Activity cards without tying that change to Account-Level Default Visibility.

Developer: Where does the Bulk Visibility Change tool live?
Domain Expert: In Settings under Privacy, near Account-Level Default Visibility. It is not a Feed Card Menu action because it can affect many feed cards at once.

Developer: Can Bulk Visibility Change target Posts and Activity cards separately?
Domain Expert: Yes. The user can choose all Posts, all Activity cards, or both groups, but not individual feed cards within those groups. Activity cards include Review Activity, Completed Anime activity, and Rewatch Completion Activity.

Developer: If both Completed Anime and Rewatch Completion Activity cards exist, does Bulk Visibility Change for Activity cards affect both?
Domain Expert: Yes. Both are active Activity cards, so the bulk Activity group includes both unless either card was deleted or moderation-removed.

Developer: Does the Activity cards group include Review Activity cards too?
Domain Expert: Yes. Review Activity is an Activity card, so it is part of the bulk Activity group.

Developer: If Bulk Visibility Change changes Review Activity visibility, does the Review Detail Page visibility change too?
Domain Expert: Yes. Review Visibility is source-wide, so the Review Activity, Review Detail Page, and anime-page review surfaces all use the new visibility.

Developer: If Review Visibility changes to Private, do existing Review Likes get deleted?
Domain Expert: No. Source-level Review Likes stay stored; they are hidden from viewers who lose access and become visible again if Review Visibility later allows access.

Developer: When a Review is Private, does the author still see its Review Like count?
Domain Expert: Yes. The author can still access their own Private Review, so they see its nonzero Review Visible Like Count; other viewers without access see nothing.

Developer: If someone liked a Review while it was Public, can they unlike it after the Review becomes Private and they lose access?
Domain Expert: No. They no longer have the Review Like action. Their source-level Review Like stays stored and becomes removable only if they regain access later.

Developer: If Bulk Visibility Change makes an active Review Activity private, do Anime Review Metrics change too?
Domain Expert: Yes. Anime Review Metrics follow Review Visibility, so that Review stops counting for viewers who can no longer see it.

Developer: Can the same anime show different Anime Review Metrics to different viewers?
Domain Expert: Yes. Followers only Reviews count for followers who can open them, but not for viewers without access.

Developer: Does the author's own Private Review count in Anime Review Metrics when they view the anime detail page?
Domain Expert: Yes. Private Reviews count for their author because the author can open them; other viewers only count that Review when they have access.

Developer: If a viewer has no visible Reviews for an anime, should Anime Review Metrics show average Review Rating as `0`?
Domain Expert: No. The average Review Rating is absent until at least one Review is visible to that viewer.

Developer: Should visible review count still show `0` when no Reviews are visible?
Domain Expert: Yes. Visible review count can show `0`; only average Review Rating is hidden because `0` would look like a real bad average.

Developer: How many decimal places should average Review Rating show?
Domain Expert: One decimal place. If the average is a whole number, show the trailing `.0` for consistency.

Developer: If average Review Rating has more than one decimal, does AnimeX round or truncate?
Domain Expert: Round to the nearest one decimal. For example, `88.46` displays as `88.5`, not `88.4`.

Developer: If the Review Activity card was already deleted, does Bulk Visibility Change still update that Review's visibility?
Domain Expert: No. Deleted Review Activity cards are outside the bulk Activity group, so the Review source keeps its current Review Visibility.

Developer: Does Bulk Visibility Change show `edited`, bump feed cards, or send notifications?
Domain Expert: No. Bulk Visibility Change is silent like Visibility Change; existing notifications simply follow Notification Target Access under the new visibility.

Developer: If Bulk Visibility Change changes a Private rewatch card to Public, do old comments and likes reappear?
Domain Expert: Yes. Stored Comments, feed-card Likes, and Comment Likes reappear according to the new Feed Card Visibility.

Developer: Does Bulk Visibility Change require confirmation before it applies?
Domain Expert: Yes. Bulk Visibility Confirmation shows the selected groups, target Feed Card Visibility, separate affected counts for Posts and Activity cards, and total affected count before the author confirms.

Developer: Can users undo a Bulk Visibility Change?
Domain Expert: No. After confirmation, it applies as a normal visibility update; users can run another Bulk Visibility Change to change visibility again, but AnimeX does not restore previous per-card visibility in MVP.

Developer: Does Bulk Visibility Change affect deleted or moderation-removed feed cards?
Domain Expert: No. It applies only to active existing Posts and Activity cards; Feed Card Deletion, Activity Deletion, and Moderation Removal targets stay outside the bulk operation.

Developer: Does the Bulk Visibility Confirmation count include cards already set to the target visibility?
Domain Expert: No. The approximate affected count includes only selected active feed cards whose Feed Card Visibility will actually change.

Developer: If Completed Anime and Rewatch Completion Activity for the same anime both change visibility, is that one affected anime or two affected cards?
Domain Expert: Two affected cards. Bulk Visibility Confirmation counts feed cards, not anime titles.

Developer: If one of those two cards already has the target visibility, does it still count?
Domain Expert: No. Only the card whose Feed Card Visibility changes counts as affected.

Developer: Should the confirmation show one combined affected count or separate group counts?
Domain Expert: Show separate counts and a total, such as `Posts: 8`, `Activity cards: 14`, `Total: 22`.

Developer: Who sees the feed card Visibility Indicator?
Domain Expert: Only the author sees the Visibility Indicator. Other viewers do not see visibility icons or labels on feed cards.

Developer: Where does the author change feed card visibility?
Domain Expert: Visibility Changes live inside the Feed Card Menu. The Visibility Indicator is passive and should not be used as the control.

Developer: Can a new follower see older Followers only feed cards?
Domain Expert: Yes. Followers Only Visibility is checked against the current Follow relationship, not a frozen audience snapshot.

Developer: What happens when a user unfollows someone with Followers only cards?
Domain Expert: They immediately lose access to that author's Followers only cards, including old notification targets for those cards.

Developer: How is visibility chosen for generated Activity cards?
Domain Expert: Generated Activity cards inherit the user's account-level default visibility when created. Once the Activity card exists, the author can change its Feed Card Visibility.

Developer: Does MVP include private account mode?
Domain Expert: No. MVP uses account-level default visibility and per-card visibility, without follower approval or private account mode.

Developer: What should a User Profile show?
Domain Expert: Phase 7 User Profiles are signed-in-only and show the profile header, bio, list-progress stats, latest 10 favorites, and Activity, Reviews, and Favorites tabs. A separate Private Profile Visibility shows only the header, bio, and privacy notice to non-owners. Public profiles still filter each Review and Activity record by its own visibility. Social controls and counts stay absent until Phase 9.

Developer: What should users see when someone has no uploaded avatar?
Domain Expert: Show a circular Default Avatar using initials from the display name, falling back to the username initial. For new users, the username is the initial display name, so the Default Avatar uses username initials. The chibi mascot is a Mascot Avatar, not the ordinary user fallback.

Developer: Can users choose an Ami avatar instead of uploading their own?
Domain Expert: Yes. Users may choose a Preset Avatar or upload their own User Avatar, but the Default Avatar remains initials-based when they choose neither.

Developer: Who is the AnimeX mascot?
Domain Expert: Ami is the AnimeX chibi mascot. Use the right-side Ami concept as the primary reference, and keep Ami's character style consistent across future variants while allowing pose changes.

Developer: Can Ami's notebook change between avatar variants?
Domain Expert: No. Ami may hold the notebook in different poses, but the Ami Notebook design should stay consistent with the original.

Developer: Should the site logo match Ami?
Domain Expert: Yes. The Site Logo should share Ami's palette, star details, and anime-list notebook visual language.

Developer: What is the AnimeX Site Logo composition?
Domain Expert: The Site Logo uses an Ami Notebook and coral star icon paired with an `AnimeX` wordmark. The compact favicon may use only the notebook-star icon.

Developer: Which AnimeX logo variant is primary?
Domain Expert: Use the horizontal notebook-star plus `AnimeX` wordmark as the primary navigation logo, the compact notebook-star mark for favicon and app icon, and the badge-style logo only for decorative stickers or badges.

Developer: Where does AnimeX desktop navigation live?
Domain Expert: Desktop Site Navigation is on top, not in a left sidebar. Signed-in desktop navigation shows Home, Discover, search, notifications, and profile/settings; it does not show Community or Stats in MVP. Signed-out desktop navigation hides account-only controls, including Create and the notification icon, and shows `Sign in`.

Developer: Where does desktop Create live?
Domain Expert: For signed-in users, desktop Create appears near the top of the post feed and opens the Post Composer modal. Signed-out users do not see desktop Create.

Developer: Does the Post Composer include Reviews?
Domain Expert: No. Reviews are specific to an anime detail page and start from that page's Review Button.

Developer: Do signed-out users see the Review Button on anime detail pages?
Domain Expert: No. Signed-out users can browse anime detail pages, but the Review Button is hidden because Reviews require Signed-In Creation.

Developer: What can signed-out users do on social surfaces?
Domain Expert: Signed-out users have Signed-Out Browsing. They can read public feed cards, public Reviews, visible Comments, Visible Like Counts, and Visible Comment Counts, but they do not see action controls for liking, commenting, replying, following, posting, reviewing, or reporting.

Developer: What happens when signed-out users open account-only pages directly?
Domain Expert: Signed-out direct access to Account-Only Surfaces sends them to the public Home Feed, not a sign-in-required page.

Developer: What happens when signed-out users open a direct link to a Followers-only or Private feed card or Review?
Domain Expert: The Non-Public Direct Link sends them to the public Home Feed.

Developer: What happens when users open a direct link to deleted or moderation-removed content?
Domain Expert: They see an Unavailable Content Notice with only `This content is unavailable` rather than being redirected to the Home Feed.

Developer: After a signed-out user clicks `Sign in` from a public page, where do they go after login?
Domain Expert: Post-Sign-In Return sends them back to that same public page. If sign-in starts from the public Home Feed, it opens the signed-in Home Feed.

Developer: What if that return target becomes unavailable during sign-in?
Domain Expert: The user sees `This content is unavailable` after login.

Developer: What happens if an already signed-in user opens the sign-in page directly?
Domain Expert: Signed-In Auth Redirect sends a complete signed-in user to the signed-in Home Feed, and sends a Pending OAuth Sign-Up user to Username completion.

Developer: What does Password Sign-In use as the sign-in identifier?
Domain Expert: Account Email and password only. Account Email matching is case-insensitive. Username sign-in is not supported in MVP because Username is public-facing.

Developer: What message appears when Password Sign-In fails?
Domain Expert: AnimeX shows `Invalid email or password.` for wrong Account Email, wrong password, or both, and does not reveal whether the Account Email exists.

Developer: Should Password Sign-In have abuse protection after repeated failed attempts?
Domain Expert: Yes. Sign-In Abuse Limit temporarily blocks more Password Sign-In attempts after too many failures and shows `Too many attempts. Try again later.` without revealing whether the Account Email exists.

Developer: Where should the Password Reset request link appear on Password Sign-In?
Domain Expert: Password Sign-In shows `Forgot password?` under the password field and before the submit button. The link opens the Password Reset request page.

Developer: Should `Forgot password?` remain visible after Sign-In Abuse Limit triggers?
Domain Expert: Yes. Password Sign-In keeps `Forgot password?` visible during Sign-In Abuse Limit because the limit blocks sign-in attempts, not Password Reset entry.

Developer: How does Password Reset work?
Domain Expert: Password Reset starts from Account Email and always shows `If an account exists, reset instructions were sent.` after request submit. If an account exists, AnimeX sends reset instructions; the reset link or token expires after 30 minutes, the reset form asks for new password and confirm new password, the new password follows Password Rules, successful reset invalidates the reset link or token, and the user returns to Password Sign-In.

Developer: Should the Password Reset request form use inline Account Email availability checks?
Domain Expert: No. Password Reset Request Validation only validates Account Email format before submit. It does not show whether the Account Email exists, is unverified, has Password Sign-In, uses OAuth, is rate-limited, or is missing; after submit, AnimeX always shows `If an account exists, reset instructions were sent.`.

Developer: Should Password Reset emails include the Username or display name?
Domain Expert: No. Password Reset Email stays generic and account-safe. It uses AnimeX branding and the reset action only, without Username, display name, User Avatar, profile identity, sign-in method, or account-type details.

Developer: Should requesting a Password Reset email also send a separate Security Email Notice?
Domain Expert: No. Password Reset request sends Password Reset Email when eligible, but it does not send a separate Security Email Notice. Security Email Notice stays tied to completed account-security changes, so Password Reset sends it only after successful reset.

Developer: Should Password Reset Email include a visible expiry note?
Domain Expert: Yes. Password Reset Email includes `This link expires in 30 minutes.` so the recipient knows the reset link lifetime.

Developer: Should Password Reset Email include a "not you?" warning?
Domain Expert: Yes. Password Reset Email includes the minimal non-interactive warning `If you did not request this, you can ignore this email.` It does not include an extra security action link in MVP.

Developer: Should the "not you?" warning create any in-app notification or moderation/security case?
Domain Expert: No. The warning is informational only. It creates no In-App Notification, Moderation Case, security case, or account flag in MVP.

Developer: Should Password Reset Email include device, IP, browser, or location details for the request?
Domain Expert: No. Password Reset Email stays privacy-safe and minimal in MVP. It does not include device, IP, browser, or location details.

Developer: Should Password Reset Email copy include the Account Email address it was sent to?
Domain Expert: No. Password Reset Email does not repeat Account Email. The inbox already identifies the recipient, and repeating Account Email adds unnecessary account identity exposure.

Developer: Should Password Reset Email use a plain reset link only, or both a button-style action and visible fallback URL?
Domain Expert: Use both. Password Reset Email uses a primary `Reset password` action and also includes a visible fallback URL for email clients where the primary action does not work.

Developer: Should the Password Reset Email visible fallback URL be full raw URL text or a short copied link label?
Domain Expert: Use full raw URL text. The fallback URL should be copyable directly when the primary `Reset password` action does not work.

Developer: What should the Password Reset Email subject line be?
Domain Expert: Use `Reset your AnimeX password`. It is clear, action-focused, and does not include Account Email, Username, or sign-in method details.

Developer: What should the Password Reset Email preview or snippet text be?
Domain Expert: Use `Use this link within 30 minutes to reset your password.` It is short, clear, and does not include Account Email, Username, or sign-in method details.

Developer: When a valid Password Reset link opens the reset form, should AnimeX show account identity?
Domain Expert: No. The valid-link reset form shows only new password and confirm new password. It does not show Account Email, Username, User Avatar, profile identity, OAuth hint, sign-in method, or account-type details.

Developer: What should the Password Reset form submit button text be?
Domain Expert: Use `Reset password`. It matches the Password Reset Email primary action and keeps the form action clear.

Developer: Should the Password Reset form show password rules before submit?
Domain Expert: Yes. The valid-link reset form shows `8-24 characters.` near the new password field before submit. It can show `Password must be 8-24 characters.` and `Passwords do not match.` as inline errors, but it does not show `Choose a less common password.` and does not block common passwords in MVP.

Developer: Should Password Reset form password fields have a visibility toggle, and does it apply to other password fields?
Domain Expert: Yes. Password Visibility Toggle appears on every AnimeX password input, including Password Sign-In, Simplified Sign-Up, valid-link Password Reset, Account Password Change, and Account Email Change Reauthentication. Fields stay hidden by default; the toggle only changes local display.

Developer: When a user toggles password visibility on one field, should it affect only that field or all password fields in the same form?
Domain Expert: Only that field. Each Password Visibility Toggle changes visibility for its own field only, so revealing one password does not reveal any other password field in the same form.

Developer: What icon and accessible label should Password Visibility Toggle use?
Domain Expert: Hidden password fields show an eye icon with accessible label `Show password`; visible password fields show an eye-off icon with accessible label `Hide password`.

Developer: Should password visibility reset to hidden after a validation or submit error?
Domain Expert: No. If a user made a password field visible, it stays visible after validation or submit errors while the user remains on the same form. Password fields return to hidden when the user leaves and later reopens the form.

Developer: Should password fields allow paste and password-manager autofill?
Domain Expert: Yes. Password Input Assistance allows paste and password-manager autofill on every AnimeX password input, including Password Sign-In, Simplified Sign-Up, valid-link Password Reset, Account Password Change, and Account Email Change Reauthentication.

Developer: After successful Password Reset, should AnimeX encourage browser or password-manager saved-password updates?
Domain Expert: Yes, but only through normal browser and password-manager behavior. AnimeX does not show a custom in-app save-password prompt after Password Reset.

Developer: If a user requests multiple Password Reset emails, should older reset links remain valid?
Domain Expert: No. Password Reset Link Replacement means a newer Password Reset request for the same account invalidates older reset links or tokens, so only the latest issued reset link or token can be used.

Developer: If an older reset link is opened after it was replaced by a newer reset request, should it use the same generic invalid or expired message?
Domain Expert: Yes. Replaced reset links follow Password Reset Link Failure and show `Reset link is invalid or expired. Request a new one.` AnimeX does not say the link was replaced, superseded, or already used.

Developer: What should happen when a Password Reset link or token is invalid or expired?
Domain Expert: AnimeX shows `Reset link is invalid or expired. Request a new one.` with a way back to the Password Reset request page. The message stays generic and does not reveal whether the Account Email exists.

Developer: Should the invalid or expired Password Reset link page prefill or expose Account Email from the failed token?
Domain Expert: No. AnimeX does not prefill or expose Account Email from a failed token. The user goes back to the Password Reset request page and re-enters Account Email.

Developer: Should Password Reset success automatically sign the user in?
Domain Expert: No. Password Reset returns the user to Password Sign-In and requires signing in with the new password. It does not automatically create a new signed-in session.

Developer: After Password Reset succeeds and sessions are revoked, should the current reset flow show a success message before returning to sign-in?
Domain Expert: Yes. Password Reset Success State shows `Password reset. Sign in with your new password`, shows a 5-second countdown before redirecting to Password Sign-In, and also offers a `Sign in` link for immediate navigation. It does not automatically sign the user in.

Developer: What countdown copy should Password Reset Success State use before redirecting to Password Sign-In?
Domain Expert: Use `Redirecting to sign in in 5 seconds...`, with the number updating each second until redirect.

Developer: If the user clicks `Sign in` before the countdown ends, should the countdown stop?
Domain Expert: Yes. Immediate `Sign in` navigation wins; the countdown redirect stops so AnimeX does not run duplicate navigation.

Developer: After Password Reset Success State redirects or links to Password Sign-In, should Account Email be prefilled?
Domain Expert: No. Password Sign-In reached from Password Reset Success State does not prefill Account Email, so the reset flow stays identity-free.

Developer: After Password Reset Success State redirects to Password Sign-In, should Password Sign-In show a reset-success notice?
Domain Expert: No. Password Reset Success State already confirmed the reset, so Password Sign-In stays normal and does not show a reset-success notice.

Developer: Should Password Reset Success State show Account Email, Username, or any account identity?
Domain Expert: No. Password Reset Success State stays generic and identity-free. It only shows `Password reset. Sign in with your new password`, the 5-second countdown redirect, and the `Sign in` link.

Developer: After Password Reset succeeds for an Email-Unverified User, should the success message mention email verification?
Domain Expert: No. Password Reset Success State stays focused on reset success only. It does not mention Email OTP Verification; after Password Sign-In, the existing Email-Unverified routing sends the user to the Email OTP Verification Page.

Developer: When Password Reset succeeds, should all outstanding reset links or tokens for that account be invalidated?
Domain Expert: Yes. Password Reset Token Invalidation invalidates every outstanding reset link or token for that account, including the used token and any other token that could still be stored. No reset link or token remains usable after the password changes.

Developer: Should Password Reset requests have their own abuse limit?
Domain Expert: Yes. Password Reset Abuse Limit is separate from Sign-In Abuse Limit. After too many Password Reset requests, AnimeX temporarily stops sending additional reset emails while still showing `If an account exists, reset instructions were sent.` so the response does not reveal whether the Account Email exists.

Developer: Should Password Reset reject resetting to the same password as the current one?
Domain Expert: No. Password Reset is a recovery flow and does not reject the new password solely because it matches the current password.

Developer: After Password Reset succeeds, should AnimeX send a Security Email Notice?
Domain Expert: Yes. AnimeX sends a Security Email Notice to the Account Email with `Your AnimeX password was reset.` It has no action link in MVP.

Developer: After Password Reset succeeds, should existing signed-in sessions be revoked?
Domain Expert: Yes. Password Reset Session Revocation revokes all existing signed-in sessions for that account after Password Reset succeeds, regardless of sign-in method, and requires sign-in again with the new password.

Developer: Does Password Reset Session Revocation also revoke sessions created through OAuth sign-in?
Domain Expert: Yes. It revokes all existing AnimeX sessions for that account, regardless of sign-in method. It does not unlink OAuth or remove Linked Sign-In Methods.

Developer: Does Password Reset verify an Email-Unverified User?
Domain Expert: No. Password Reset changes password only. The user remains Email-Unverified and must complete Email OTP Verification after Password Sign-In.

Developer: Does Password Reset work for OAuth-created accounts without a password?
Domain Expert: Yes. If the Account Email belongs to a completed account without a password, AnimeX still sends reset instructions and lets the user create a new password. After success, the user can use Password Sign-In. The request response remains generic and does not reveal account type.

Developer: Does Password Reset work for Pending OAuth Sign-Up accounts?
Domain Expert: No. If the Account Email is held only by Pending OAuth Sign-Up, AnimeX still shows the generic Password Reset request response, sends no Password Reset Email, and the user must resume OAuth Sign-Up with the provider to finish Username completion first.

Developer: After an OAuth-created account creates a password through Password Reset, does OAuth sign-in still work?
Domain Expert: Yes. Linked Sign-In Methods keep OAuth sign-in and Password Sign-In on the same account. Password Reset adds password access and does not replace or unlink OAuth.

Developer: Can users unlink OAuth or remove Password Sign-In after both methods exist?
Domain Expert: No. MVP has no user-facing sign-in method management. Linked Sign-In Methods stay attached once added; AnimeX may revisit this later in Account Settings.

Developer: Should MVP support self-service Account Deletion?
Domain Expert: No. Account Deletion is non-MVP. Users cannot delete their own account from Account Settings in MVP; moderation/admin account enforcement and future cleanup for abandoned Unverified Account Reservations are separate policies.

Developer: What does new user sign-up require?
Domain Expert: Simplified Sign-Up form includes Account Email, password, and confirm password only. Email becomes the Account Email. Password follows Password Rules. It sends an Email OTP after form submission and redirects to the Email OTP Verification Page. After verification, Username Completion collects the unique case-insensitive Username, preserves typed capitalization for display, creates the Username-initial Default Avatar, and starts privacy at Private.

Developer: Should Simplified Sign-Up have abuse protection after repeated submits or OTP sends?
Domain Expert: Yes. Sign-Up Abuse Limit temporarily blocks more Simplified Sign-Up submissions or signup Email OTP send/resend attempts after too many attempts and shows `Too many attempts. Try again later.` It is separate from Account Email Conflict, so real Account Email conflicts still show `Email already in use. Sign in instead.`

Developer: If Sign-Up Abuse Limit triggers while an Email-Unverified User is already on the Email OTP Verification Page, can they still enter an already-sent OTP?
Domain Expert: Yes. Sign-Up Abuse Limit blocks new Simplified Sign-Up submissions and signup OTP sends/resends, not OTP verification. The Email OTP Verification Page still accepts the current OTP if it is valid, but blocks requesting a new signup OTP until the limit clears.

Developer: Should Sign-Up Abuse Limit also block Verification Email Change on the Email OTP Verification Page?
Domain Expert: Yes. Sign-Up Abuse Limit blocks Verification Email Change because changing the Account Email would send a new signup OTP and could bypass resend protection. The current Account Email and current OTP stay unchanged.

Developer: If the current OTP expires while Sign-Up Abuse Limit is active, should resend stay blocked?
Domain Expert: Yes. The Email OTP Verification Page shows the expired OTP message and keeps the user on the page, but resend and Verification Email Change remain blocked by Sign-Up Abuse Limit with `Too many attempts. Try again later.` Abuse Limit Messaging still does not show a countdown.

Developer: What Password Rules does AnimeX use?
Domain Expert: Password must be 8-24 characters, has no forced symbol or number requirement, does not block common passwords in MVP, and confirm password must match password.

Developer: Can two accounts share the same email address?
Domain Expert: No. Account Email is unique per account with case-insensitive matching, so `Mika@x.com` and `mika@x.com` collide.

Developer: Can verified users change Account Email later in Account Settings?
Domain Expert: Yes. Account Email Change is allowed in MVP. It uses Inline Account Email Availability during entry to prevent choosing an Account Email already active, held, or reserved by another account state.

Developer: When changing Account Email, should the current Account Email stay active until the new email passes OTP?
Domain Expert: Yes. Account Email Change starts Account Email Change Verification for the requested new Account Email. The current Account Email remains active for Password Sign-In and Password Reset until the new email passes OTP verification.

Developer: If the user starts Account Email Change, then signs out before verifying the new email, should the Pending Account Email Change survive?
Domain Expert: Yes. Pending Account Email Change survives sign-out until its OTP expires or a newer Account Email Change starts. The user signs back in with the current Account Email.

Developer: Should Account Email Change Verification use the same OTP limits as Email OTP Verification?
Domain Expert: Yes. Account Email Change Verification follows Email OTP Limits: 10-minute OTP expiry, 60-second resend cooldown, latest OTP only, and 5 wrong attempts invalidating the current OTP.

Developer: Should Account Email Change Verification have send/resend abuse protection like sign-up OTP?
Domain Expert: Yes. Account Email Change OTP Abuse Limit is separate from Sign-Up Abuse Limit and Sensitive Action Abuse Limit. It blocks sending or resending new Account Email Change OTPs after too many attempts, keeps any Pending Account Email Change unchanged, keeps the current Account Email active, and shows `Too many attempts. Try again later.` with no countdown.

Developer: If Account Email Change OTP expires while Account Email Change OTP Abuse Limit is active, should Pending Account Email Change release?
Domain Expert: Yes. OTP expiry still releases the Pending Account Email Change and requested Account Email reservation. The current Account Email stays active. Account Email Change OTP Abuse Limit still blocks starting or resending another Account Email Change OTP until it clears.

Developer: Should Pending Account Email Change reserve the requested new email while OTP is still valid?
Domain Expert: Yes. Pending Account Email Change temporarily reserves the requested new Account Email from other accounts while the OTP is valid, so another user cannot take it before verification finishes. The reservation releases when the OTP expires or a newer Account Email Change starts.

Developer: Should a newer Account Email Change request replace an existing Pending Account Email Change before OTP expiry?
Domain Expert: Yes, when the requested Account Email is different. A newer Account Email Change for a different Account Email replaces the existing Pending Account Email Change only after the newer request can send its OTP. Replacement invalidates the old OTP, releases the old requested Account Email reservation, reserves the new requested Account Email, and sends the new OTP. If Account Email Change OTP Abuse Limit blocks the new OTP send, the existing Pending Account Email Change stays unchanged.

Developer: If Account Email Change is requested again for the same requested Account Email as the existing Pending Account Email Change, is it a resend or a replacement?
Domain Expert: Treat it as an Account Email Change OTP resend. If cooldown and Account Email Change OTP Abuse Limit allow it, AnimeX sends a new OTP, invalidates the old OTP, extends OTP expiry, and keeps the same requested Account Email reservation. If resend is blocked, the existing Pending Account Email Change stays unchanged.

Developer: Should users be able to cancel a Pending Account Email Change from Account Settings?
Domain Expert: No. AnimeX does not provide Pending Account Email Change Cancellation. Users can ignore an unwanted Account Email Change OTP until it expires, and the current Account Email stays active.

Developer: After Account Email Change succeeds, should AnimeX notify the old email address?
Domain Expert: Yes. AnimeX sends a Security Email Notice to the previous Account Email with `Your AnimeX account email was changed.` It has no action link in MVP and is separate from In-App Notifications.

Developer: Should Account Email Change require reauthentication before sending OTP to the new email?
Domain Expert: Yes. Accounts with Password Sign-In must re-enter the current password before AnimeX sends OTP to the requested new Account Email. OAuth-only accounts will require fresh OAuth reauthentication when OAuth Sign-Up is implemented. Without successful Account Email Change Reauthentication, AnimeX does not create a Pending Account Email Change or reserve the requested new Account Email.

Developer: What message should appear when current-password reauthentication fails?
Domain Expert: AnimeX shows `Incorrect password.` inline. It does not use Password Sign-In Failure copy, create a Pending Account Email Change, or reserve the requested new Account Email.

Developer: Should wrong current-password attempts in Account Email Change and Account Password Change have abuse protection too?
Domain Expert: Yes. Sensitive Action Abuse Limit temporarily blocks sensitive account changes after too many wrong current-password attempts and shows `Too many attempts. Try again later.` It is separate from Sign-In Abuse Limit and Password Reset Abuse Limit.

Developer: Should Sensitive Action Abuse Limit block both Account Email Change and Account Password Change once triggered?
Domain Expert: Yes. Sensitive Action Abuse Limit is shared across both actions. If either action triggers the limit, AnimeX temporarily blocks both Account Email Change and Account Password Change instead of tracking separate limits per action.

Developer: Should abuse-limit messages show a countdown or exact unlock time?
Domain Expert: No. Abuse Limit Messaging does not show countdowns or exact unlock times. Sign-In Abuse Limit, Sign-Up Abuse Limit, Account Email Change OTP Abuse Limit, and Sensitive Action Abuse Limit use `Too many attempts. Try again later.`, and Password Reset Abuse Limit keeps the generic Password Reset request response.

Developer: Should abuse-limit events send Security Email Notices?
Domain Expert: No. Security Email Notices are only sent for completed account-security changes in MVP: Account Email Change, Account Password Change, and Password Reset success. Sign-In Abuse Limit, Sign-Up Abuse Limit, Password Reset Abuse Limit, Account Email Change OTP Abuse Limit, and Sensitive Action Abuse Limit do not send Security Email Notices.

Developer: Should Security Email Notices include device or location details?
Domain Expert: No. Security Email Notices stay short and privacy-safe in MVP. They include only the event copy, with no device, IP, browser, or location details.

Developer: Should Security Email Notices be sent to unverified Account Emails?
Domain Expert: Yes. Security Email Notices can be sent to an unverified Account Email. Password Reset and Account Password Change send to the current Account Email, and Account Email Change sends to the previous Account Email, even if that destination email is unverified.

Developer: Should users be able to opt out of Security Email Notices?
Domain Expert: No. Security Email Notices are mandatory transactional account-safety emails. They are separate from Notification Preferences and cannot be disabled by users in MVP.

Developer: Should Security Email Notices be sent immediately, or can they be delayed or batched?
Domain Expert: Send immediately. Security Email Notices are account-safety emails and are not delayed or batched in MVP.

Developer: Should a failed Security Email Notice delivery block the completed account-security action?
Domain Expert: No. Security Email Notice delivery failure does not block or undo a completed Account Email Change, Account Password Change, or Password Reset.

Developer: Should a failed Security Email Notice delivery show any user-facing warning after the account action succeeds?
Domain Expert: No. The account-security action shows its normal success state. Security Email Notice delivery failure does not create a user-facing warning or partial-success message in MVP.

Developer: Should users see a history or list of past Security Email Notices inside Account Settings?
Domain Expert: No. Security Email Notices are email-only in MVP. AnimeX does not show a Security Email Notice history or list inside Account Settings.

Developer: After Account Email Change succeeds, should existing sessions stay signed in?
Domain Expert: Yes. Account Email Change Session Retention keeps existing signed-in sessions active. MVP does not force sign-out or include a log-out-other-sessions action for Account Email Change.

Developer: Should users be able to change their password from Account Settings?
Domain Expert: Yes for accounts with Password Sign-In. Account Password Change requires current password, new password, and confirm new password; the new password follows Password Rules, confirm new password must match, and existing signed-in sessions stay active after success. OAuth-only accounts do not use Account Password Change unless they first add Password Sign-In through Password Reset.

Developer: What message should appear when current password is wrong during Account Password Change?
Domain Expert: AnimeX shows `Incorrect password.` inline and does not use Password Sign-In Failure copy.

Developer: After Account Password Change succeeds, should AnimeX send a Security Email Notice?
Domain Expert: Yes. AnimeX sends a Security Email Notice to the current Account Email with `Your AnimeX password was changed.` It has no action link in MVP.

Developer: Should Account Password Change reject using the same password as the current one?
Domain Expert: Yes. The new password must be different from the current password. If they match, AnimeX shows `New password must be different from current password.` inline.

Developer: After Account Password Change succeeds, should AnimeX revoke other sessions or keep all sessions?
Domain Expert: Keep all existing signed-in sessions. Account Password Change Session Retention keeps all existing sessions active and MVP does not include a log-out-other-sessions action for Account Password Change.

Developer: What happens when Simplified Sign-Up or Verification Email Change uses an existing Account Email?
Domain Expert: AnimeX blocks the action inline with `Email already in use. Sign in instead.` Sign-in errors stay generic.

Developer: What happens if the same person tries Simplified Sign-Up again with an Account Email reserved by an Email-Unverified User?
Domain Expert: AnimeX still shows Account Email Conflict copy: `Email already in use. Sign in instead.` If they sign in and are still unverified, AnimeX routes them to the Email OTP Verification Page.

Developer: Can users change Account-Level Default Visibility during sign-up?
Domain Expert: No. Simplified Sign-Up keeps no visibility control; users can change Account-Level Default Visibility later in Privacy Settings.

Developer: Does signup require email verification before content creation?
Domain Expert: Yes. AnimeX uses Email OTP Verification before normal signed-in app access. After signup, the user verifies on the Email OTP Verification Page; if they sign in later with an unverified email, they are signed in but redirected to request a new OTP and verify.

Developer: Are Username and Account Email reserved before Email OTP Verification completes?
Domain Expert: Account Email is reserved because the Email-Unverified User account exists. Username is not reserved before Email OTP Verification; the verified user chooses Username during Username Completion.

Developer: Can Email-Unverified Users fix a mistyped email on the Email OTP Verification Page?
Domain Expert: Yes. Verification Email Change lets them change the email from the Email OTP Verification Page; AnimeX sends a new OTP to the new email and invalidates the old OTP immediately.

Developer: Can Verification Email Change use an Account Email already used by another account?
Domain Expert: No. AnimeX shows Account Email Conflict copy: `Email already in use. Sign in instead.` The current Account Email and current OTP stay unchanged.

Developer: What limits apply to Email OTP Verification?
Domain Expert: Email OTP Limits are 10-minute OTP expiry, 60-second resend cooldown, and 5 wrong attempts before invalidating the current OTP and requiring a new OTP.

Developer: What happens after 5 wrong OTP attempts?
Domain Expert: The current OTP is invalidated immediately, the field is cleared, an inline message appears, and the user must request a new OTP.

Developer: What happens if an OTP expires while the user stays on the verification page?
Domain Expert: The user stays on the Email OTP Verification Page, sees an inline expired message, and can resend when the cooldown allows.

Developer: Does resending OTP keep old OTPs valid?
Domain Expert: No. Every new OTP invalidates older OTPs immediately, so only the latest OTP works.

Developer: Where does successful Email OTP Verification redirect?
Domain Expert: Successful Email OTP Verification redirects to Username Completion when the account has no AnimeX User Record, then Home Feed opens after Username Completion succeeds.

Developer: Does OAuth Sign-Up still need a Username?
Domain Expert: Yes. OAuth Sign-Up supplies external identity and may supply email, but the user still chooses a unique case-insensitive Username before entering the Home Feed; OAuth Sign-Up has no password or password confirmation fields.

Developer: Does OAuth Sign-Up skip Email OTP Verification?
Domain Expert: Yes. OAuth Sign-Up requires provider-verified email and has no AnimeX Email OTP Verification path. If the provider email is missing or unverified, OAuth Sign-Up cannot continue in MVP.

Developer: Should Sign-In and Sign-Up screens both show `Continue with Google`?
Domain Expert: Yes. Both screens use the same OAuth Entry Button copy, `Continue with Google`. The provider result decides the outcome: linked provider account signs in, eligible new provider-verified Account Email starts OAuth Sign-Up, and unavailable Account Email shows `Email already in use. Sign in instead.`

Developer: Which auth visual references are locked?
Domain Expert: Lock the desktop Sign-In reference at `docs/visual/auth/auth-desktop-sign-in.png` and the mobile Create Account reference at `docs/visual/auth/auth-mobile-create-account.png`. Both use the dark AnimeX auth style, consistent `A/X` logo direction, OAuth Entry Button at the top, `or` divider, and flat auth-panel treatment. Do not include mascot art, notebook/notepad, pen imagery, Japanese characters, or Japanese typography in auth screens.

Developer: If OAuth Sign-Up returns an Account Email already used by an existing AnimeX account, should AnimeX auto-link OAuth to that account?
Domain Expert: No. AnimeX blocks OAuth Sign-Up with Account Email Conflict copy: `Email already in use. Sign in instead.` OAuth auto-linking is not part of MVP; any future OAuth account-linking flow should be explicit from Account Settings.

Developer: Should completed password-created users be able to link Google or another OAuth provider later from Account Settings in MVP?
Domain Expert: No. OAuth Account Linking is non-MVP. Completed password-created users cannot add OAuth providers from Account Settings in MVP, and OAuth Sign-Up does not auto-link to existing accounts.

Developer: If the OAuth provider gives no email, should AnimeX ask the user to enter one during OAuth Sign-Up?
Domain Expert: No. OAuth Provider Email Requirement means OAuth Sign-Up needs provider-verified email. If the provider supplies no email, OAuth Sign-Up cannot continue in MVP and the user must use another sign-up method or OAuth provider.

Developer: If OAuth provider gives an unverified email, can the user use Verification Email Change on the Email OTP Verification Page?
Domain Expert: No. OAuth Provider Email Requirement needs provider-verified email. Unverified provider email blocks OAuth Sign-Up before account creation, so AnimeX does not create an OAuth-created Email-Unverified User.

Developer: After OAuth returns with provider-verified email and prefilled Username, should AnimeX create the full account immediately?
Domain Expert: No. AnimeX signs in the provider-verified OAuth user as Pending OAuth Sign-Up after Account Email Conflict checks pass, keeps them on Username completion, lets them sign out, and blocks private pages and private actions until the final Username passes validation. Only then does AnimeX create the AnimeX User Record and Auth-Profile Link.

Developer: If a Pending OAuth Sign-Up user closes the tab, signs out, or clicks Google again later, what happens?
Domain Expert: Closing the tab keeps the current pending session within its normal session lifetime and returns the user to Username completion when AnimeX opens again. Signing out ends the current session, but a later OAuth attempt with the same provider account ID resumes Pending OAuth Sign-Up instead of creating a duplicate account.

Developer: While OAuth Sign-Up is pending, can another user sign up or change email to that same Account Email?
Domain Expert: No. Pending OAuth Sign-Up holds its Account Email unavailable to other sign-ups and Account Email Change until Username completion or Pending OAuth Sign-Up Cleanup.

Developer: How does AnimeX clean up abandoned Pending OAuth Sign-Up records?
Domain Expert: Pending OAuth Sign-Up Cleanup runs weekly and removes only pending auth identities with no Auth-Profile Link, no active pending session, and a last pending session expiry older than 24 hours. It never removes completed AnimeX accounts.

Developer: If the same Google account starts OAuth Sign-Up after cleanup removed the old pending state, should AnimeX resume anything?
Domain Expert: No. AnimeX treats it as a fresh OAuth Sign-Up, revalidates the provider response, reruns Account Email Conflict checks, and opens Username completion again.

Developer: For future OAuth Sign-In, should AnimeX match returning OAuth users by provider account ID, not Account Email?
Domain Expert: Yes. OAuth Sign-In matches by the linked OAuth provider account ID, not Account Email. If the provider account ID is not linked yet and provider email already belongs to an AnimeX account, AnimeX blocks with `Email already in use. Sign in instead.` instead of auto-linking by email.

Developer: If OAuth provider email changes after the account is linked, should AnimeX update Account Email automatically?
Domain Expert: No. This is OAuth Provider Email Drift. OAuth Sign-In still matches by provider account ID, AnimeX Account Email stays unchanged, and the user must use Account Email Change with reauthentication and OTP if they want to update AnimeX Account Email.

Developer: Should Authentication Identity be separate from AnimeX User Record even when both are stored in the same Convex backend through Better Auth and app tables?
Domain Expert: Yes. Better Auth-owned Authentication Identity and AnimeX-owned User Record stay separate ownership records with a one-to-one Auth-Profile Link. Authentication Identity owns Account Email, sign-in methods, sessions, and verification state. AnimeX User Record owns Username, avatar, profile/privacy fields, social/feed ownership, and anime-list data.

Developer: Should OAuth Sign-Up auto-fill display name and avatar from the provider profile?
Domain Expert: OAuth Sign-Up still requires a unique Username and uses that Username as the initial display name. If the OAuth provider supplies a profile picture, AnimeX uses it as the initial User Avatar; otherwise AnimeX uses the initials-based Default Avatar.

Developer: Should OAuth Sign-Up pre-fill Username from the provider account?
Domain Expert: Yes. OAuth Username Autofill pre-fills the Username field from the provider-supplied username when available. The user may edit it, and the final value still must pass Username format, Inline Username Availability, and submit validation.

Developer: If the provider username is invalid or already taken, should AnimeX sanitize it into a suggestion?
Domain Expert: No. Show the provider username as-is in the Username field and show the normal inline validation problem. AnimeX does not generate username suggestions or silently sanitize the provider username.

Developer: Should Username Completion show the pending Account Email?
Domain Expert: Yes. Username Completion shows the Account Email read-only as `Signed in with {Account Email}`. The page lets the user edit only Username, continue after valid Username, or sign out. It does not allow Account Email editing from this step; using another OAuth account requires signing out and starting OAuth again.

Developer: If the OAuth provider profile picture changes later, should AnimeX auto-update User Avatar?
Domain Expert: No. Provider profile picture is an initial OAuth Sign-Up seed only. After sign-up, User Avatar is AnimeX-owned and changes only through user profile avatar actions.

Developer: If the OAuth provider profile picture URL breaks later, should AnimeX keep hotlinking it or copy/store it during OAuth Sign-Up?
Domain Expert: AnimeX copies and stores the provider profile picture as an AnimeX-owned initial User Avatar during OAuth Sign-Up. It does not hotlink the provider image long term, so later provider URL breakage does not affect the stored User Avatar.

Developer: If copying or storing the OAuth provider profile picture fails during OAuth Sign-Up, should sign-up fail?
Domain Expert: No. OAuth Avatar Import Failure is not account-critical. OAuth Sign-Up continues with the initials-based Default Avatar, shows no avatar-specific user-facing error, and lets the user change User Avatar later from the User Profile.

Developer: If `Mika` already exists, can another user register `mika`?
Domain Expert: No. Username uniqueness uses case-insensitive matching, so `Mika` and `mika` collide. User Search Matching still preserves display capitalization.

Developer: What Username format does AnimeX allow?
Domain Expert: Username must be 3-30 characters, use letters, numbers, and underscores only, have no spaces, cannot start or end with an underscore, and preserves typed case for display.

Developer: Does Inline Username Availability check every keystroke?
Domain Expert: No. AnimeX checks after a short typing pause, about 400ms, and validates again on submit.

Developer: After a user signs out, where do they land?
Domain Expert: Post-Sign-Out Landing keeps them on the same page if the page is public. If the page is account-only or non-public, they land on the public Home Feed.

Developer: Can users choose visibility when creating a Post?
Domain Expert: Yes. The Post Composer lets users choose Feed Card Visibility per Post, defaulting to the user's account-level default.

Developer: Do creation surfaces show visibility before publishing?
Domain Expert: Posts and Reviews show a Creation Visibility Selector defaulted to Account-Level Default Visibility, which is Private for new accounts. Generated Activity cards inherit Account-Level Default Visibility silently and can be changed after creation.

Developer: Where does AnimeX mobile navigation live?
Domain Expert: Signed-in mobile Site Navigation uses a bottom tab bar for Home, Discover, Search, Create, and Profile. The mobile Search tab opens the locked Quick Search drawer, the Create tab opens the Post Composer, Notifications stay in the top mobile header, and mobile does not show a separate top-header Search icon. Signed-out users keep the Search tab and drawer without User results, do not see the Create tab, Profile tab, or notification icon, and see `Sign in` in the mobile header instead.

Developer: What is the difference between Discover and Quick Search?
Domain Expert: Discover is a browse destination for trending anime, seasonal anime, genres, recommendations, and full Anime search, with room for future Manga lists. Quick Search uses a desktop modal or mobile drawer with compact live groups for Anime, Characters, Staff, and signed-in Users. View all Anime routes to Discover with the query; other View all links use dedicated result pages. Manga is a future Quick Search group.

Developer: Which Home Feed visual direction is locked?
Domain Expert: Home Feed uses the locked poster-forward design at `docs/visual/home/home-desktop-feed.png` and `docs/visual/home/home-mobile-feed.png`. Desktop has only the main feed column and right utility column; Seasonal Anime sits above the feed; the right utility column includes anime-list modules and Trending, but excludes profile picture, follower/following/likes stats, average rating, and episodes watched. Mobile uses the same theme stacked with bottom navigation.

Developer: Is Quick Search supposed to copy AniList?
Domain Expert: No. AniList is only a reference for the quick overlay interaction. AnimeX Quick Search should use a distinct layout and visual treatment.

Developer: Is Manga available in Quick Search at MVP?
Domain Expert: No. Manga is a future Quick Search group that becomes available when Manga lists become first-class in AnimeX.

Developer: What is the AnimeX Quick Search layout?
Domain Expert: Quick Search has no category selector. Desktop uses a dimmed modal; mobile uses a Base UI-backed bottom drawer with scrollable results and a bottom-pinned search field. Each eligible category shows at most five compact results, with View all links for deeper results.

Developer: Which User Profile visual direction is locked?
Domain Expert: User Profile uses the final-state design at `docs/visual/user-profile/user-profile-desktop-mobile.png`. Phase 7 keeps the poster-forward cover/avatar composition, Activity/Reviews/Favorites tabs, list-progress stats, Latest Favorites, and viewer-allowed Activity while removing social controls/counts, Favorite Genres, and Anime List.

Developer: Which Quick Search visual direction is locked?
Domain Expert: Desktop Quick Search uses the locked modal shell at `docs/visual/quick-search/quick-search-modal.png`; Phase 7 removes its category selector and uses capped Anime, Character, Staff, and eligible User groups. Mobile uses `docs/visual/quick-search/quick-search-mobile-drawer.png`, with a dimmed-page Base UI-backed drawer, scrollable groups, and a bottom-pinned search field. Manga remains future-only.

Developer: How does AnimeX get anime metadata?
Domain Expert: Server-only AniList GraphQL returns candidates. AnimeX stores provider `id` in cache/provider rows, ensures a catalog entity, and returns opaque `publicId` to browser contracts. Provider ID selects metadata; it is not public route or durable client identity.

Developer: How does Discover populate anime cards in MVP?
Domain Expert: Discover reads AnimeX-managed list caches for Trending Anime, Seasonal Anime, Recommendations, and local Genres. Missing or expired caches refresh server-side from AniList, retain provider IDs in cache, ensure catalog identities, and render lightweight summaries with opaque `publicId`. Full details hydrate only when user opens publicId Anime Detail.

Developer: How should favorite anime appear on profiles?
Domain Expert: Profiles preview up to 10 latest favorited anime and include a see more option for the full favorite anime list. This is not a curated top 10.

Developer: Which anime stats should appear on profiles?
Domain Expert: Profiles show completed, watching, planned, and dropped counts. They do not show On Hold, Favorite Genres, average rating, or episodes watched.

## Phase 7 feedback fixes current state

Developer: How does Profile authentication work now?
Domain Expert: `_public/_profile` resolves shared application auth in TanStack Start `beforeLoad` before protected Profile children render. Signed-out, email-unverified, and profile-incomplete requests redirect with validated `returnTo`; auth transport failure shows an actionable Authentication unavailable state. Profile reads and User Search reads use authenticated server facades. Client Convex state is required only for owner edit/media mutations and is never used as a silent read fallback.

Developer: How does the complete-account header identify its owner?
Domain Expert: The shared header uses one circular `UserAvatar` account trigger. Its owner menu contains exactly `Profile` and `Sign out`; Profile uses SPA navigation to the active username, and Sign out navigates to `/home` only after one successful request. Escape, outside click, Enter, and focus restoration stay owned by the Base UI menu.

Developer: Which UserAvatar sizes are canonical?
Domain Expert: Quick Search and the header use 44 px circles. `/search/users` uses a 64 px circle. Profile uses 96 px on phones and 128 px from tablet upward, with fallback glyphs scaled to 36 px and 48 px. UserAvatar is shared by Quick Search, User Search, Feed, and Profile; every box is square, clipped, non-shrinking, and `object-cover`.

Developer: Do Profile tab changes reload the document?
Domain Expert: No. Activity, Reviews, and Favorites use TanStack Router links, preserve the shell and browser history, and load only the selected panel. Successful owner mutations invalidate/refetch Profile data; cancel and failure do not refresh.

Developer: What is the current Character/Staff detail contract?
Domain Expert: Character and Staff use the neutral Anime Detail geometry and expose only Overview and Anime. Staff `?tab=works` is a legacy URL that replaces to `?tab=anime`; detail/work provider and cache identities remain unchanged. Anime keeps its own hero, controls, tabs, and sidebar behavior inside the shared geometry.

Developer: Which Phase 7 browser fixtures remain?
Domain Expert: None remain open. Second-account private-profile, real media lifecycle, and Storage failure/retry checks have recorded browser evidence. User confirmed Phase 7 closure for deep pagination; Codex did not independently exercise that fixture. Phase 7 is merged locally into `dev`; no production push or deploy is claimed.

## Post-Phase 7 Public Catalog Identity current state

Developer: What is public catalog identity?
Domain Expert: `catalogEntities._id` is serialized as opaque `publicId`. `catalogProviderRefs` maps `(provider, kind, providerId)` to one entity. AniList numeric IDs stay server-only provider/cache keys; Character and Staff IDs remain separate kind namespaces.

Developer: Which catalog routes are canonical?
Domain Expert: `/anime/$publicId/$slug`, `/characters/$publicId/$slug`, and `/staff/$publicId/$slug`; Review editor uses `/anime/$publicId/$slug/reviews/new`. Route identity server function validates opaque IDs, resolves legacy positive decimal provider IDs before provider-backed reads, and returns safe route state. Signed-out browser QA proves real Anime and Character provider-ID URLs redirect one way to opaque canonical publicId URLs.

Developer: How do cache and provider flows work?
Domain Expert: AniList GraphQL calls stay in server-only modules. Existing AniList-keyed summary/detail/people/person/work rows, ordered section IDs, image URLs, TTLs, and lease keys remain unchanged. Cache commits ensure bounded catalog identities; reads reverse-resolve `publicId` to provider IDs server-side. Missing or conflicting mappings fail explicitly; no provider-ID fallback.

Developer: Which durable records carry Anime entity refs?
Domain Expert: Additive optional `animeId` refs cover user Anime, rewatches, milestones, Reviews, feed cards, and Review aggregates. Entity indexes drive public reads/writes; legacy `anilistId` fields/indexes remain for migration and provider consistency until separately approved production backfill and schema tightening. Milestone feed source keys use entity IDs after receipt-gated migration.

Developer: What dev migration evidence exists?
Domain Expert: Identity lanes covered 199 summaries, 64 details, 4 Anime people pages, 49 person details, 13 work pages, 5 user Anime rows, 0 rewatches, 4 milestones, 2 Reviews, 6 feed cards, and 1 Review-stat row. Two identity verification cycles reached terminal cursors across 140 pages with zero missing/conflicting mappings. A bounded repair of 49 person-detail rows materialized 24 identities referenced by biography links and independently verified zero missing/conflicting mappings. Durable first pass patched `5/0/4/2/7/1`; reruns patched zero. One explicitly authorized stale derived milestone feed card was deleted after projection-only verification; no Review, Post, or authoritative milestone source row was deleted. Final durable/aggregate checks returned zero issues.

Developer: What remains open?
Domain Expert: Automated gates, integrated review, and signed-out responsive browser QA pass. Both configured AnimeX QA accounts are valid, and authenticated sign-out from Discover and active Anime Detail returns cleanly to signed-out Home after fixing the private-query race. Authenticated Status, Score, Favorite, Rewatch, Review creation/detail, Feed, and Profile browser checks remain open. Production migration, migration-tool removal, legacy-field removal, and required-field schema tightening require separate approval. Metadata Image Proxy remains untouched and unscheduled. Phase 8 remains blocked.
