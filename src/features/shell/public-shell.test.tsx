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
import { runHeaderSignOut } from './header-auth-controls'
import { PublicShell } from './public-shell'

const account = vi.hoisted(() => ({
  signOut: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('../../lib/auth-client', () => ({
  authClient: { signOut: account.signOut },
}))
vi.mock('sonner', () => ({
  toast: { error: account.toastError },
}))

vi.mock('../auth/auth-state.functions', () => ({
  getAuthState: async () => {
    const response = await fetch('/api/profile/state')
    return await response.json()
  },
}))

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
  account.signOut.mockReset()
  account.toastError.mockReset()
})

const completeAuthState = {
  status: 'complete' as const,
  email: 'mika@example.com',
  profile: {
    id: 'profile-1',
    username: 'mika',
    name: 'Mika',
    avatarUrl: null,
    visibility: 'private' as const,
  },
}

const stubCompleteAuth = (): void => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => completeAuthState,
  }) as Response))
}

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

    await screen.findByRole('button', { name: 'Mika account menu' })
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

    const trigger = await screen.findByRole('button', { name: 'Mika account menu' })
    expect(trigger.className).toContain('size-11')
    expect(within(trigger).getByRole('img', { name: 'Mika avatar' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
    fireEvent.click(trigger)
    const profileItem = screen.getByRole('menuitem', { name: 'Profile' })
    const signOutItem = screen.getByRole('menuitem', { name: 'Sign out' })
    expect(profileItem.className).toContain('min-h-11')
    expect(signOutItem.className).toContain('min-h-11')
  })

  it('supports keyboard focus, Escape, and typed Profile navigation', async () => {
    setViewport(true)
    vi.stubGlobal('scrollTo', vi.fn())
    stubCompleteAuth()
    const { history, router } = createPublicTestRouter('/home')
    render(<RouterProvider router={router} />)

    const trigger = await screen.findByRole('button', {
      name: 'Mika account menu',
    })
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    const profileItem = await screen.findByRole('menuitem', {
      name: 'Profile',
    })
    await waitFor(() => expect(document.activeElement).toBe(profileItem))
    fireEvent.keyDown(profileItem, { key: 'ArrowDown' })
    const signOutItem = screen.getByRole('menuitem', { name: 'Sign out' })
    await waitFor(() => expect(document.activeElement).toBe(signOutItem))
    fireEvent.keyDown(signOutItem, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('menuitem')).toBeNull()
      expect(document.activeElement).toBe(trigger)
    })

    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    const profileAgain = await screen.findByRole('menuitem', {
      name: 'Profile',
    })
    await waitFor(() => expect(document.activeElement).toBe(profileAgain))
    fireEvent.keyDown(profileAgain, { key: 'Enter' })
    fireEvent.keyUp(profileAgain, { key: 'Enter' })
    await waitFor(() => expect(history.location.pathname).toBe('/users/mika'))
  })

  it('activates Sign out from the keyboard exactly once', async () => {
    setViewport(true)
    vi.stubGlobal('scrollTo', vi.fn())
    stubCompleteAuth()
    account.signOut.mockReturnValue(new Promise(() => undefined))
    const { router } = createPublicTestRouter('/home')
    render(<RouterProvider router={router} />)

    const trigger = await screen.findByRole('button', {
      name: 'Mika account menu',
    })
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    const profileItem = await screen.findByRole('menuitem', {
      name: 'Profile',
    })
    await waitFor(() => expect(document.activeElement).toBe(profileItem))
    fireEvent.keyDown(profileItem, { key: 'ArrowDown' })
    const signOutItem = screen.getByRole('menuitem', { name: 'Sign out' })
    await waitFor(() => expect(document.activeElement).toBe(signOutItem))

    fireEvent.keyDown(signOutItem, { key: 'Enter' })
    fireEvent.keyUp(signOutItem, { key: 'Enter' })

    await waitFor(() => expect(account.signOut).toHaveBeenCalledOnce())
  })

  it('closes the account menu on outside interaction', async () => {
    setViewport(true)
    vi.stubGlobal('scrollTo', vi.fn())
    stubCompleteAuth()
    const { router } = createPublicTestRouter('/home')
    render(<RouterProvider router={router} />)

    fireEvent.click(await screen.findByRole('button', {
      name: 'Mika account menu',
    }))
    expect(await screen.findByRole('menuitem', { name: 'Profile' })).toBeTruthy()
    fireEvent.pointerDown(document.body)
    fireEvent.click(document.body)
    await waitFor(() => expect(screen.queryByRole('menuitem')).toBeNull())
  })

  it('awaits sign out before navigating to Home', async () => {
    const request = vi.fn(async () => undefined)
    const navigate = vi.fn()

    await runHeaderSignOut(request, navigate)

    expect(request).toHaveBeenCalledOnce()
    expect(navigate).toHaveBeenCalledWith('/home')
  })

  it('prevents duplicate sign out while pending and re-enables after failure', async () => {
    setViewport(true)
    vi.stubGlobal('scrollTo', vi.fn())
    stubCompleteAuth()
    let reject!: (error: Error) => void
    account.signOut.mockReturnValue(new Promise((_resolve, fail) => {
      reject = fail
    }))
    const { router } = createPublicTestRouter('/home')
    render(<RouterProvider router={router} />)

    const trigger = await screen.findByRole('button', {
      name: 'Mika account menu',
    })
    fireEvent.click(trigger)
    const signOut = await screen.findByRole('menuitem', { name: 'Sign out' })
    fireEvent.click(signOut)
    fireEvent.click(signOut)
    expect(account.signOut).toHaveBeenCalledOnce()

    fireEvent.click(trigger)
    const pending = await screen.findByRole('menuitem', {
      name: 'Signing out…',
    })
    expect(pending.getAttribute('aria-disabled')).toBe('true')
    reject(new Error('Session service unavailable.'))
    await waitFor(() => expect(account.toastError).toHaveBeenCalledWith(
      'Session service unavailable.',
    ))
    expect(screen.getByRole('button', {
      name: 'Mika account menu',
    })).toBeTruthy()

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    })
    fireEvent.click(trigger)
    const retry = await screen.findByRole('menuitem', { name: 'Sign out' })
    expect(retry.getAttribute('aria-disabled')).not.toBe('true')
  })

  it('renders only Home, Discover, and Search while complete auth is not Convex-ready', async () => {
    convex.authenticated = false
    setViewport(false)
    vi.stubGlobal('scrollTo', vi.fn())
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ status: 'complete', email: 'mika@example.com', profile: { id: 'profile-1', username: 'mika', name: 'Mika', avatarUrl: null, visibility: 'private' } }) }) as Response))
    const { router } = createPublicTestRouter('/home')
    render(<RouterProvider router={router} />)
    await screen.findByRole('button', { name: 'Mika account menu' })
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
