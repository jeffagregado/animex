# Review Layout, Media, And Checkbox Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove shared Review-card overlap, widen Home desktop utility column to 430px, render Review/Post images at responsive 4:5 geometry, and replace native standalone checkboxes with official shadcn Base UI Checkbox.

**Architecture:** One shared Checkbox primitive lands first. Three disjoint UI slices then update shared Review listing layout, Review editor/renderer media, and Home/Post media. Routes, Convex, persistence, linked-video cards, and Anime Detail trailer stay unchanged.

**Tech Stack:** React 19, TanStack Start, Tailwind CSS v4, shadcn source components, Base UI, Vitest, Testing Library, React Doctor, Fallow.

## Global Constraints

- Work only on `jeff-cx/phase-5-feed-reviews`.
- Accepted design contract: `docs/superpowers/specs/2026-07-15-review-layout-media-checkbox-feedback-design.md`.
- No production dependency, Convex, route, cache, generated-file, or data migration change.
- Check official shadcn Base UI registry before creating shared UI. Use direct `base-nova` Checkbox registry item.
- Preserve existing Review/Post data flow, validation, visibility, links, video cards, and Anime Detail trailer.
- Use Tailwind utilities; no new CSS file or global aspect-token override.
- Preserve one accessible Rating node. Never duplicate mobile/desktop Rating markup.
- Use exact responsive rule: full-width images below `sm`; left-aligned `sm:max-w-[65%]` from `sm` upward.
- Workers do not edit `TODO.md`, accepted spec, plan, dependencies, generated files, or `skills-lock.json`.
- Controller owns integration, docs, final commands, browser QA, and commits after worker review.

## Execution And Ownership

Mode: standing orchestration. Task 1 runs first and locks `src/components/ui/checkbox.tsx`. After controller releases that lock, Tasks 2–4 may run in parallel because write sets are disjoint.

| Task | Owner | Write set |
| --- | --- | --- |
| 1 | Shared UI worker | Checkbox component and its test only |
| 2 | Review card worker | Published Review card and test only |
| 3 | Review editor worker | Review editor, Review image node/renderer, and matching tests |
| 4 | Feed/Home worker | Feed grid, Post composer/media, and matching tests |
| 5 | Controller + read-only reviewer/QA/docs mapper | Integration, validation, tracker/spec state |

---

### Task 1: Official Base UI Checkbox Foundation

**Files:**

- Create: `src/components/ui/checkbox.tsx`
- Create: `src/components/ui/checkbox.test.tsx`
- Read-only: `components.json`
- Read-only: `package.json`

**Interfaces:**

- Consumes: `CheckboxPrimitive.Root.Props` from `@base-ui/react/checkbox`.
- Produces: named `Checkbox` export accepting Base UI Root props.
- Lock release: controller confirms focused test passes and no dependency/config drift exists.

- [ ] **Step 1: Write failing shared-component behavior test**

```tsx
// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Checkbox } from './checkbox'

function CheckboxProbe({ disabled }: { disabled: boolean }) {
  const [checked, setChecked] = useState(false)
  return <div>
    <Checkbox checked={checked} disabled={disabled} id="probe" onCheckedChange={setChecked} />
    <label htmlFor="probe">Probe</label>
  </div>
}

afterEach(cleanup)

describe('Checkbox', () => {
  it('toggles through associated label and exposes checked state', () => {
    render(<CheckboxProbe disabled={false} />)
    const checkbox = screen.getByRole('checkbox', { name: 'Probe' })
    fireEvent.click(screen.getByText('Probe'))
    expect(checkbox.getAttribute('aria-checked')).toBe('true')
    expect(checkbox.getAttribute('data-checked')).not.toBeNull()
  })

  it('does not toggle while disabled', () => {
    render(<CheckboxProbe disabled />)
    const checkbox = screen.getByRole('checkbox', { name: 'Probe' })
    fireEvent.click(screen.getByText('Probe'))
    expect(checkbox.getAttribute('aria-checked')).toBe('false')
  })
})
```

- [ ] **Step 2: Run RED test**

```powershell
pnpm exec vitest run src/components/ui/checkbox.test.tsx
```

Expected: FAIL because `src/components/ui/checkbox.tsx` does not exist.

- [ ] **Step 3: Dry-run official Base UI registry item**

```powershell
pnpm dlx shadcn@latest add https://ui.shadcn.com/r/styles/base-nova/checkbox.json --dry-run --diff
```

