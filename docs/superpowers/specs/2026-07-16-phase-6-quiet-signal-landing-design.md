# Phase 6 Quiet Signal Landing Design

Status: DESIGN SELECTED. Clarifying questions and implementation planning deferred by user.

## Approved Reference

![Quiet Signal landing page](../../visual/landing/quiet-signal-landing-desktop.png)

Reference generated with native `imagegen`. `image-taste-frontend` not used for this option.

## Locked Decisions

- `/` becomes public landing page.
- Signed-out and signed-in visitors both see landing page when opening `/` directly.
- Header reuses existing `/home` site header and auth-aware controls. Mockup does not authorize separate header implementation.
- Hero stays centered and single-purpose: brand signal, slogan, supporting copy, one action.
- Headline: `Find anime worth remembering.`
- Supporting copy: `Build your list. Share what stays with you.`
- Primary action: `Discover anime` → `/discover`.
- Visual language: midnight navy field, faint grid, cyan-to-coral signal rings, oversized outlined `AX`, off-white text, cyan action.
- No anime character, poster, feed, statistic, badge, or secondary-action content in hero.

## Phase Order

- Quiet Signal Landing becomes Phase 6.
- Profile And Social moves from Phase 6 to Phase 7.
- Notifications, Privacy, Moderation moves from Phase 7 to Phase 8.

## Deferred Work

Later session owns clarifying questions and detailed plan. Topics include responsive translation, mobile composition, motion, reduced-motion behavior, exact token mapping, component boundaries, route tests, browser QA, and validation commands.

No implementation starts before plan approval.
