# Discover Dropdown And Search Score Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove native white filter popups and show scores on every search-result card.

**Architecture:** Install the official shadcn Base UI Select as shared UI, adapt Discover filter values at the feature boundary, and render the existing nullable `averageScore` in search cards.

**Tech Stack:** React 19, TanStack Start, Tailwind CSS v4, shadcn/ui, Base UI, Vitest.

## Tasks

- [x] Add failing tests for numeric and unavailable search-result scores.
- [x] Render accessible top-right score badges and verify focused tests.
- [x] Dry-run, inspect, then add the `base-nova` shadcn Select registry item.
- [x] Add failing filter tests for controlled Base UI selection and themed popup items.
- [x] Migrate all five Discover selects while preserving URL behavior.
- [x] Run focused and full automated gates, review, and responsive browser QA.
- [x] Close `TODO.md` and commit the verified implementation.