Expected: one new Checkbox UI file; `@base-ui/react` already satisfies runtime dependency. Stop and report exact diff if command proposes Radix, package replacement, global style migration, or unrelated file overwrite.

- [ ] **Step 4: Add and adapt upstream Checkbox**

```tsx
import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import { CheckIcon } from 'lucide-react'

import { cn } from '#/lib/utils'

/** Renders AnimeX themed standalone checkbox. */
export function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return <CheckboxPrimitive.Root
    className={cn('peer relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-border bg-card text-background outline-none transition-colors after:absolute after:-inset-x-3 after:-inset-y-2 hover:border-cyan-300 focus-visible:border-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-50 data-checked:border-cyan-300 data-checked:bg-cyan-300', className)}
    data-slot="checkbox"
    {...props}
  >
    <CheckboxPrimitive.Indicator className="grid place-content-center text-current [&>svg]:size-3.5" data-slot="checkbox-indicator">
      <CheckIcon aria-hidden="true" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
}
```

Preserve official Root/Indicator structure. Use Lucide directly; do not copy registry-only `IconPlaceholder`.

- [ ] **Step 5: Run GREEN test and drift checks**

```powershell
pnpm exec vitest run src/components/ui/checkbox.test.tsx
git diff -- package.json pnpm-lock.yaml components.json src/styles.css
```

Expected: Checkbox test passes; dependency, lockfile, shadcn config, and global styles show no diff.

- [ ] **Step 6: Commit foundation**

```powershell
git add src/components/ui/checkbox.tsx src/components/ui/checkbox.test.tsx
git commit -m "feat: add Base UI checkbox"
```

---

### Task 2: Shared Published Review Card Mobile Layout

**Files:**

- Modify: `src/features/reviews/ui/published-review-card.tsx`
- Modify: `src/features/reviews/ui/published-review-card.test.tsx`

**Interfaces:**

- Consumes: unchanged `ReviewListItem`.
- Produces: unchanged `PublishedReviewCard({ review })` used by `/reviews` and Anime Detail Reviews.

- [ ] **Step 1: Write RED layout assertions**

Extend existing metadata test:

```tsx
const rating = screen.getByLabelText('Rating: 90 out of 100')
const detail = screen.getByRole('link', { name: 'Review Detail' })

expect(screen.getAllByLabelText('Rating: 90 out of 100')).toHaveLength(1)
expect(rating.className).toContain('col-start-2')
expect(rating.className).toContain('row-start-3')
expect(rating.className).toContain('justify-self-start')
expect(rating.className).toContain('sm:absolute')
expect(detail.parentElement?.className).toContain('row-start-3')
expect(detail.parentElement?.className).toContain('justify-self-end')
```

Add long-content case with long anime title, author, and Summary. Assert title still uses `truncate`, content uses `min-w-0`, and Rating/Detail keep separate start/end alignment.

- [ ] **Step 2: Run RED test**

```powershell
pnpm exec vitest run src/features/reviews/ui/published-review-card.test.tsx
```

Expected: FAIL because Rating remains inside absolute top-right stack.

- [ ] **Step 3: Reposition one Rating node through responsive grid**

Use `cn` for spoiler-dependent desktop top offset:

```tsx
const ratingTop = review.containsSpoiler ? 'sm:top-14' : 'sm:top-4'

{review.containsSpoiler ? <div className="absolute top-4 right-4"><ReviewSpoilerBadge /></div> : null}
<p
  aria-label={`Rating: ${review.rating} out of 100`}
  className={cn('col-start-2 row-start-3 self-end justify-self-start text-xl font-black text-cyan-300 sm:absolute sm:right-4 sm:text-3xl', ratingTop)}
>
  {review.rating}<span className="text-sm font-normal text-muted-foreground sm:text-base">/100</span>
</p>
<div className="col-start-2 row-start-3 flex min-w-0 self-end justify-self-end sm:col-start-3 sm:row-span-3 sm:row-start-1 sm:flex-col sm:justify-end">
  <a className="inline-flex min-h-11 items-center gap-1 font-bold text-cyan-300 hover:text-cyan-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" href={`/reviews/${review.id}`}>
    Review Detail<ChevronRightIcon aria-hidden="true" className="size-4" />
  </a>
</div>
```

Keep title, metadata, Summary, cover, hrefs, and desktop three-column geometry unchanged.

- [ ] **Step 4: Run shared-card and consumer tests**

```powershell
pnpm exec vitest run src/features/reviews/ui/published-review-card.test.tsx src/features/reviews/discovery/review-discovery-page.test.tsx src/features/reviews/ui/anime-reviews-panel.behavior.test.tsx
```

