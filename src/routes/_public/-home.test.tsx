// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PublicAuthStateProvider } from '#/features/shell/public-auth-context'
import { PublicShell } from '#/features/shell/public-shell'
import { Route } from './home'

const convex = vi.hoisted(() => {
  const query = vi.fn(async () => ({ items: [], cursor: null, hasMore: false }))
  return { authenticated: false, query, client: { query } }
})
vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: convex.authenticated, isLoading: false }),
  useConvex: () => convex.client,
  useMutation: () => vi.fn(),
}))
vi.mock('#/features/discover/server/discover.functions', () => ({ getDiscoverPage: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  convex.authenticated = false
  convex.query.mockClear()
})

describe('Home route', () => {
  it('renders Home loading composition while its loader is delayed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ status: 'signedOut' }) }) as Response))
    vi.stubGlobal('scrollTo', vi.fn())
    const pendingComponent = Route.options.pendingComponent
    expect(pendingComponent).toBeTypeOf('function')
    if (pendingComponent === undefined) {
      throw new TypeError('Home route requires a pending component.')
    }
    let finishLoader: (() => void) | undefined
    const delayedLoader = new Promise<void>((resolve) => {
      finishLoader = resolve
    })
    const rootRoute = createRootRoute({
      component: () => <PublicAuthStateProvider><Outlet /></PublicAuthStateProvider>,
    })
    const homeRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'home',
      loader: async () => await delayedLoader,
      component: () => <main>Loaded Home</main>,
      pendingComponent,
      pendingMs: 0,
    })
    const router = createRouter({
      routeTree: rootRoute.addChildren([homeRoute]),
      history: createMemoryHistory({ initialEntries: ['/home'] }),
    })

    render(<RouterProvider router={router} />)

    expect(await screen.findByLabelText('Seasonal Anime loading')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Global' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'No activity yet' })).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull()
    finishLoader?.()
    expect(await screen.findByText('Loaded Home')).toBeTruthy()
  })

  it('preserves signed-in feed and composer URL controls while pending', async () => {
    convex.authenticated = true
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ status: 'complete', email: 'mika@example.com', profile: { id: 'profile-1', username: 'mika', name: 'Mika', avatarUrl: null, visibility: 'private' } }) }) as Response))
    vi.stubGlobal('scrollTo', vi.fn())
    const pendingComponent = Route.options.pendingComponent
    if (pendingComponent === undefined) {
      throw new TypeError('Home route requires a pending component.')
    }
    const rootRoute = createRootRoute()
    const publicRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_public',
      component: () => <PublicShell><Outlet /></PublicShell>,
    })
    const homeRoute = createRoute({
      getParentRoute: () => publicRoute,
      path: 'home',
      validateSearch: (search: Record<string, unknown>) => search,
      loader: async () => await new Promise<void>(() => undefined),
      component: () => <main>Loaded Home</main>,
      pendingComponent,
      pendingMs: 0,
    })
    const history = createMemoryHistory({ initialEntries: ['/home?feed=following'] })
    const router = createRouter({ routeTree: rootRoute.addChildren([publicRoute.addChildren([homeRoute])]), history })

    render(<RouterProvider router={router} />)

    expect(await screen.findByLabelText('Seasonal Anime loading')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'following' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getAllByRole('navigation', { name: 'Primary' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Create Post' }))
    await waitFor(() => expect(history.location.search).toContain('compose=true'))
    expect(history.location.search).toContain('feed=following')
  })
})
