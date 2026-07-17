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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getFunctionName } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PublicAuthStateProvider } from '#/features/shell/public-auth-context'
import { PublicShell } from '#/features/shell/public-shell'
import { Route } from './home'

const convex = vi.hoisted(() => {
  const query = vi.fn(async (..._args: unknown[]) => ({ items: [], cursor: null, hasMore: false }))
  const state = {
    authenticated: false,
    query,
    querySearches: [] as string[],
    getSearch: (): string => '',
    client: { query: (..._args: unknown[]) => Promise.resolve({ items: [], cursor: null, hasMore: false }) },
  }
  state.client.query = (...args: unknown[]) => {
    state.querySearches.push(state.getSearch())
    return query(...args)
  }
  return state
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
  convex.querySearches.length = 0
  convex.getSearch = () => ''
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

  it('canonicalizes stale Following search before loading the signed-in Home feed', async () => {
    convex.authenticated = true
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ status: 'complete', email: 'mika@example.com', profile: { id: 'profile-1', username: 'mika', name: 'Mika', avatarUrl: null, visibility: 'private' } }) }) as Response))
    vi.stubGlobal('scrollTo', vi.fn())
    const pendingComponent = Route.options.pendingComponent
    if (pendingComponent === undefined) {
      throw new TypeError('Home route requires a pending component.')
    }
    const rootRoute = createRootRoute()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    })
    const publicRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_public',
      component: () => (
        <QueryClientProvider client={queryClient}>
          <PublicShell><Outlet /></PublicShell>
        </QueryClientProvider>
      ),
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
    const history = createMemoryHistory({ initialEntries: ['/home?feed=following&compose=true'] })
    convex.getSearch = () => history.location.search
    const router = createRouter({ routeTree: rootRoute.addChildren([publicRoute.addChildren([homeRoute])]), history })

    render(<RouterProvider router={router} />)

    expect(await screen.findByLabelText('Normalizing Home feed')).toBeTruthy()
    await waitFor(() => expect(history.location.search).toBe('?compose=true'))
    expect(await screen.findByLabelText('Seasonal Anime loading')).toBeTruthy()
    const feedCalls = convex.query.mock.calls.flatMap((call) => {
      const reference = call[0]
      if (reference === undefined) return []
      const name = getFunctionName(reference as Parameters<typeof getFunctionName>[0])
      return name.startsWith('feed:') ? [name] : []
    })
    expect(
      feedCalls[0],
    ).toBe('feed:listHome')
    expect(feedCalls).not.toContain('feed:listFollowing')
    expect(convex.querySearches.every((search) => !search.includes('feed=following'))).toBe(true)
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close Post composer' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getAllByRole('navigation', { name: 'Primary' })).toHaveLength(1)
    expect(screen.getByRole('tab', { name: 'home' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByRole('tab', { name: 'following' })).toBeNull()
    expect(history.location.search).not.toContain('feed=following')
  })
})
