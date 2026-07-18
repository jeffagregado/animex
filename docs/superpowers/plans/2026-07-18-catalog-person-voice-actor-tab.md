# Catalog Person Voice Actor Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Character pages a full-width Voice Actors tab containing every AniList dub language, and place Facts above About in the full-width Overview tab for both Character and Staff.

**Architecture:** Extend the kind-safe tab contract with Character-only `voice-actors`. Character detail fetches every Anime media page using AniList connection `hasNextPage`, normalizes and deduplicates all voice actors by Staff ID, and marks the cached payload as all-language complete so Japanese-only legacy rows refresh. Catalog Person renders one full-width shell: Overview owns Facts then About, Anime owns works, and Character Voice Actors reuses the existing linked portrait card.

**Tech Stack:** TanStack Start, TanStack Router, React 19, Convex, Zod, AniList GraphQL, Vitest, Testing Library, Tailwind CSS.

## Global Constraints

- Add no production dependency.
- Character tabs: Overview, Anime, Voice Actors.
- Staff tabs: Overview, Anime.
- Voice Actors URL: `?tab=voice-actors`.
- Show every validated language returned across all non-adult Character Anime relationships.
- Keep actor links canonical and `preload={false}`.
- Facts render before About on Character and Staff Overview.
- Catalog Person has no right column; Anime Detail layout remains unchanged.
- Preserve explicit cache, provider, loading, empty, error, keyboard, and responsive behavior.

---

### Task 1: Lock all-language data and cache completeness

**Files:**
- Modify: `src/features/catalog-person/shared/catalog-person-contracts.test.ts`
- Modify: `src/features/catalog-person/server/anilist-person.server.test.ts`
- Modify: `convex/catalogPersonCachePolicy.test.ts`
- Modify: `convex/catalogPersonCache.integration.test.ts`
- Modify: fixtures in existing Catalog Person cache/function/route tests

**Interfaces:**
- Produces: `CatalogVoiceActor.language: string`.
- Produces: required Character `voiceActorScope: 'all-languages'`.
- Produces: complete, actor-ID-deduplicated `voiceActors`.

- [x] **Step 1: Write failing contract tests**

Assert Character detail accepts Japanese and English actors, rejects blank languages and duplicate Staff IDs, and requires `voiceActorScope: 'all-languages'`.

- [x] **Step 2: Write failing adapter pagination test**

Return Character media page 1 with Japanese and English actors plus `hasNextPage: true`; return page 2 with another language and a repeated actor. Assert all three unique Staff IDs survive in first-seen order and requests use pages 1 and 2 with `perPage: 25`.

- [x] **Step 3: Write failing cache migration test**

Insert a legacy Character row without `voiceActorScope`. Assert `readDetail` returns `expired`; assert an all-language row returns `fresh`.

- [x] **Step 4: Run focused tests and verify RED**

```powershell
pnpm test -- src/features/catalog-person/shared/catalog-person-contracts.test.ts src/features/catalog-person/server/anilist-person.server.test.ts convex/catalogPersonCachePolicy.test.ts convex/catalogPersonCache.integration.test.ts
```

Expected: failures for the old Japanese literal, single-page payload, and missing completeness marker.

### Task 2: Implement complete all-language normalization

**Files:**
- Modify: `src/features/catalog-person/shared/catalog-person-contracts.ts`
- Modify: `src/features/catalog-person/server/anilist-person.schemas.ts`
- Modify: `src/features/catalog-person/server/anilist-person.server.ts`
- Modify: `convex/schema.ts`
- Modify: `convex/catalogPersonCache.ts`

**Interfaces:**
- Consumes: AniList Character `media(page, perPage: 25)` connection pages.
- Produces: strict all-language Character detail cached for 24 hours.

- [x] **Step 1: Widen the strict actor language**

Use non-empty trimmed strings for `CatalogVoiceActor.language`; retain unique positive Staff IDs and HTTPS-or-null portraits. Replace the actor-count cap with the complete deduplicated list.

- [x] **Step 2: Add paginated Character media schemas**

Require `pageInfo.currentPage`, `pageInfo.hasNextPage`, non-adult marker, and strict voice-actor role data on each detail/media response.

- [x] **Step 3: Fetch every Character Anime media page**

Request page 1 with Character metadata, then request each subsequent media page while `hasNextPage` is true. Require the returned Character ID and current page to match every request. Normalize non-adult edges, retain every language, deduplicate by Staff ID, and preserve first-seen order.

