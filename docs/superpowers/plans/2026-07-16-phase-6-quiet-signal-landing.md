# Phase 6 Quiet Signal Landing Implementation Plan

Status: COMPLETE. Implementation complete and validated on `jeff-cx/phase-6-quiet-signal-landing`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/` redirect with approved Quiet Signal landing page and publish AnimeX-branded favicon assets.

**Architecture:** Root route renders dedicated `LandingPage`, which owns `PublicAuthStateProvider`, existing `SiteHeader`, and hero. It bypasses `PublicShell`, preventing mobile bottom navigation without changing `/home` or other public routes. Root document owns global favicon/manifest links; root route owns landing-specific metadata.

**Tech Stack:** TanStack Start, TanStack Router, React 19, Tailwind CSS v4, native CSS keyframes, Vitest, Testing Library, React Doctor, Fallow, Microsoft Edge headless, FFmpeg.

## Global Constraints

- Accepted design: `docs/superpowers/specs/2026-07-16-phase-6-quiet-signal-landing-design.md`.
- Visual source: `docs/visual/landing/quiet-signal-landing-desktop.png`, generated with native `imagegen`.
- `/` shows landing for signed-out and signed-in visitors. No redirect.
- Logo links `/home`; CTA text is `Discover anime` and links `/discover`.
- Header reuses `SiteHeader`, `mainNavigationItems`, and auth-aware controls. No active navigation item on `/`.
- Do not render `PublicShell`, `MobileBottomNavigation`, footer, feature strip, poster, feed, badge, statistic, or second CTA.
- Below `768px`, remove rings and oversized `AX`; CTA uses available content width.
- At `768px` and wider, render CSS rings and outlined `AX`.
- Motion uses native CSS only: slow ring rotation and subtle glow pulse. Reduced motion is static.
- Reuse existing AnimeX circular mark. Do not generate or invent another logo.
- No production dependency, Convex, schema, API, loader, server function, or persistence change.
- No `motion` import. No new favicon-generation dependency.
- Preserve `/home` and shared public-shell behavior.

## File Map

| File | Responsibility |
| --- | --- |
| `src/features/landing/landing-page.tsx` | Dedicated landing composition and semantic hero. |
| `src/features/landing/landing.css` | Quiet Signal grid, rings, monogram, responsive layout, motion. |
| `src/routes/index.tsx` | Root route component and indexable landing metadata. |
| `src/routes/-index.test.tsx` | Root route, auth-state, header, CTA, and no-bottom-nav integration coverage. |
| `src/features/shell/public-auth-context.tsx` | Provider wording generalized beyond `PublicShell`. |
| `src/styles.css` | Imports landing-local stylesheet. |
| `src/routes/__root.tsx` | Shared head metadata and favicon/manifest links. |
| `src/routes/-root-head.test.ts` | Shared head, manifest, and asset-presence contract. |
| `public/favicon.svg` | Mark-only AnimeX vector master. |
| `public/favicon.ico` | 16/32/48/64 browser fallback. |
| `public/apple-touch-icon.png` | 180px touch icon. |
| `public/icon-192.png` | 192px manifest icon. |
| `public/icon-512.png` | 512px manifest/maskable icon. |
| `public/manifest.json` | AnimeX name, colors, and icon references. |
| `public/logo192.png`, `public/logo512.png` | Delete TanStack starter atoms. |
| `PLAN.md`, `TODO.md` | Phase 6 current state and closure tracking. |

## Execution And Ownership

Mode: controller-led, sequential. Task 1 locks route/component structure. Task 2 consumes its class contract. Task 3 changes independent head/assets. Task 4 integrates and validates all surfaces.

---

### Task 1: Root Landing Contract

**Files:**

- Create: `src/features/landing/landing-page.tsx`
- Create: `src/routes/-index.test.tsx`
- Modify: `src/routes/index.tsx:1-7`
- Modify: `src/features/shell/public-auth-context.tsx:7-24`

**Interfaces:**

- Consumes: `PublicAuthStateProvider`, `SiteHeader`, `mainNavigationItems`, TanStack `Link`.
- Produces: named `LandingPage`; named `getLandingHead`; root `Route` with no `beforeLoad` redirect.
- Preserves: shared `PublicShell` and all `_public` routes.

- [x] **Step 1: Write failing route integration test**

Create `src/routes/-index.test.tsx`:

```tsx
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AuthState } from '#/features/auth/auth-contracts'
import { LandingPage } from '#/features/landing/landing-page'
import { getLandingHead } from './-index-head'
import { Route } from './index'

