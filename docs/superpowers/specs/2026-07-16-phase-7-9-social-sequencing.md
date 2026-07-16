# Phase 7-9 Social Sequencing

Status: APPROVED. Scheduling contract locked; implementation planning starts later.

## Phase Map

- Pre-Phase 7: Social UI Embargo Cleanup.
- Phase 7: User Profile.
- Phase 8: Notifications, Privacy, Moderation.
- Phase 9: Social Interactions. Final MVP phase.

## Social UI Embargo

Before Phase 7, all existing social interaction UI must be absent from the DOM:

- Follow and Unfollow actions.
- Follower and following counts.
- Following feed tabs, empty states, and direct query selection.
- Feed-card Like and Comment actions.
- Review Like actions and visible Like counts.
- Comment, Comment Reply, Reply Tag, and Comment Like surfaces.
- Social counts and activity footers.
- Followers-only choices in creation, owner-action, discovery-filter, and privacy-setting UI.
- Disabled or phase-labeled social placeholders.

Do not use CSS hiding. Do not leave disabled controls. Direct Following-feed selection normalizes to Home.

## Preserved Backend Contracts

- Keep social schemas, validators, authorization rules, and stored values.
- Keep Public, Followers only, and Private storage semantics.
- Keep existing Followers-only content readable under current access rules.
- During the embargo, owners may change existing Followers-only content to Public or Private.
- Do not expose a new Followers-only selection until Phase 9.

## Phase 7: User Profile

Phase 7 shows:

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
- Pre-Phase 7 cleanup receives a separate detailed implementation plan later.
- Phase 7, Phase 8, and Phase 9 each receive separate approved design/spec and implementation plans.
- No source implementation is authorized by this scheduling update.