Expected: all pass; both consumers still render shared component contract.

- [ ] **Step 5: Commit Review layout**

```powershell
git add src/features/reviews/ui/published-review-card.tsx src/features/reviews/ui/published-review-card.test.tsx
git commit -m "fix: prevent mobile review card overlap"
```

---

### Task 3: Review Image Geometry And Checkbox Migration

**Files:**

- Modify: `src/features/reviews/lexical/review-image-node.tsx`
- Modify: `src/features/reviews/ui/review-document-renderer.tsx`
- Modify: `src/features/reviews/ui/review-document-renderer.test.tsx`
- Modify: `src/features/reviews/ui/review-media-editing-plugin.test.tsx`
- Modify: `src/features/reviews/ui/review-editor-page.tsx`
- Modify: `src/features/reviews/ui/review-editor-page.test.tsx`

**Interfaces:**

- Consumes: Task 1 `Checkbox`; unchanged Lexical node/document contracts.
- Produces: Review image parent geometry shared by editor, Preview, and published rendering.

- [ ] **Step 1: Write RED Review media assertions**

In renderer test:

```tsx
const image = screen.getByAltText('Frieren sunset')
const figure = image.closest('figure')
expect(image.className).toContain('aspect-4/5')
expect(figure?.className).toContain('w-full')
expect(figure?.className).toContain('sm:max-w-[65%]')
fireEvent.error(image)
expect(screen.getByText('Image unavailable').parentElement?.parentElement?.className).toContain('aspect-4/5')
expect(screen.getByRole('link', { name: /Official trailer/ }).className).not.toContain('max-w-[65%]')
```

In media-editing test, assert selected Review image parent contains `w-full sm:max-w-[65%]` and child image contains `aspect-4/5`.

- [ ] **Step 2: Write RED Review Checkbox assertions**

Extend editor-page test:

```tsx
const checkbox = screen.getByRole('checkbox', { name: 'Review contains spoiler' })
expect(checkbox.tagName).toBe('BUTTON')
expect(document.querySelector('input[type="checkbox"]')).toBeNull()
fireEvent.click(screen.getByText('Review contains spoiler'))
expect(checkbox.getAttribute('aria-checked')).toBe('true')
```

Keep existing Update mutation assertion for `containsSpoiler: true`.

- [ ] **Step 3: Run RED tests**

```powershell
pnpm exec vitest run src/features/reviews/ui/review-document-renderer.test.tsx src/features/reviews/ui/review-media-editing-plugin.test.tsx src/features/reviews/ui/review-editor-page.test.tsx
```

Expected: FAIL on old 16:9/full-width image and native input.

- [ ] **Step 4: Apply Review image geometry**

```tsx
// Editor node parent
<div className={cn('w-full rounded-lg sm:max-w-[65%]', isSelected && 'ring-2 ring-cyan-300')} data-review-media>
  <img alt={alt} className="aspect-4/5 w-full rounded-lg border border-border object-cover" src={url} />
</div>

// Preview/published renderer parent
<figure className="w-full overflow-hidden rounded-lg border border-border bg-card sm:max-w-[65%]">
  {failed
    ? <div className="grid aspect-4/5 place-items-center text-muted-foreground"><span className="flex items-center gap-2"><ImageOffIcon className="size-5" />Image unavailable</span></div>
    : <img alt={alt} className="aspect-4/5 w-full object-cover" onError={() => setFailed(true)} src={url} />}
</figure>
```

Import and use existing `cn` in Review image node. Do not change `ReviewVideo`.

- [ ] **Step 5: Replace Review native checkbox**

```tsx
import { Checkbox } from '#/components/ui/checkbox'

<div className="flex min-h-11 w-full items-center justify-end gap-2 text-sm text-muted-foreground md:col-span-3" data-review-spoiler-row>
  <Checkbox checked={fields.containsSpoiler} id="review-contains-spoiler" onCheckedChange={(checked) => onChange('containsSpoiler', checked)} />
  <label htmlFor="review-contains-spoiler">Review contains spoiler</label>
</div>
```

Keep field state, persistence, and row alignment unchanged.

- [ ] **Step 6: Run Review regression tests**

```powershell
pnpm exec vitest run src/features/reviews/ui/review-document-renderer.test.tsx src/features/reviews/ui/review-media-editing-plugin.test.tsx src/features/reviews/ui/review-preview.test.tsx src/features/reviews/ui/review-editor-page.test.tsx src/features/reviews/ui/review-toolbar.test.tsx
```

