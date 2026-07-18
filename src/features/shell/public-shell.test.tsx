// @vitest-environment jsdom

import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { HomePage } from '../home/home-page'
import { PublicShell } from './public-shell'

const convex = vi.hoisted(() => {
  const query = vi.fn(async () => ({ items: [], cursor: null, hasMore: false }))
  return { authenticated: true, query, client: { query }, mutation: vi.fn(() => vi.fn()) }
})
vi.mock('convex/react', () => ({ useConvexAuth: () => ({ isAuthenticated: convex.authenticated, isLoading: false }), useConvex: () => convex.client, useMutation: convex.mutation }))

const createPublicTestRouter = (initialEntry: string) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  })
  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <PublicShell><Outlet /></PublicShell>
      </QueryClientProvider>
    ),
  })
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'home',
    component: () => <HomePage onSearchChange={() => undefined} search={{ feed: 'home', compose: false }} />,
  })
  const discoverRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'discover',
    component: () => <main id="discover-search">Discover content</main>,
  })
  const profileRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'users/$username',
    component: () => <main>Profile content</main>,
  })
  const history = createMemoryHistory({ initialEntries: [initialEntry] })
  const router = createRouter({
    routeTree: rootRoute.addChildren([homeRoute, discoverRoute, profileRoute]),
    history,
  })

  return { history, router }
}

const setViewport = (desktop: boolean): void => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    addEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: desktop,
    media: '(min-width: 48rem)',
    onchange: null,
    removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList))
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  convex.authenticated = true
  convex.query.mockClear()
})

describe('PublicShell', () => {
  it('keeps primary links and opens signed-out desktop Quick Search without navigation', async () => {
    setViewport(true)
    vi.stubGlobal('scrollTo', vi.fn())
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ status: 'signedOut' }) }) as Response))
    const { history, router } = createPublicTestRouter('/home')

    render(<RouterProvider router={router} />)

    const primaryNavigation = within(await screen.findByRole('navigation', { name: 'Primary' }))
    expect(primaryNavigation.getByRole('link', { name: 'Home' }).className).toContain('is-active')
    expect(primaryNavigation.getByRole('link', { name: 'Discover' }).className).not.toContain('is-active')

    fireEvent.click(primaryNavigation.getByRole('link', { name: 'Discover' }))
    await waitFor(() => expect(history.location.pathname).toBe('/discover'))
    expect(primaryNavigation.getByRole('link', { name: 'Discover' }).className).toContain('is-active')

    expect(
      Array.from(screen.getByRole('navigation', { name: 'Mobile' }).querySelectorAll('.mobile-nav-item'))
        .map((item) => item.textContent),
    ).toEqual(['Home', 'Discover', 'Search'])
    const searchButton = within(screen.getByRole('banner')).getByRole('button', { name: 'Search' })
    fireEvent.click(searchButton)
    expect(screen.getByRole('dialog', { name: 'Quick Search' })).toBeTruthy()
    expect(history.location.href).toBe('/discover')
  })

  it('opens mobile Quick Search without changing routes and restores trigger focus', async () => {
    setViewport(false)
    vi.stubGlobal('scrollTo', vi.fn())
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ status: 'signedOut' }) }) as Response))
    const { history, router } = createPublicTestRouter('/home')

    render(<RouterProvider router={router} />)

    const mobileNavigation = within(await screen.findByRole('navigation', { name: 'Mobile' }))
    const searchButton = mobileNavigation.getByRole('button', { name: 'Search' })
    fireEvent.click(searchButton)
    expect(document.querySelector('[data-slot="drawer-popup"]')).not.toBeNull()
    expect(history.location.href).toBe('/home')

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Close Quick Search' }))
    await act(async () => { await vi.runAllTimersAsync() })
    expect(document.activeElement).toBe(searchButton)
  })

  it('renders five complete-user mobile actions with typed Create and Profile links', async () => {
    setViewport(true)
    vi.stubGlobal('scrollTo', vi.fn())
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ status: 'complete', email: 'mika@example.com', profile: { id: 'profile-1', username: 'mika', name: 'Mika', avatarUrl: null, visibility: 'private' } }) }) as Response)
    vi.stubGlobal('fetch', fetchMock)
    const { router } = createPublicTestRouter('/home')

    render(<RouterProvider router={router} />)

    await screen.findByRole('button', { name: 'Sign out' })
    const mobileNavigation = within(screen.getByRole('navigation', { name: 'Mobile' }))
    expect(
      Array.from(screen.getByRole('navigation', { name: 'Mobile' }).querySelectorAll('.mobile-nav-item'))
        .map((item) => item.textContent),
    ).toEqual([
      'Home',
      'Discover',
      'Search',
      'Create',
      'Profile',
    ])
    expect(mobileNavigation.getByRole('button', { name: 'Search' })).toBeTruthy()
    expect(mobileNavigation.getByRole('link', { name: 'Create' }).getAttribute('href')).toContain('compose=true')
    expect(mobileNavigation.getByRole('link', { name: 'Profile' }).getAttribute('href')).toBe('/users/mika')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('What are you watching?')).toBeNull()

    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Search' }))
    expect(screen.getByRole('dialog', { name: 'Quick Search' })).toBeTruthy()
  })

  it('renders complete auth as a labelled 44px account menu with Profile and Sign out', async () => {
    setViewport(true)
    vi.stubGlobal('scrollTo', vi.fn())
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: 'complete',
        email: 'mika@example.com',
        profile: {
          id: 'profile-1',
          username: 'mika',
          name: 'Mika',
          avatarUrl: null,
          visibility: 'private',
        },
      }),
    }) as Response))
    const { router } = createPublicTestRouter('/home')
    render(<RouterProvider router={router} />)

    const trigger = await screen.findByRole('button', { name: 'Open account menu' })
    expect(trigger.className).toContain('size-11')
    expect(within(trigger).getByRole('img', { name: 'Mika avatar' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
    fireEvent.click(trigger)
    expect(screen.getAllByRole('menuitem', { name: 'Profile' })).toHaveLength(1)
    expect(screen.getAllByRole('menuitem', { name: 'Sign out' })).toHaveLength(1)
  })

  it('renders only Home, Discover, and Search while complete auth is not Convex-ready', async () => {
    convex.authenticated = false
    setViewport(false)
    vi.stubGlobal('scrollTo', vi.fn())
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ status: 'complete', email: 'mika@example.com', profile: { id: 'profile-1', username: 'mika', name: 'Mika', avatarUrl: null, visibility: 'private' } }) }) as Response))
    const { router } = createPublicTestRouter('/home')
    render(<RouterProvider router={router} />)
    await screen.findByRole('button', { name: 'Sign out' })
    const mobileNavigation = within(screen.getByRole('navigation', { name: 'Mobile' }))
    expect(
      Array.from(screen.getByRole('navigation', { name: 'Mobile' }).querySelectorAll('.mobile-nav-item'))
        .map((item) => item.textContent),
    ).toEqual(['Home', 'Discover', 'Search'])
    expect(mobileNavigation.getByRole('button', { name: 'Search' })).toBeTruthy()
    expect(mobileNavigation.queryByText('Create')).toBeNull()
    expect(mobileNavigation.queryByText('Profile')).toBeNull()
  })
})