/** Stubs one successful public auth-state response. */
const stubAuthState = (authState: AuthState) => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => authState,
  }) as Response))
}

/** Builds root, Home, and Discover routes for landing navigation checks. */
const createLandingTestRouter = () => {
  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: LandingPage,
  })
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'home',
    component: () => <main>Home</main>,
  })
  const discoverRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'discover',
    component: () => <main>Discover</main>,
  })
  const history = createMemoryHistory({ initialEntries: ['/'] })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, homeRoute, discoverRoute]),
    history,
  })

  return { history, router }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Root landing route', () => {
  it('owns indexable metadata and no redirect', () => {
    expect(Route.options.beforeLoad).toBeUndefined()
    expect(getLandingHead().meta).toEqual([
      { title: 'AnimeX - Find anime worth remembering' },
      {
        name: 'description',
        content: 'Build your list. Share what stays with you.',
      },
    ])
  })

  it('renders signed-out hero, inactive header links, and Discover navigation', async () => {
    stubAuthState({ status: 'signedOut' })
    vi.stubGlobal('scrollTo', vi.fn())
    const { history, router } = createLandingTestRouter()

    render(<RouterProvider router={router} />)

    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Find anime worth remembering.' })).toBeTruthy()
    expect(screen.getByText('Build your list. Share what stays with you.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'AnimeX home' }).getAttribute('href')).toBe('/home')
    expect(screen.queryByRole('navigation', { name: 'Mobile' })).toBeNull()

    const primary = within(screen.getByRole('navigation', { name: 'Primary' }))
    expect(primary.getByRole('link', { name: 'Home' }).className).not.toContain('is-active')
    expect(primary.getByRole('link', { name: 'Discover' }).className).not.toContain('is-active')

    fireEvent.click(screen.getByRole('link', { name: 'Discover anime' }))
    await waitFor(() => expect(history.location.pathname).toBe('/discover'))
  })

  it('keeps signed-in visitors on the same landing hero', async () => {
    stubAuthState({
      status: 'complete',
      email: 'mika@example.com',
      profile: {
        id: 'profile-1',
        username: 'mika',
        name: 'Mika',
        avatarUrl: null,
        visibility: 'private',
      },
    })
    vi.stubGlobal('scrollTo', vi.fn())
    const { history, router } = createLandingTestRouter()

    render(<RouterProvider router={router} />)

    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Find anime worth remembering.' })).toBeTruthy()
    expect(history.location.pathname).toBe('/')
    expect(screen.queryByRole('navigation', { name: 'Mobile' })).toBeNull()
  })
})
```

- [x] **Step 2: Run test and verify red state**

Run:

```powershell
pnpm exec vitest run src/routes/-index.test.tsx
```

Expected: FAIL because `LandingPage` and `getLandingHead` do not exist and `/` still owns a redirect.

- [x] **Step 3: Create dedicated landing composition**

Create `src/features/landing/landing-page.tsx`:

```tsx
import { Link } from '@tanstack/react-router'

import { mainNavigationItems } from '../shell/navigation'
import { PublicAuthStateProvider } from '../shell/public-auth-context'
import { SiteHeader } from '../shell/site-header'