- [x] **Step 4: Make cache completeness explicit**

Store `voiceActorScope: 'all-languages'`. Keep the Convex storage field optional only for rolling migration; `readDetail` expires Character rows without the marker.

- [x] **Step 5: Run focused data tests and verify GREEN**

Run Task 1’s command. Expected: PASS.

### Task 3: Lock route and full-width tab behavior

**Files:**
- Modify: `src/features/catalog-person/shared/catalog-person-contracts.test.ts`
- Modify: `src/routes/_public/-catalog-person-route.test.ts`
- Modify: `src/features/catalog-person/ui/catalog-person-page.test.tsx`

**Interfaces:**
- Produces: `CatalogPersonTab = 'overview' | 'anime' | 'voice-actors'`.
- Produces: Character-only Voice Actors navigation.
- Produces: full-width Overview Facts-before-About order.

- [x] **Step 1: Write failing tab-contract tests**

Assert Character accepts and navigates `voice-actors`; Staff rejects and canonicalizes it to Overview.

- [x] **Step 2: Write failing UI tests**

Assert Character has three tabs; Overview has Facts before About and no actor cards; Voice Actors reuses portrait cards for Japanese and English actors; empty actors show `No voice actors available.` Staff has two tabs, Facts before About, and no Voice Actors tab. Assert the Catalog Person main shell has no desktop right-column class.

- [x] **Step 3: Extend keyboard tests**

Assert Arrow Right, Home, and End use the visible kind-specific tab list: three Character tabs and two Staff tabs.

- [x] **Step 4: Run focused route/UI tests and verify RED**

```powershell
pnpm test -- src/features/catalog-person/shared/catalog-person-contracts.test.ts src/routes/_public/-catalog-person-route.test.ts src/features/catalog-person/ui/catalog-person-page.test.tsx
```

Expected: failures because the third tab and full-width Overview composition are absent.

### Task 4: Implement Character-only Voice Actors tab and full-width Overview

**Files:**
- Modify: `src/features/catalog-person/shared/catalog-person-contracts.ts`
- Modify: `src/features/catalog-person/ui/catalog-person-route.ts`
- Modify: `src/features/catalog-person/ui/catalog-person-page.tsx`
- Modify: `src/routes/_public/characters/$id/index.tsx`
- Modify: `src/routes/_public/characters/$id/$slug/route.tsx`

**Interfaces:**
- Consumes: all-language `CatalogPersonDetail.voiceActors`.
- Produces: full-width Catalog Person tab panels with canonical search state.

- [x] **Step 1: Add kind-safe tab parsing and navigation**

Accept `voice-actors` only for Character. Character route search retains it; Staff route behavior and legacy `works` migration remain unchanged.

- [x] **Step 2: Render kind-specific tabs**

Use Overview/Anime/Voice Actors for Character and Overview/Anime for Staff. Roving focus derives from the visible list.

- [x] **Step 3: Move Facts into Overview**

Render Facts first and About second with full-width spacing. Remove the Catalog Person aside and its desktop two-column geometry without changing `DetailPageLayout` or Anime Detail.

- [x] **Step 4: Reuse the actor card in its tab**

Render all actor cards in the Voice Actors panel with portrait, name, language, canonical Staff link, focus ring, and disabled intent preload.

- [x] **Step 5: Run focused route/UI tests and verify GREEN**

Run Task 3’s command. Expected: PASS.

### Task 5: Validate, document, and close

**Files:**
- Modify: `docs/architecture/catalog-person-data-flow.md`
- Modify: `TODO.md`

- [x] **Step 1: Push Convex development schema**

```powershell
pnpm exec convex dev --once
```

- [x] **Step 2: Run automated gates**

Run focused tests, full `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm build`, changed-scope React Doctor, Fallow audit against `HEAD`, and `git diff --check`.

- [x] **Step 3: Run browser QA**

At 390, 768, and 1280 px, verify Character Overview Facts-before-About, Character Voice Actors all-language cards and Staff links, Staff Overview, tab mouse/keyboard/history/reload behavior, empty state, no right column or horizontal overflow, and clean browser/server logs.

- [x] **Step 4: Run spec and thermo review**

Confirm no optional shared-layout prop, mode flag, generic helper, weakened cache boundary, stale Japanese-only copy, or simpler local implementation remains.

- [x] **Step 5: Update current-state docs and TODO**

Replace sidebar/Japanese-only documentation with the final all-language tab, cache-completeness marker, full-width geometry, and completed validation evidence.