Expected: all pass; editor/Preview/published image parity holds; video remains unchanged.

- [ ] **Step 7: Commit Review media and checkbox**

```powershell
git add src/features/reviews/lexical/review-image-node.tsx src/features/reviews/ui/review-document-renderer.tsx src/features/reviews/ui/review-document-renderer.test.tsx src/features/reviews/ui/review-media-editing-plugin.test.tsx src/features/reviews/ui/review-editor-page.tsx src/features/reviews/ui/review-editor-page.test.tsx
git commit -m "fix: align review media and spoiler control"
```

---

### Task 4: Home Width And Post Image/Checkbox Consistency

**Files:**

- Modify: `src/features/feed/feed-page.tsx`
- Modify: `src/features/home/home-page.test.tsx`
- Modify: `src/features/feed/post-media-card.tsx`
- Modify: `src/features/feed/post-media-card.test.tsx`
- Modify: `src/features/feed/post-composer.tsx`
- Modify: `src/features/feed/post-composer.test.tsx`

**Interfaces:**

- Consumes: Task 1 `Checkbox`; unchanged Post media and composer contracts.
- Produces: 430px Home desktop utility column and Review-consistent Post image geometry.

- [ ] **Step 1: Write RED Home layout assertion**

Add to signed-out Home integration test:

```tsx
const sidebar = screen.getByLabelText('Home utility column')
expect(sidebar.parentElement?.className).toContain('lg:grid-cols-[minmax(0,1fr)_430px]')
```

- [ ] **Step 2: Write RED Post media and Checkbox assertions**

```tsx
const image = screen.getByRole('img', { name: 'Image attached to post by mika' })
const media = image.parentElement
expect(media?.className).toContain('aspect-4/5')
expect(media?.className).toContain('w-full')
expect(media?.className).toContain('sm:max-w-[65%]')

const checkbox = screen.getByRole('checkbox', { name: 'Hide whole Post as spoiler' })
expect(checkbox.tagName).toBe('BUTTON')
fireEvent.click(screen.getByText('Hide whole Post as spoiler'))
expect(mocks.composer.setHasSpoiler).toHaveBeenCalledWith(true)
```

Also assert linked-video card lacks `aspect-4/5` and `max-w-[65%]`.

- [ ] **Step 3: Run RED tests**

```powershell
pnpm exec vitest run src/features/home/home-page.test.tsx src/features/feed/post-media-card.test.tsx src/features/feed/post-composer.test.tsx
```

Expected: FAIL on 320px sidebar, 16:9/full-width Post image, and native checkbox.

- [ ] **Step 4: Apply Home and Post changes**

```tsx
// feed-page.tsx
<div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_430px]">

// post-media-card.tsx image branch only
<div className="mt-3 aspect-4/5 w-full max-h-[32rem] overflow-hidden rounded-lg border border-white/10 bg-black/20 sm:max-w-[65%]">

// post-composer.tsx
<div className="flex min-h-11 items-center gap-3 rounded-lg border border-white/10 px-3">
  <Checkbox checked={composer.hasSpoiler} disabled={composer.submitting} id="post-has-spoiler" onCheckedChange={composer.setHasSpoiler} />
  <label htmlFor="post-has-spoiler">Hide whole Post as spoiler</label>
</div>
```

Do not change video card, Home max width, sidebar visibility breakpoint, feed pagination, or composer persistence.

- [ ] **Step 5: Run Home/Post regression tests**

```powershell
pnpm exec vitest run src/features/home/home-page.test.tsx src/features/home/home-sidebar.test.tsx src/features/feed/post-media-card.test.tsx src/features/feed/post-composer.test.tsx src/features/feed/feed-card.test.tsx
```

Expected: all pass; Home modules/order and Post lifecycle remain intact.

- [ ] **Step 6: Commit Home/Post changes**

```powershell
git add src/features/feed/feed-page.tsx src/features/home/home-page.test.tsx src/features/feed/post-media-card.tsx src/features/feed/post-media-card.test.tsx src/features/feed/post-composer.tsx src/features/feed/post-composer.test.tsx
git commit -m "fix: align home width and post media"
```

---

### Task 5: Integration, Review, QA, And Closure

**Files:**

- Modify: `TODO.md`
- Modify: `docs/superpowers/specs/2026-07-15-review-layout-media-checkbox-feedback-design.md`
- Read-only review: all Task 1–4 changed code/tests