export function LandingPage() {
  return (
    <PublicAuthStateProvider>
      <div className="landing-page min-h-dvh bg-background text-foreground">
        <SiteHeader navItems={mainNavigationItems} showAuthAction={true} />
        <main className="landing-hero">
          <div className="landing-signal" aria-hidden="true">
            <span className="landing-signal__ring landing-signal__ring--outer" />
            <span className="landing-signal__ring landing-signal__ring--middle" />
            <span className="landing-signal__ring landing-signal__ring--inner" />
            <span className="landing-signal__ring landing-signal__ring--dotted" />
            <span className="landing-signal__mark">
              <span className="landing-signal__mark-a">A</span>
              <span className="landing-signal__mark-x">X</span>
            </span>
          </div>
          <section className="landing-hero__content" aria-labelledby="landing-heading">
            <h1 id="landing-heading">Find anime worth remembering.</h1>
            <p>Build your list. Share what stays with you.</p>
            <Link className="landing-hero__action" to="/discover">
              Discover anime
            </Link>
          </section>
        </main>
      </div>
    </PublicAuthStateProvider>
  )
}
```

- [x] **Step 4: Replace redirect with route metadata and component**

Replace `src/routes/index.tsx` with:

```tsx
import { createFileRoute } from '@tanstack/react-router'

import { LandingPage } from '#/features/landing/landing-page'
import { getLandingHead } from './-index-head'

export const Route = createFileRoute('/')({
  head: getLandingHead,
  component: LandingPage,
})
```

Create `src/routes/-index-head.ts`:

```ts

/** Returns indexable metadata for the public landing page. */
export const getLandingHead = () => ({
  meta: [
    { title: 'AnimeX - Find anime worth remembering' },
    {
      name: 'description',
      content: 'Build your list. Share what stays with you.',
    },
  ],
})
```

In `src/features/shell/public-auth-context.tsx`, preserve implementation and update only shared-boundary wording:

```tsx
/** Reads public auth state once for all public-page consumers. */
export function PublicAuthStateProvider({ children }: PublicAuthStateProviderProps) {
  const authState = useAuthState()

  return <PublicAuthStateContext.Provider value={authState}>{children}</PublicAuthStateContext.Provider>
}

