// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import type { ClientAuthState } from '#/features/auth/use-auth-state'
import type { FeedCard } from '#/features/social/shared/social-contracts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProfileActivity } from './profile-activity'
import { ProfileFavorites } from './profile-favorites'
import { ProfileHeader } from './profile-header'
import { ProfilePage, type ProfileResult } from './profile-page'
import { ProfileReviews } from './profile-reviews'
import { useProfilePages } from './use-profile-pages'
import {
  ProfileRouteContent,
} from '../../../routes/_public/_profile/users/$username'
import {
  canMountProfile,
  getProfileDestination,
} from '../../../routes/_public/_profile/route'

const mocks = vi.hoisted(() => ({
  profile: undefined as ProfileResult | undefined,
  query: vi.fn(),
  client: { query: vi.fn() },
}))

vi.mock('convex/react', () => ({
  useConvex: () => mocks.client,
  useQuery: () => mocks.profile,
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}))

vi.mock('@tanstack/react-router', async (load) => {
  const actual = await load<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (options: unknown) => ({ ...options }),
    Outlet: () => <div>Profile child</div>,
  }
})

const complete: ClientAuthState = {
  status: 'ready',
  authState: {
    status: 'complete',
    email: 'rinko@example.test',
    profile: {
      id: 'user-rinko',
      username: 'rinko',
      name: 'Rinko',
      avatarUrl: null,
      visibility: 'public',
    },
  },
}

const header = {
  id: 'user-rinko',
  username: 'rinko',
  name: 'Rinko',
  bio: 'Reviews, seasonals, and quiet fantasy picks.',
  avatarUrl: null,
  bannerUrl: null,
  profileVisibility: 'public' as const,
}

const favorites = Array.from({ length: 10 }, (_, index) => ({
  anilistId: index + 1,
  slug: `anime-${index + 1}`,
  title: `Favorite ${index + 1}`,
  coverImageUrl: null,
}))

const fullProfile: ProfileResult = {
  access: 'full',
  owner: true,
  profile: {
    ...header,
    progress: { completed: 132, watching: 24, planned: 31, dropped: 6 },
    favorites,
  },
}

const activity: FeedCard = {
  id: 'activity-1',
  kind: 'completed',
  author: {
    id: 'user-rinko',
    username: 'rinko',
    displayName: 'Rinko',
    avatarUrl: null,
  },
  anime: {
    anilistId: 1,
    slug: 'frieren',
    title: 'Frieren',
    coverImageUrl: null,
    format: 'TV',
    seasonYear: 2023,
  },
  settledAt: 1,
  visibility: 'public',
}

const page = <T,>(items: T[], values: Partial<{
  error: string | null
  hasMore: boolean
  initialLoading: boolean
  loadingMore: boolean
}>) => ({
  items,
  cursor: values.hasMore ? 'next' : null,
  hasMore: values.hasMore ?? false,
  error: values.error ?? null,
  initialLoading: values.initialLoading ?? false,
  loadingMore: values.loadingMore ?? false,
  loadMore: vi.fn(async () => undefined),
  retry: vi.fn(async () => undefined),
})

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((pass, fail) => {
    resolve = pass
    reject = fail
  })
  return { promise, reject, resolve }
}

