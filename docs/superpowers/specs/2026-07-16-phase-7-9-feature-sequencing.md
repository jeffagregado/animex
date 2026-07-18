# Phase 7-9 Feature Sequencing

Status: ACTIVE. Pre-Phase 7 embargo and Phase 7 are complete. Phase 8 is next; Phase 9 remains the final MVP phase.

## Phase Map

- Pre-Phase 7: Social UI Embargo Cleanup.
- Phase 7: User Profile, Catalog People, and Quick Search.
- Phase 8: Notifications, Privacy, Moderation.
- Phase 9: Social Interactions. Final MVP phase.

## Social UI Embargo

Active UI through Phase 8 keeps these social surfaces absent from the DOM:

- Follow and Unfollow actions.
- Follower and following counts.
- Following feed tabs, empty states, and direct query selection.
- Feed-card Like and Comment actions.
- Review Like actions and visible Like counts.
- Comment, Comment Reply, Reply Tag, and Comment Like surfaces.
- Social counts and activity footers.
- Followers-only choices in creation, owner-action, discovery-filter, and privacy-setting UI.
- Disabled or phase-labeled social placeholders.

No CSS hiding or disabled controls remain. Home exposes Home and Global. Direct stale Following-feed selection replaces to Home before a Following query mounts. Review discovery exposes All, Public, and My Private; stale Followers selection replaces before discovery queries mount.

## Preserved Backend Contracts

- Keep social schemas, validators, authorization rules, and stored values.
- Keep Public, Followers only, and Private storage semantics.
- Keep existing Followers-only content readable under current access rules.
- During the embargo, owners may change existing Followers-only content to Public or Private.
- Unrelated edits preserve existing Followers visibility.
- A Followers account default maps to Private for new Posts and Reviews.
- Do not expose a new Followers-only selection until Phase 9.
- No migration rewrites stored Followers data.

## Phase 7: User Profile, Catalog People, And Quick Search

Phase 7 profile shows:

- Signed-in `/users/:username` profile access.
- Profile cover, avatar, display name, username, and bio.
- Activity default plus Reviews and Favorites `tab` query states.
- Latest 10 favorited anime plus full Favorites tab.
- Completed, watching, planned, and dropped stats only.
- Viewer-allowed profile activity.
- Separate Public/Private Profile Visibility. Private shows header identity/bio and a privacy notice to non-owners while hiding stats, favorites, Reviews, and Activity.
- Guided 1:1 avatar and 4:1 banner media editing backed by Convex Storage.

Phase 7 omits:

- Follow actions.
- Follower and following counts.
- Like and Comment actions or counts.
- Social activity footers.
- Favorite Genres and Anime List.
- Followers Profile Visibility.

Locked profile visual reference remains final-state direction. Phase 7 implements only non-social elements.

Phase 7 Catalog People includes:

- Public `/characters/:id/:slug` destinations with Overview and Anime.
- Public `/staff/:id/:slug` destinations with Overview and Anime; legacy `?tab=works` canonicalizes to `?tab=anime`.
- Canonical numeric identity with display-only slugs and redirect correction.
- Provider-neutral normalized detail/work contracts and 24-hour caches.
- Character/Staff destinations completed before Quick Search entry points ship.

Phase 7 Quick Search includes:

- Focused dimmed-page overlay using the locked Quick Search visual reference.
- Large live-search input.
- Desktop header Search entry for signed-out and signed-in visitors.
- Mobile drawer entry from the bottom Search tab using `docs/visual/quick-search/quick-search-mobile-drawer.png`; its search field stays pinned at the bottom while results scroll.
- Compact ranked groups capped at five results for Anime, Characters, Staff, and signed-in Users; signed-out search omits Users.
- No category-selection controls.
- View all Anime routes to `/discover?q=...`, Characters to `/search/characters?q=...`, Staff to `/search/staff?q=...`, and Users to signed-in `/search/users?q=...`.
- Explicit loading, empty, error, keyboard, focus, scroll, dismissal, and responsive states.
- Existing canonical destination behavior where supported by the selected result.

Desktop uses the locked dimmed modal shell. Mobile uses the locked Base UI-backed bottom drawer rather than the desktop modal. Discover remains separate from Quick Search and receives only the View all Anime destination. Manga remains a future-only Quick Search group.

## Phase 8: Notifications, Privacy, Moderation

Phase 8 includes:

- Notification preview/page foundations.
- Required moderation notifications.
- Public and Private default/bulk visibility UI.
- Block and Unblock.
- Post and Review reports/moderation.
- No reports for generated anime-status activity.

Phase 8 defers to Phase 9:

- Follow, Like, Comment, and Comment Reply notifications.
- Social notification preferences and deduplication.
- Followers-only visibility UI.
- Comment and Comment Reply reports/moderation.
- Block enforcement tied to deferred social mutations.

No social interaction UI appears during Phase 8.

## Phase 9: Social Interactions

Phase 9 owns:

- Follow/Unfollow, follower/following counts, Following feed, and Followers-only UI.
- Feed-card Likes, Review Likes, Comment Likes, and visible counts.
- Text-only Comments.
- Flat Comment Replies and removable Reply Tags.
- Social reports, moderation, and Block enforcement.
- Social notifications, preferences, target access, and deduplication.
- Functional social UI across feed, Review, User Profile, notification, privacy, Block, report, and moderation surfaces.

Phase 9 acceptance requires every approved social control to be visible and functional. No disabled social placeholder remains.

## Planning Boundary

- This document locks scheduling and visibility only.
- Pre-Phase 7 cleanup is complete under its approved design and implementation plan.
- Phase 7 completed under one approved design/spec and implementation plan covering User Profile, Catalog People, and Quick Search.
- Phase 8 and Phase 9 each receive separate approved design/spec and implementation plans.
- Phase 7 design is implemented under `2026-07-17-phase-7-user-profile-quick-search-design.md`; its implementation plan is `../plans/2026-07-17-phase-7-user-profile-catalog-people-quick-search.md`. Implementation, review, local merge into `dev`, and user-confirmed closure are complete. Phase 9 retains social UI reactivation ownership.
