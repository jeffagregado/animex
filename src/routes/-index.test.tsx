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
