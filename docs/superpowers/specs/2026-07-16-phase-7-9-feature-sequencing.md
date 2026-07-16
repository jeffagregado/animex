# Phase 7-9 Feature Sequencing

Status: ACTIVE. Pre-Phase 7 embargo is implemented and validated. Phase 7 is next and unstarted.

## Phase Map

- Pre-Phase 7: Social UI Embargo Cleanup.
- Phase 7: User Profile and Quick Search.
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

## Phase 7: User Profile And Quick Search

Phase 7 profile shows:

- Profile cover, avatar, display name, username, and bio.
- Review tab.
- Latest 10 favorited anime plus full-list route.
- Anime stats.
- Viewer-allowed profile activity.

Phase 7 omits:

- Follow actions.
- Follower and following counts.
- Like and Comment actions or counts.
- Social activity footers.

Locked profile visual reference remains final-state direction. Phase 7 implements only non-social elements.

Phase 7 desktop Quick Search includes:

- Focused dimmed-page overlay using the locked Quick Search visual reference.
- Large live-search input.
- Desktop header Search entry for signed-out and signed-in visitors.
- Desktop category controls, optionally using a left rail.
- One unified ranked result list grouped by Anime, Characters, and Users.
- Explicit loading, empty, error, keyboard, focus, and desktop responsive states.
- Existing canonical destination behavior where supported by the selected result.

Mobile does not render Quick Search. Mobile Search navigation routes to `/discover` and uses the existing Discover search. Discover remains separate from desktop Quick Search and serves as the mobile search destination. Manga remains a future-only Quick Search group.

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
- Phase 7 receives one approved design/spec and implementation plan covering User Profile and Quick Search.
- Phase 8 and Phase 9 each receive separate approved design/spec and implementation plans.
- Phase 7 implementation has not started. Phase 9 retains social UI reactivation ownership.
