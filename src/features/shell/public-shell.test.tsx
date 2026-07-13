// @vitest-environment jsdom

import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { HomePage } from '../home/home-page'
import { PublicShell } from './public-shell'

const createPublicTestRouter = (initialEntry: string) => {
  const rootRoute = createRootRoute({
    component: () => <PublicShell><Outlet /></PublicShell>,
  })
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'home',
    component: HomePage,
  })
  const discoverRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'discover',
    component: () => <main id="discover-search">Discover content</main>,
  })
  const history = createMemoryHistory({ initialEntries: [initialEntry] })
  const router = createRouter({
    routeTree: rootRoute.addChildren([homeRoute, discoverRoute]),
    history,
  })

  return { history, router }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('PublicShell', () => {
  it('uses real router links for Home, Discover, and non-active Search deep links', async () => {
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

    const searchLink = screen.getAllByRole('link', { name: 'Search' })[0]
    fireEvent.click(searchLink)
    await waitFor(() => expect(history.location.href).toBe('/discover#discover-search'))
    expect(searchLink.className).not.toContain('is-active')
  })

  it('renders complete-user Create without a broken Profile destination', async () => {
    vi.stubGlobal('scrollTo', vi.fn())
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ status: 'complete', email: 'mika@example.com', profile: { id: 'profile-1', username: 'mika', name: 'Mika', avatarUrl: null, visibility: 'private' } }) }) as Response))
    const { router } = createPublicTestRouter('/home')

    render(<RouterProvider router={router} />)

    await screen.findByRole('button', { name: 'Sign out' })
    expect(screen.getByText('Create')).toBeTruthy()
    expect(screen.queryByText('Profile')).toBeNull()
  })

  it('reads profile state once for header and Home content', async () => {
    vi.stubGlobal('scrollTo', vi.fn())
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ status: 'complete', email: 'mika@example.com', profile: { id: 'profile-1', username: 'mika', name: 'Mika', avatarUrl: null, visibility: 'private' } }) }) as Response)
    vi.stubGlobal('fetch', fetchMock)
    const { router } = createPublicTestRouter('/home')

    render(<RouterProvider router={router} />)

    await screen.findByRole('button', { name: 'Sign out' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(screen.getByText('What are you watching?')).toBeTruthy()
  })
})