beforeEach(() => {
  mocks.profile = fullProfile
  mocks.query.mockReset()
  mocks.query.mockResolvedValue({ items: [], cursor: null, hasMore: false })
  mocks.client.query = mocks.query
  vi.stubGlobal('IntersectionObserver', undefined)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Profile auth and route contract', () => {
  it('preserves a validated signed-out return target and routes pending profile states', () => {
    const target = '/users/rinko?tab=reviews'
    expect(getProfileDestination(
      { status: 'ready', authState: { status: 'signedOut' } },
      target,
    )).toBe('/auth/sign-in?returnTo=%2Fusers%2Frinko%3Ftab%3Dreviews')
    expect(getProfileDestination(
      {
        status: 'ready',
        authState: { status: 'emailUnverified', email: 'rinko@example.test' },
      },
      target,
    )).toBe('/auth/verify-email?returnTo=%2Fusers%2Frinko%3Ftab%3Dreviews')
    expect(getProfileDestination(
      {
        status: 'ready',
        authState: {
          status: 'needsProfile',
          email: 'rinko@example.test',
          signupMethod: 'password',
          suggestedUsername: null,
        },
      },
      target,
    )).toBe('/auth/username?returnTo=%2Fusers%2Frinko%3Ftab%3Dreviews')
    expect(getProfileDestination(
      { status: 'ready', authState: { status: 'signedOut' } },
      '//outside.test',
    )).toBe('/auth/sign-in?returnTo=%2Fhome')
  })

  it('blocks child mounting until public and Convex auth agree', () => {
    expect(canMountProfile({ status: 'loading' }, false)).toBe(false)
    expect(canMountProfile(complete, false)).toBe(false)
    expect(canMountProfile(complete, true)).toBe(true)
  })

  it('replaces invalid tabs before any profile query hook mounts', () => {
    const navigate = vi.fn()
    render(
      <ProfileRouteContent
        navigate={navigate}
        rawTab="likes"
        username="rinko"
      />,
    )
    expect(mocks.query).not.toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith({
      replace: true,
      resetScroll: false,
      search: { tab: 'activity' },
    })
  })
})

describe('Profile responsive content contract', () => {
  it('renders owner identity, edit callback, four stats, and ten latest favorites', async () => {
    const onEditProfile = vi.fn()
    render(<ProfileHeader owner profile={header} onEditProfile={onEditProfile} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }))
    expect(onEditProfile).toHaveBeenCalledOnce()
    cleanup()

    render(<ProfilePage tab="activity" username="rinko" />)
    expect(screen.getByRole('heading', { name: 'Rinko' })).toBeTruthy()
    expect(screen.getByText('@rinko')).toBeTruthy()
    expect(screen.getByText('132')).toBeTruthy()
    expect(screen.getByText('24')).toBeTruthy()
    expect(screen.getByText('31')).toBeTruthy()
    expect(screen.getByText('6')).toBeTruthy()
    expect(screen.getAllByRole('link', { name: /Favorite \d+/ })).toHaveLength(10)
    await waitFor(() => expect(mocks.query).toHaveBeenCalled())
  })

  it('shows only header and privacy notice for a Private profile viewer', () => {
    mocks.profile = {
      access: 'header',
      owner: false,
      profile: { ...header, profileVisibility: 'private' },
    }
    render(<ProfilePage tab="reviews" username="rinko" />)
    expect(screen.getByRole('heading', { name: 'Rinko' })).toBeTruthy()
    expect(screen.getByText(/profile is private/i)).toBeTruthy()
    expect(screen.queryByText('List Progress')).toBeNull()
    expect(mocks.query).not.toHaveBeenCalled()
  })

  it('keeps social, list, and genre UI out of Profile', async () => {
    render(<ProfilePage tab="activity" username="rinko" />)
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeTruthy())
    for (const banned of [
      'Follow',
      'Followers',
      'Following',
      'Like',
      'Comment',
      'Anime List',
      'Favorite Genres',
    ]) {
      expect(screen.queryByText(banned, { exact: false })).toBeNull()
    }
  })
})