/** Returns auth state supplied by the public provider boundary. */
export const usePublicAuthState = (): ClientAuthState => {
  const authState = useContext(PublicAuthStateContext)
  if (authState === null) {
    throw new Error('Public auth state is required inside PublicAuthStateProvider.')
  }
  return authState
}
```

- [x] **Step 5: Run focused checks and verify green state**

Run:

```powershell
pnpm exec vitest run src/routes/-index.test.tsx src/features/shell/public-shell.test.tsx
pnpm exec tsc --noEmit
```

Expected: both files PASS; TypeScript exits `0`; root route has no redirect; existing shell behavior remains green.

- [x] **Step 6: Commit route contract**

```powershell
git add -- src/features/landing/landing-page.tsx src/routes/index.tsx src/routes/-index.test.tsx src/features/shell/public-auth-context.tsx
git commit -m "feat: add Quiet Signal landing route"
```

---

### Task 2: Quiet Signal Visual Translation

**Files:**

- Create: `src/features/landing/landing.css`
- Modify: `src/styles.css:1-5`
- Read-only: `docs/visual/landing/quiet-signal-landing-desktop.png`

**Interfaces:**

- Consumes: class names from `LandingPage`, existing color tokens, `768px` breakpoint.
- Produces: desktop CSS signal, mobile content-only layout, reduced-motion contract.
- Skips: new images, font packages, `motion`, shared-shell styling changes.

- [x] **Step 1: Add landing-local stylesheet import**

Add after auth CSS in `src/styles.css`:

```css
@import './features/landing/landing.css';
```

- [x] **Step 2: Implement exact landing styles**

Create `src/features/landing/landing.css`:

```css
@layer components {
  .landing-page {
    --landing-night: oklch(0.105 0.025 242);
    --landing-cyan: var(--cyan-300);
    --landing-coral: var(--coral-400);
    min-height: 100dvh;
    background:
      radial-gradient(circle at 30% 48%, oklch(0.62 0.15 196 / 0.14), transparent 34rem),
      radial-gradient(circle at 73% 43%, oklch(0.62 0.18 27 / 0.12), transparent 31rem),
      var(--landing-night);
  }

  .landing-hero {
    position: relative;
    isolation: isolate;
    display: grid;
    min-height: calc(100dvh - 4rem);
    place-items: center;
    padding: clamp(3.5rem, 9vh, 7rem) 1rem;
  }

  .landing-hero::before {
    position: absolute;
    z-index: -2;
    inset: 0;
    background-image:
      linear-gradient(oklch(1 0 0 / 0.035) 1px, transparent 1px),
      linear-gradient(90deg, oklch(1 0 0 / 0.03) 1px, transparent 1px);
    background-size: 48px 48px;
    content: '';
    mask-image: radial-gradient(circle at center, black, transparent 76%);
    pointer-events: none;
  }

  .landing-hero::after {
    position: absolute;
    z-index: -1;
    width: min(88vw, 58rem);
    aspect-ratio: 1;
    border-radius: 999px;
    background: radial-gradient(circle, oklch(0.7 0.14 196 / 0.13), transparent 67%);
    content: '';
    pointer-events: none;
    animation: quiet-signal-glow 8s ease-in-out infinite;
  }

  .landing-signal {
    position: absolute;
    display: none;
    width: min(72vw, 50rem);
    aspect-ratio: 1;
    place-items: center;
    pointer-events: none;
  }

  .landing-signal__ring {
    position: absolute;
    border-radius: 999px;
    background: conic-gradient(
      from 18deg,
      transparent 0 12%,
      var(--landing-cyan) 20%,
      transparent 42%,
      var(--landing-coral) 70%,
      transparent 88% 100%
    );
    opacity: 0.72;
    mask: radial-gradient(farthest-side, transparent calc(100% - 2px), black 0);
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), black 0);
    animation: quiet-signal-spin 44s linear infinite;
  }

  .landing-signal__ring--outer {
    inset: 0;
  }

  .landing-signal__ring--middle {
    inset: 11%;
    opacity: 0.6;
    animation-duration: 34s;
    animation-direction: reverse;
  }

  .landing-signal__ring--inner {
    inset: 23%;
    opacity: 0.78;
    animation-duration: 27s;
  }

  .landing-signal__ring--dotted {
    inset: 17%;
    border: 2px dotted oklch(0.82 0.15 196 / 0.58);
    background: none;
    mask: none;
    -webkit-mask: none;
    animation-duration: 38s;
    animation-direction: reverse;
  }

  .landing-signal__mark {
    display: flex;
    align-items: center;
    transform: translateX(-0.05em);
    font-size: clamp(12rem, 24vw, 20rem);
    font-weight: 900;
    letter-spacing: -0.16em;
    line-height: 0.8;
    opacity: 0.42;
  }

  .landing-signal__mark-a,
  .landing-signal__mark-x {
    color: transparent;
  }

  .landing-signal__mark-a {
    -webkit-text-stroke: 2px var(--landing-cyan);
    filter: drop-shadow(0 0 18px oklch(0.82 0.15 196 / 0.32));
  }

  .landing-signal__mark-x {
    -webkit-text-stroke: 2px var(--landing-coral);
    filter: drop-shadow(0 0 18px oklch(0.72 0.18 27 / 0.3));
  }

  .landing-hero__content {
    position: relative;
    z-index: 1;
    width: min(100%, 80rem);
    text-align: center;
  }

  .landing-hero__content h1 {
    margin: 0;
    color: var(--foreground);
    font-size: clamp(2.65rem, 6vw, 5.25rem);
    font-weight: 900;
    letter-spacing: -0.055em;
    line-height: 0.98;
    text-wrap: balance;
    text-shadow: 0 8px 32px oklch(0 0 0 / 0.42);
  }

  .landing-hero__content p {
    max-width: 44rem;
    margin: clamp(1.25rem, 3vh, 1.75rem) auto 0;
    color: var(--muted-foreground);
    font-size: clamp(1rem, 2vw, 1.45rem);
    line-height: 1.55;
    text-wrap: balance;
  }

  .landing-hero__action {
    display: inline-flex;
    width: 100%;
    min-height: 3.75rem;
    align-items: center;
    justify-content: center;
    margin-top: clamp(1.75rem, 4vh, 2.5rem);
    border: 1px solid oklch(0.9 0.12 196 / 0.8);
    border-radius: var(--radius);
    background: var(--landing-cyan);
    box-shadow: 0 0 32px oklch(0.78 0.15 196 / 0.28);
    color: var(--primary-foreground);
    font-size: 1.05rem;
    font-weight: 900;
    text-decoration: none;
    transition: transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease;
  }

  .landing-hero__action:hover {
    transform: translateY(-2px);
    background: oklch(0.84 0.14 196);
    box-shadow: 0 0 42px oklch(0.78 0.15 196 / 0.4);
  }

  .landing-hero__action:focus-visible {
    outline: 3px solid var(--foreground);
    outline-offset: 4px;
  }

  @media (min-width: 48rem) {
    .landing-signal {
      display: grid;
    }

    .landing-hero__action {
      width: auto;
      min-width: 19rem;
      padding-inline: 3rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .landing-hero::after,
    .landing-signal__ring {
      animation: none;
    }

    .landing-hero__action {
      transition: none;
    }
  }

  @keyframes quiet-signal-spin {
    to {
      transform: rotate(1turn);
    }
  }

  @keyframes quiet-signal-glow {
    0%,
    100% {
      opacity: 0.65;
      transform: scale(0.96);
    }

    50% {
      opacity: 1;
      transform: scale(1.04);
    }
  }
}
```

- [x] **Step 3: Run focused automated checks**

Run:

```powershell
pnpm exec vitest run src/routes/-index.test.tsx
pnpm exec tsc --noEmit
git diff --check
```

Expected: test and TypeScript PASS; diff check emits no errors.

- [x] **Step 4: Run focused visual smoke**

Run `pnpm dev`, then use repo-required in-app browser on `http://localhost:3000/`.