**Interfaces:**

- Consumes: integrated Task 1–4 outputs.
- Produces: verified branch ready for user review; no merge or deployment.

- [ ] **Step 1: Controller integration audit**

```powershell
rg -n 'type="checkbox"' src -g '*.tsx'
rg -n 'aspect-video|aspect-4/5|max-w-\[65%\]' src/features/reviews src/features/feed src/features/anime-detail -g '*.tsx'
git diff --check
```

Expected: no native standalone checkbox input remains; Review/Post images use 4:5 + responsive cap; linked-video cards and Anime Detail trailer remain unchanged.

- [ ] **Step 2: Run focused integrated tests**

```powershell
pnpm exec vitest run src/components/ui/checkbox.test.tsx src/features/reviews/ui/published-review-card.test.tsx src/features/reviews/ui/review-document-renderer.test.tsx src/features/reviews/ui/review-media-editing-plugin.test.tsx src/features/reviews/ui/review-editor-page.test.tsx src/features/home/home-page.test.tsx src/features/home/home-sidebar.test.tsx src/features/feed/post-media-card.test.tsx src/features/feed/post-composer.test.tsx
```

Expected: all pass.

- [ ] **Step 3: Run spec and thermo reviews**

Fresh read-only reviewer checks accepted spec, exact write scope, one Rating node, no global aspect-token change, no Checkbox duplication, no behavior/data drift, file sizes, unnecessary indirection, and simpler-local-fix compliance. Verdict must be `PASS`; fix every blocking finding and rerun affected tests.

- [ ] **Step 4: Run full automated gates serially**

```powershell
pnpm test
pnpm exec tsc --noEmit
pnpm build
npx react-doctor@latest --verbose --scope changed
pnpm exec fallow audit --base HEAD --gate new-only --format json --quiet
Get-ChildItem -Path dist -Recurse -File | Select-String -Pattern 'graphql\.anilist\.co'
git diff --check
```

Expected: tests, TypeScript, build, React Doctor changed-code regression, and Fallow new-only gate pass; built client scan returns no AniList endpoint match; diff check returns no output. No `convex dev --once` needed because Convex remains untouched.

- [ ] **Step 5: Run authenticated browser QA**

Use `browser:control-in-app-browser` first. Use connected Chrome only when exact viewport or real pointer hover needs it. Reuse DPAPI-protected AnimeX QA account without printing credentials.

At 390, 768, and 1280 px verify:

- `/reviews` and Anime Detail Reviews show no title/author/time/Rating/Summary/action overlap.
- Mobile Rating sits left of `Review Detail` on same row; desktop Rating returns top-right.
- Home desktop utility column computes to 430px; remains hidden below `lg`; no horizontal overflow.
- Review editor, Preview, published Review Detail, and Post image use 4:5; full-width below `sm`; 65% max from `sm` upward.
- Broken-image states keep same geometry.
- Linked-video cards remain horizontal/full-width; Anime Detail trailer remains 16:9.
- Review/Post Checkbox label click, Space key, focus-visible, hover, checked, unchecked, disabled, and pending states work without white/native theme.
- Pointer exit restores default colors; touch does not leave stuck hover state.
- Console, hydration, failed request, and overflow checks stay clean.

Capture before/hover/focus/checked screenshots and computed background, foreground, border, and focus-ring colors for both Checkbox consumers.

- [ ] **Step 6: Close docs and commit**

Set spec status to `IMPLEMENTED AND VERIFIED`. Set TODO section status to `COMPLETE`; record exact test counts, React Doctor score/regression result, Fallow verdict, browser widths, and any inherited warnings.

```powershell
git add TODO.md docs/superpowers/specs/2026-07-15-review-layout-media-checkbox-feedback-design.md
git commit -m "docs: close review layout media feedback"
git status --short
```

Expected: clean feature branch. Stop for user review. Do not merge, deploy, or delete branch.

## Plan Self-Review

- Spec coverage: shared card, 430px Home column, scoped 4:5 images, responsive 65% cap, video/trailer exclusions, Base UI Checkbox, and QA all map to tasks.
- Type consistency: Checkbox uses Base UI boolean `checked`/`onCheckedChange`; Review/Post contracts stay unchanged.
- Scope: no routes, Convex, cache, generated files, migration, dependency, or global style work.
- Execution safety: shared Checkbox lands first; remaining write sets are disjoint; controller owns docs/integration.
- Placeholder scan: no placeholder marker, deferred implementation, or undefined interface remains.
