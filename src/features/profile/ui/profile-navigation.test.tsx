// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { ProfilePage, type ProfileResult } from './profile-page'

const mocks = vi.hoisted(() => ({
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
  query: vi.fn(),
}))

vi.mock('convex/react', () => ({
  useConvex: () => ({ query: mocks.query }),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useMutation: () => vi.fn(),
  useQuery: () => mocks.profile,
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('changes Profile tabs through router history without scroll reset', async () => {
  mocks.query.mockResolvedValue(mocks.page)
  const root = createRootRoute()
  const profile = createRoute({
    component: () => <ProfilePage tab="activity" username="mika" />,
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

  let preventedByProfileLink = false
  const stopDocumentNavigation = (event: MouseEvent): void => {
    preventedByProfileLink = event.defaultPrevented
    event.preventDefault()
  }
  document.addEventListener('click', stopDocumentNavigation, { once: true })
  fireEvent.click(await screen.findByRole('link', { name: 'reviews' }))
  expect(preventedByProfileLink).toBe(true)
  expect(scrollTo).not.toHaveBeenCalled()
})