- `390px`: no rings or large `AX`; centered copy; CTA spans content width; no horizontal overflow or mobile bottom navigation.
- `768px`: signal appears; content remains readable; header switches to desktop navigation.
- `1280px`: composition matches approved reference hierarchy and spacing; CTA and header focus indicators remain visible.
- Reduced motion: ring and glow computed animations are `none`.
- Console: no runtime, hydration, or failed-request errors.

- [x] **Step 5: Commit visual translation**

```powershell
git add -- src/features/landing/landing.css src/styles.css
git commit -m "feat: style Quiet Signal landing"
```

---

### Task 3: AnimeX Favicons And Shared Head

**Files:**

- Create: `src/routes/-root-head.test.ts`
- Create: `public/favicon.svg`
- Create: `public/apple-touch-icon.png`
- Create: `public/icon-192.png`
- Create: `public/icon-512.png`
- Modify: `src/routes/__root.tsx:20-47`
- Modify: `public/favicon.ico`
- Modify: `public/manifest.json`
- Delete: `public/logo192.png`
- Delete: `public/logo512.png`

**Interfaces:**

- Consumes: `public/animex-logo.svg` circular mark and existing global root head.
- Produces: `getRootHead`; shared SVG/ICO/touch/manifest links; branded manifest.
- Asset source: exact existing AnimeX mark paths; no new icon library result and no image generation.

- [x] **Step 1: Write failing shared-head and asset test**

Create `src/routes/-root-head.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { getRootHead } from './__root'

const publicAsset = (name: string): string => resolve(process.cwd(), 'public', name)

describe('Shared AnimeX head', () => {
  it('links the global favicon and manifest set', () => {
    const head = getRootHead()

    expect(head.meta).toContainEqual({ name: 'theme-color', content: '#071522' })
    expect(head.links).toEqual(expect.arrayContaining([
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      {
        rel: 'icon',
        href: '/favicon.ico',
        sizes: '16x16 32x32 48x48 64x64',
        type: 'image/x-icon',
      },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' },
      { rel: 'manifest', href: '/manifest.json' },
    ]))
  })

  it('publishes AnimeX manifest values and every referenced asset', () => {
    const manifest: unknown = JSON.parse(readFileSync(publicAsset('manifest.json'), 'utf8'))

    expect(manifest).toEqual({
      short_name: 'AnimeX',
      name: 'AnimeX',
      icons: [
        {
          src: '/icon-192.png',
          type: 'image/png',
          sizes: '192x192',
          purpose: 'any',
        },
        {
          src: '/icon-512.png',
          type: 'image/png',
          sizes: '512x512',
          purpose: 'any maskable',
        },
      ],
      start_url: '/',
      display: 'standalone',
      theme_color: '#071522',
      background_color: '#071522',
    })

    for (const name of [
      'favicon.svg',
      'favicon.ico',
      'apple-touch-icon.png',
      'icon-192.png',
      'icon-512.png',
    ]) {
      expect(existsSync(publicAsset(name)), `${name} must exist`).toBe(true)
    }
  })
})
```

