// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
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
import { Route } from './home'

const convex = vi.hoisted(() => {
  const query = vi.fn(async () => ({ items: [], cursor: null, hasMore: false }))
  return { query, client: { query } }
})
vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }),
  useConvex: () => convex.client,
  useMutation: () => vi.fn(),
}))
vi.mock('#/features/discover/server/discover.functions', () => ({ getDiscoverPage: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
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
})
