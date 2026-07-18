// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  useLocation,
} from '@tanstack/react-router'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { ProfilePage, type ProfileResult } from './profile-page'

const mocks = vi.hoisted(() => {
  const query = vi.fn()
  return {
    client: { query },
    profile: {
      access: 'full',
      owner: false,
      profile: {
        avatarUrl: null,
        bannerUrl: null,
        bio: '',
        favorites: [],
        id: 'profile-1',
        name: 'Mika',
        profileVisibility: 'public',
        progress: { completed: 0, dropped: 0, planned: 0, watching: 0 },
        username: 'mika',
      },
    } as ProfileResult,
    page: { items: [], cursor: null, hasMore: false },
    query,
  }
})

vi.mock('convex/react', () => ({
  useConvex: () => mocks.client,
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useMutation: () => vi.fn(),
  useQuery: () => mocks.profile,
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const ProfileRouteView = () => {
  const location = useLocation()
  const rawTab = new URLSearchParams(location.searchStr).get('tab')
  const tab = rawTab === 'reviews' || rawTab === 'favorites'
    ? rawTab
    : 'activity'
  return <ProfilePage tab={tab} username="mika" />
}

it('changes Profile tabs through router history without scroll reset', async () => {
  mocks.query.mockResolvedValue(mocks.page)
  const root = createRootRoute()
  const profile = createRoute({
    component: ProfileRouteView,
    getParentRoute: () => root,
    path: 'users/$username',
  })
  const history = createMemoryHistory({ initialEntries: ['/users/mika'] })
  const router = createRouter({
    history,
    routeTree: root.addChildren([profile]),
  })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const scrollTo = vi.fn()
  vi.stubGlobal('scrollTo', scrollTo)
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )

  const blockNativeDocumentNavigation = (event: MouseEvent): void => {
    if (!event.defaultPrevented) event.preventDefault()
  }
  document.addEventListener('click', blockNativeDocumentNavigation)
  fireEvent.click(await screen.findByRole('link', { name: 'reviews' }))
  await waitFor(() => expect(history.location.search).toBe('?tab=reviews'))
  expect(screen.getByRole('link', { name: 'reviews' }).getAttribute('aria-current')).toBe('page')

  await act(async () => { history.back() })
  await waitFor(() => expect(history.location.search).toBe(''))
  expect(screen.getByRole('link', { name: 'activity' }).getAttribute('aria-current')).toBe('page')

  await act(async () => { history.forward() })
  await waitFor(() => expect(history.location.search).toBe('?tab=reviews'))
  expect(screen.getByRole('link', { name: 'reviews' }).getAttribute('aria-current')).toBe('page')
  expect(scrollTo).not.toHaveBeenCalled()
  document.removeEventListener('click', blockNativeDocumentNavigation)
})