- [x] **Step 2: Run test and verify red state**

Run:

```powershell
pnpm exec vitest run src/routes/-root-head.test.ts
```

Expected: FAIL because `getRootHead`, AnimeX manifest values, and new icon files do not exist.

- [x] **Step 3: Add mark-only vector master**

Create `public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-labelledby="title">
  <title id="title">AnimeX</title>
  <defs>
    <linearGradient id="cyan-fill" x1="32" x2="110" y1="116" y2="35" gradientUnits="userSpaceOnUse">
      <stop stop-color="#16d9e8" />
      <stop offset="1" stop-color="#32f3ff" />
    </linearGradient>
    <linearGradient id="coral-fill" x1="96" x2="143" y1="122" y2="33" gradientUnits="userSpaceOnUse">
      <stop stop-color="#ff5a57" />
      <stop offset="1" stop-color="#ff7670" />
    </linearGradient>
  </defs>
  <rect width="160" height="160" fill="#071522" />
  <g transform="translate(16 16) scale(0.8)">
    <circle cx="80" cy="80" r="63" fill="none" stroke="#22e6f0" stroke-width="7" />
    <path fill="url(#cyan-fill)" d="M30 118 68 36l44 83-29-25-21 37 4-38-35 25Z" />
    <path fill="url(#coral-fill)" d="M72 128 108 75 91 54l39-16-28 38 35 47h-27L88 95l-16 33Z" />
  </g>
</svg>
```

- [x] **Step 4: Generate deterministic PNG and ICO derivatives**

Run from repo root. Installed Edge and FFmpeg are pre-verified; command fails explicitly if either step fails.

```powershell
$ErrorActionPreference = 'Stop'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$source = Join-Path $env:TEMP 'animex-favicon-512.png'
$faviconUrl = 'file:///' + ((Resolve-Path -LiteralPath 'public/favicon.svg').Path -replace '\\', '/')

if (-not (Test-Path -LiteralPath $edge)) {
  throw 'Microsoft Edge headless executable is required to render AnimeX favicon assets.'
}

try {
  & $edge --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --screenshot=$source --window-size=512,512 $faviconUrl | Out-Null
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $source)) {
    throw 'AnimeX favicon SVG rendering failed.'
  }

  Copy-Item -LiteralPath $source -Destination 'public/icon-512.png' -Force

  ffmpeg -hide_banner -loglevel error -y -i $source -vf 'scale=192:192:flags=lanczos' 'public/icon-192.png'
  if ($LASTEXITCODE -ne 0) { throw '192px AnimeX icon generation failed.' }

  ffmpeg -hide_banner -loglevel error -y -i $source -vf 'scale=180:180:flags=lanczos' 'public/apple-touch-icon.png'
  if ($LASTEXITCODE -ne 0) { throw 'Apple touch icon generation failed.' }

  ffmpeg -hide_banner -loglevel error -y -i $source -filter_complex '[0:v]split=4[a][b][c][d];[a]scale=16:16:flags=lanczos[s16];[b]scale=32:32:flags=lanczos[s32];[c]scale=48:48:flags=lanczos[s48];[d]scale=64:64:flags=lanczos[s64]' -map '[s16]' -map '[s32]' -map '[s48]' -map '[s64]' 'public/favicon.ico'
  if ($LASTEXITCODE -ne 0) { throw 'Multi-size AnimeX ICO generation failed.' }
} finally {
  if (Test-Path -LiteralPath $source) {
    Remove-Item -LiteralPath $source
  }
}

Remove-Item -LiteralPath 'public/logo192.png', 'public/logo512.png'
```

- [x] **Step 5: Replace starter manifest**

Replace `public/manifest.json` with:

```json
{
  "short_name": "AnimeX",
  "name": "AnimeX",
  "icons": [
    {
      "src": "/icon-192.png",
      "type": "image/png",
      "sizes": "192x192",
      "purpose": "any"
    },
    {
      "src": "/icon-512.png",
      "type": "image/png",
      "sizes": "512x512",
      "purpose": "any maskable"
    }
  ],
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#071522",
  "background_color": "#071522"
}
```

- [x] **Step 6: Add shared root-head links**

In `src/routes/__root.tsx`, replace inline head object with this named function; preserve `RootDocument` unchanged:

```tsx
/** Returns shared document metadata and global assets. */
export const getRootHead = () => ({
  meta: [
    { charSet: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { title: 'AnimeX' },
    { name: 'theme-color', content: '#071522' },
  ],
  links: [
    { rel: 'stylesheet', href: appCss },
    { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    {
      rel: 'icon',
      href: '/favicon.ico',
      sizes: '16x16 32x32 48x48 64x64',
      type: 'image/x-icon',
    },
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' },
    { rel: 'manifest', href: '/manifest.json' },
  ],
})

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: getRootHead,
  shellComponent: RootDocument,
})
```

- [x] **Step 7: Verify tests and binary dimensions**

Run:

```powershell
pnpm exec vitest run src/routes/-root-head.test.ts src/routes/-index.test.tsx
ffprobe -v error -show_entries stream=width,height -of csv=p=0 public/favicon.ico
ffprobe -v error -show_entries stream=width,height -of csv=p=0 public/apple-touch-icon.png
ffprobe -v error -show_entries stream=width,height -of csv=p=0 public/icon-192.png
ffprobe -v error -show_entries stream=width,height -of csv=p=0 public/icon-512.png
pnpm exec tsc --noEmit
```

Expected:

- Tests PASS.
- ICO streams: `16x16`, `32x32`, `48x48`, `64x64`.
- PNG dimensions: `180x180`, `192x192`, `512x512`.
- TypeScript exits `0`.

- [x] **Step 8: Commit favicon and head set**

```powershell
git add -- src/routes/__root.tsx src/routes/-root-head.test.ts public/favicon.svg public/favicon.ico public/apple-touch-icon.png public/icon-192.png public/icon-512.png public/manifest.json public/logo192.png public/logo512.png
git commit -m "feat: add AnimeX favicon set"
```

---

### Task 4: Integration, QA, And Phase Closure

**Files:**

- Modify after green validation: `PLAN.md`
- Modify after green validation: `TODO.md`
- Read-only: accepted design spec and desktop reference.

**Interfaces:**

- Consumes: Tasks 1-3 integrated state.
- Produces: reviewed, validated Phase 6 implementation and current tracker state.
- Skips: `convex dev --once`; Phase 6 changes no Convex surface.

- [x] **Step 1: Regenerate routes and inspect generated-file drift**

Run:

```powershell
pnpm generate-routes
git diff -- src/routeTree.gen.ts
```

Expected: route generation succeeds. Existing `/` route identity is unchanged, so `src/routeTree.gen.ts` should have no semantic diff.

- [x] **Step 2: Run automated gates**

Run in order:

```powershell
pnpm exec vitest run src/routes/-index.test.tsx src/routes/-root-head.test.ts src/features/shell/public-shell.test.tsx
pnpm test
pnpm exec tsc --noEmit
pnpm build
npx react-doctor@latest --verbose --scope changed
pnpm exec fallow audit --format json --quiet --base dev 2>$null
if ($LASTEXITCODE -eq 2) { throw 'Fallow audit failed to execute.' }
git diff --check
```

Expected:

- Focused and full Vitest suites: zero failures.
- TypeScript: exit `0`.
- Client and SSR builds: success. Existing client chunk warning may remain; no new build error.
- React Doctor: exit `0`, no changed-code regression.
- Fallow: valid `audit` JSON, no new error verdict; report inherited warnings separately.
- Diff check: no whitespace errors.

- [x] **Step 3: Run final browser QA**

Start `pnpm dev`. Use in-app browser on `/`, `/home`, and `/discover`.