describe('Profile tab states', () => {
  it('renders independent loading, error, empty, end, and visible load-more states', () => {
    const loadMore = vi.fn(async () => undefined)
    const retry = vi.fn(async () => undefined)
    const loading = page([], { initialLoading: true })
    const failed = { ...page([], {}), error: 'Reviews failed.', retry }
    const empty = page([], {})
    const more = { ...page([activity], { hasMore: true }), loadMore }

    const view = render(<ProfileFavorites state={loading} />)
    expect(screen.getByLabelText('Loading favorites')).toBeTruthy()
    view.rerender(<ProfileReviews state={failed} />)
    expect(screen.getByRole('alert').textContent).toContain('Reviews failed.')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(retry).toHaveBeenCalledOnce()
    view.rerender(<ProfileActivity state={empty} />)
    expect(screen.getByText('No activity yet')).toBeTruthy()
    view.rerender(<ProfileActivity state={more} />)
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(loadMore).toHaveBeenCalledOnce()
    view.rerender(<ProfileActivity state={page([activity], {})} />)
    expect(screen.getByText(/end of activity/i)).toBeTruthy()
  })

  it('keeps Load more visible while intersection also loads automatically', () => {
    const loadMore = vi.fn(async () => undefined)
    let intersect!: IntersectionObserverCallback
    class Observer {
      constructor(callback: IntersectionObserverCallback) {
        intersect = callback
      }
      disconnect() {}
      observe() {}
      unobserve() {}
      takeRecords(): IntersectionObserverEntry[] { return [] }
    }
    vi.stubGlobal('IntersectionObserver', Observer)
    render(
      <ProfileActivity
        state={{ ...page([activity], { hasMore: true }), loadMore }}
      />,
    )
    expect(screen.getByRole('button', { name: 'Load more' })).toBeTruthy()
    act(() => {
      intersect(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
    })
    expect(loadMore).toHaveBeenCalledOnce()
  })

  it('keeps legal empty continuation pages non-terminal across every tab', () => {
    const loadMore = vi.fn(async () => undefined)
    let intersect!: IntersectionObserverCallback
    class Observer {
      constructor(callback: IntersectionObserverCallback) {
        intersect = callback
      }
      disconnect() {}
      observe() {}
      unobserve() {}
      takeRecords(): IntersectionObserverEntry[] { return [] }
    }
    vi.stubGlobal('IntersectionObserver', Observer)
    const continuing = { ...page([], { hasMore: true }), loadMore }
    const view = render(<ProfileActivity state={continuing} />)

    expect(screen.queryByText('No activity yet')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    act(() => {
      intersect(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
    })
    expect(loadMore).toHaveBeenCalledTimes(2)

    view.rerender(<ProfileReviews state={continuing} />)
    expect(screen.queryByText('No reviews yet')).toBeNull()
    expect(screen.getByRole('button', { name: 'Load more' })).toBeTruthy()

    view.rerender(<ProfileFavorites state={continuing} />)
    expect(screen.queryByText('No favorites yet')).toBeNull()
    expect(screen.getByRole('button', { name: 'Load more' })).toBeTruthy()
  })
})

describe('Profile cursor pages', () => {
  it('deduplicates one in-flight cursor and merges document IDs once', async () => {
    mocks.query
      .mockResolvedValueOnce({
        items: [activity],
        cursor: 'next',
        hasMore: true,
      })
      .mockResolvedValueOnce({
        items: [
          activity,
          { ...activity, id: 'activity-2' },
        ],
        cursor: null,
        hasMore: false,
      })
    const { result } = renderHook(() => useProfilePages(
      'rinko',
      'activity',
      true,
    ))
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    await act(async () => {
      await Promise.all([result.current.loadMore(), result.current.loadMore()])
    })
    expect(mocks.query).toHaveBeenCalledTimes(2)
    expect(result.current.items.map((item) => item.id)).toEqual([
      'activity-1',
      'activity-2',
    ])
  })

  it('drops stale scope results after username changes', async () => {
    const oldPage = deferred<{
      items: FeedCard[]
      cursor: string | null
      hasMore: boolean
    }>()
    mocks.query
      .mockReturnValueOnce(oldPage.promise)
      .mockResolvedValueOnce({
        items: [{ ...activity, id: 'new-activity' }],
        cursor: null,
        hasMore: false,
      })
    const { result, rerender } = renderHook(
      ({ username }) => useProfilePages(username, 'activity', true),
      { initialProps: { username: 'old-user' } },
    )
    rerender({ username: 'new-user' })
    await waitFor(() => expect(result.current.items[0]?.id).toBe('new-activity'))
    oldPage.resolve({ items: [activity], cursor: null, hasMore: false })
    await act(async () => { await oldPage.promise })
    expect(result.current.items[0]?.id).toBe('new-activity')
  })
})