| State | Width | Required evidence |
| --- | --- | --- |
| Signed out | 390 | Root stays `/`; Sign in visible; artwork absent; CTA full width; no mobile bottom nav; no overflow. |
| Signed out | 768 | Rings and outlined `AX` visible; Home/Discover both inactive; CTA routes `/discover`. |
| Signed out | 1280 | Reference hierarchy, grid, glow, spacing, one-line/few-line headline, visible focus. |
| Signed in | 390 and 1280 | Root stays `/`; Sign out visible; same hero and CTA. |
| Reduced motion | 768 and 1280 | Rings and glow static; content unchanged. |
| Regression | `/home` mobile | Existing mobile bottom navigation still present. |
| Assets | Any | SVG, ICO, touch icon, manifest, and PNG requests return `200`; browser tab uses AnimeX mark. |

For every viewport: keyboard activation works, focus order follows header then CTA, console has no error/warning regression, network has no failed request, and no hydration symptom appears.

- [x] **Step 4: Run implementation review gates**

Spec review compares concrete diff with `docs/superpowers/specs/2026-07-16-phase-6-quiet-signal-landing-design.md`.

Thermo review is required because root route, shared head, and shared auth-provider wording change. It must confirm:

- no shell mode/flag or optional prop added;
- no generic helper or dependency added;
- landing styles stay feature-local;
- root/server render remains deterministic;
- existing `/home` behavior remains intact;
- generated assets match existing logo provenance.

Block closure on P1/P2 findings or missing browser evidence. Fix smallest root cause, rerun affected gates, then rerun reviewer verdict.

- [x] **Step 5: Close current-state trackers after all gates pass**

Replace Phase 6 section in `TODO.md` with:

```md
# Phase 6 Quiet Signal Landing

Status: COMPLETE. Quiet Signal landing, AnimeX favicon set, automated gates, review, and responsive browser QA pass.

- [x] Select and approve Quiet Signal design, desktop reference, responsive behavior, motion, route, header, and favicon contracts.
- [x] Write, review, and approve detailed implementation plan.
- [x] Replace `/` redirect with dedicated signed-out/signed-in landing composition; preserve shared public-shell behavior.
- [x] Implement responsive CSS signal, mobile content-only layout, and reduced-motion behavior.
- [x] Replace TanStack starter icons with AnimeX SVG, ICO, Apple touch, and manifest assets.
- [x] Complete focused/full tests, TypeScript, client/SSR build, React Doctor, Fallow, diff check, implementation review, and browser QA.
```

Update Phase 6 in `PLAN.md` to this current state:

```md
### Phase 6: Quiet Signal Landing

Status: COMPLETE. Approved landing and AnimeX favicon set are implemented and validated.

- `/` shows the Quiet Signal landing to signed-out and signed-in visitors.
- Dedicated composition reuses `SiteHeader` and auth controls without `PublicShell` or mobile bottom navigation.
- Hero copy and single `/discover` action match the accepted design contract.
- Desktop/tablet use CSS rings and outlined `AX`; widths below `768px` use content-only layout.
- Native CSS ambient motion becomes static under reduced-motion preference.
- Shared root head publishes AnimeX SVG, ICO, Apple touch, and manifest assets derived from the existing logo mark.
- Phase 6 validation and responsive browser QA are complete.
- Stop and wait for approval before pre-Phase 7 Social UI Embargo cleanup.
```

- [x] **Step 6: Commit closure docs**

```powershell
git add -- PLAN.md TODO.md
git commit -m "docs: close phase 6 landing"
```

- [x] **Step 7: Final post-commit evidence**

Run:

```powershell
git status --short
git log -4 --oneline
git diff dev...HEAD --check
```

Expected: clean worktree; Phase 6 commits visible; no diff-check errors.

## Handoff Boundaries

- No deployment or push without explicit user request.
- No pre-Phase 7 cleanup or Phase 7 work starts automatically.
- If browser QA exposes visual drift, fix Task 2 styles only unless evidence proves route/head cause.
- If favicon render is unclear below 32px, refine only `public/favicon.svg`, regenerate derivatives, and rerun Task 3 checks.
