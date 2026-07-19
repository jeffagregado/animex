// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { FeedCard } from '#/features/social/shared/social-contracts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProfileActivity } from './profile-activity'
import {
  ProfileFavorites,
  ProfileFavoritesPreview,
} from './profile-favorites'
import { ProfileHeader } from './profile-header'
import {
  ProfilePage,
  ProfileRouteError,
  type ProfileResult,
} from './profile-page'
import { ProfileReviews } from './profile-reviews'
import { useProfilePages } from './use-profile-pages'
import {
  ProfileRouteContent,
  Route as ProfileUserRoute,
} from '../../../routes/_public/_profile/users/$username'
import {
  getProfileAuthDestination,
  loadProfileRouteAuth,
} from '../../../routes/_public/_profile/route'

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: true, isLoading: false },
  profile: undefined as ProfileResult | undefined,
  query: vi.fn(),
  update: vi.fn(),
  client: { query: vi.fn() },
}))

vi.mock('convex/react', () => ({
  useConvex: () => mocks.client,
  useMutation: () => mocks.update,
  useQuery: () => mocks.profile,
  useConvexAuth: () => mocks.auth,
}))
vi.mock('../server/profile-read.functions', () => ({
  getProfileByUsername: async () => mocks.profile,
  getProfileContentPage: async ({
    data,
  }: {
    data: { cursor: string | null; tab: string; username: string }
  }) => await mocks.query(`${data.tab}:listForProfile`, {
    cursor: data.cursor,
    username: data.username,
  }),
}))

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router',
  )
  return {
    ...actual,
    createFileRoute: () => (options: unknown) => {
      if (typeof options !== 'object' || options === null) {
        throw new TypeError('Route options must be an object.')
      }
      return { ...options }
    },
    Link: ({
      children,
      params,
      resetScroll,
      search,
    }: {
      children: React.ReactNode
      params: { username: string }
      resetScroll?: boolean
      search: { tab: string | undefined }
    }) => (
      <a
        data-reset-scroll={String(resetScroll)}
        href={`/users/${params.username}${
          search.tab === undefined ? '' : `?tab=${search.tab}`
        }`}
      >
        {children}
      </a>
    ),
    Outlet: () => <div>Profile child</div>,
  }
})

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
  publicId: `anime_${index + 1}`,
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
    publicId: 'anime_frieren',
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

const renderProfile = (tab: 'activity' | 'reviews' | 'favorites') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfilePage tab={tab} username="rinko" />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mocks.auth = { isAuthenticated: true, isLoading: false }
  mocks.profile = fullProfile
  mocks.query.mockReset()
  mocks.update.mockReset()
  mocks.update.mockResolvedValue(null)
  mocks.query.mockResolvedValue({ items: [], cursor: null, hasMore: false })
  mocks.client.query = mocks.query
  vi.stubGlobal('IntersectionObserver', undefined)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Profile auth and route contract', () => {
  it('owns a retryable child boundary with clear Profile error copy', () => {
    const errorComponent = (
      ProfileUserRoute as unknown as {
        errorComponent?: React.ComponentType<{
          error: Error
          reset: () => void
        }>
      }
    ).errorComponent

    expect(errorComponent).toBeTypeOf('function')
    if (errorComponent === undefined) {
      throw new Error('Profile child error component is required.')
    }
    const cases = [
      ['PROFILE_NOT_FOUND', 'Profile not found'],
      ['Unauthenticated', 'Profile authentication required'],
      ['ZodError', 'Profile data unavailable'],
      ['PROFILE_SERVICE_UNAVAILABLE', 'Profile unavailable'],
    ] as const
    const reset = vi.fn()
    for (const [name, title] of cases) {
      const error = new Error(name)
      error.name = name
      const view = render(<ProfileRouteError error={error} reset={reset} />)
      expect(screen.getByRole('alert').textContent).toContain(title)
      fireEvent.click(screen.getByRole('button', { name: 'Retry Profile' }))
      expect(reset).toHaveBeenCalled()
      view.unmount()
      reset.mockClear()
    }
  })

  it('awaits server auth before protected children and preserves auth errors', async () => {
    const signedOut = {
      ensureQueryData: vi.fn(async () => ({ status: 'signedOut' as const })),
    }
    await expect(loadProfileRouteAuth(
      signedOut,
      '/users/rinko?tab=reviews',
    )).rejects.toMatchObject({
      options: {
        href: '/auth/sign-in?returnTo=%2Fusers%2Frinko%3Ftab%3Dreviews',
      },
    })
    expect(signedOut.ensureQueryData).toHaveBeenCalledOnce()

    const unavailable = {
      ensureQueryData: vi.fn(async () => {
        throw new Error('AUTH_STATE_UNAVAILABLE')
      }),
    }
    await expect(loadProfileRouteAuth(
      unavailable,
      '/users/rinko',
    )).rejects.toThrow('AUTH_STATE_UNAVAILABLE')
  })

  it('preserves a validated signed-out return target and routes pending profile states', () => {
    const target = '/users/rinko?tab=reviews'
    expect(getProfileAuthDestination(
      { status: 'signedOut' },
      target,
    )).toBe('/auth/sign-in?returnTo=%2Fusers%2Frinko%3Ftab%3Dreviews')
    expect(getProfileAuthDestination(
      { status: 'emailUnverified', email: 'rinko@example.test' },
      target,
    )).toBe('/auth/verify-email?returnTo=%2Fusers%2Frinko%3Ftab%3Dreviews')
    expect(getProfileAuthDestination(
      {
        status: 'needsProfile',
        email: 'rinko@example.test',
        signupMethod: 'password',
        suggestedUsername: null,
      },
      target,
    )).toBe('/auth/username?returnTo=%2Fusers%2Frinko%3Ftab%3Dreviews')
    expect(getProfileAuthDestination(
      { status: 'signedOut' },
      '//outside.test',
    )).toBe('/auth/sign-in?returnTo=%2Fhome')
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
  it('hides owner mutations without an auth disagreement alert while Convex auth loads', async () => {
    mocks.auth = { isAuthenticated: false, isLoading: true }
    renderProfile('activity')

    expect(await screen.findByRole('heading', { name: 'Rinko' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Edit Profile' })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows an auth disagreement alert after Convex auth settles unauthenticated', async () => {
    mocks.auth = { isAuthenticated: false, isLoading: false }
    renderProfile('activity')

    expect(await screen.findByRole('heading', { name: 'Rinko' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Edit Profile' })).toBeNull()
    expect(screen.getByRole('alert').textContent).toContain(
      'Profile changes are unavailable.',
    )
  })

  it('opens all favorites through typed Profile navigation without resetting scroll', () => {
    render(<ProfileFavoritesPreview favorites={[]} username="rinko" />)

    const link = screen.getByRole('link', { name: 'See all' })
    expect(link.getAttribute('href')).toBe('/users/rinko?tab=favorites')
    expect(link.getAttribute('data-reset-scroll')).toBe('false')
  })

  it('renders owner identity, edit callback, four stats, and ten latest favorites', async () => {
    const onEditProfile = vi.fn()
    render(<ProfileHeader owner profile={header} onEditProfile={onEditProfile} />)
    const editTrigger = screen.getByRole('button', { name: 'Edit Profile' })
    fireEvent.click(editTrigger)
    expect(onEditProfile).toHaveBeenCalledWith(editTrigger)
    cleanup()

    renderProfile('activity')
    expect(await screen.findByRole('heading', { name: 'Rinko' })).toBeTruthy()
    expect(screen.getByText('@rinko')).toBeTruthy()
    expect(screen.getByText('132')).toBeTruthy()
    expect(screen.getByText('24')).toBeTruthy()
    expect(screen.getByText('31')).toBeTruthy()
    expect(screen.getByText('6')).toBeTruthy()
    const favoriteLinks = screen.getAllByRole('link', { name: /Favorite \d+/ })
    expect(favoriteLinks).toHaveLength(10)
    expect(favoriteLinks[0]?.getAttribute('href')).toBe('/anime/anime_1/anime-1')
    await waitFor(() => expect(mocks.query).toHaveBeenCalled())
  })

  it('keeps the controlled dialog mounted while closing and restores its real trigger', async () => {
    let finishClose!: () => void
    const closeFinished = new Promise<void>((resolve) => {
      finishClose = resolve
    })
    const animationDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'getAnimations',
    )
    Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
      configurable: true,
      value(this: HTMLElement): Animation[] {
        if (!this.hasAttribute('data-closed')) return []
        return [{
          finished: closeFinished,
          pending: true,
          playState: 'running',
        } as unknown as Animation]
      },
    })
    const distractor = document.createElement('button')
    distractor.textContent = 'Distractor'
    document.body.append(distractor)
    distractor.focus()
    try {
      renderProfile('activity')
      const editTrigger = await screen.findByRole('button', {
        name: 'Edit Profile',
      })

      fireEvent.click(editTrigger)
      expect(await screen.findByRole('dialog', { name: 'Edit Profile' })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      const closingDialog = document.querySelector<HTMLElement>('[role="dialog"]')
      expect(closingDialog?.hasAttribute('data-closed')).toBe(true)
      await act(async () => finishClose())
      await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
      expect(document.activeElement).toBe(editTrigger)
    } finally {
      distractor.remove()
      if (animationDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          'getAnimations',
          animationDescriptor,
        )
      } else {
        delete (HTMLElement.prototype as { getAnimations?: () => Animation[] })
          .getAnimations
      }
    }
  })

  it('saves an owner Profile Visibility change from Private to Public', async () => {
    mocks.profile = {
      ...fullProfile,
      profile: {
        ...fullProfile.profile,
        profileVisibility: 'private',
      },
    }
    renderProfile('activity')

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Profile' }))
    const visibility = await screen.findByRole('combobox', {
      name: /Profile Visibility/,
    })
    expect((visibility as HTMLSelectElement).value).toBe('private')
    fireEvent.change(visibility, { target: { value: 'public' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({
      name: 'Rinko',
      bio: 'Reviews, seasonals, and quiet fantasy picks.',
      profileVisibility: 'public',
    }))
  })

  it('shows only header and privacy notice for a Private profile viewer', async () => {
    mocks.profile = {
      access: 'header',
      owner: false,
      profile: { ...header, profileVisibility: 'private' },
    }
    renderProfile('reviews')
    expect(await screen.findByRole('heading', { name: 'Rinko' })).toBeTruthy()
    expect(screen.getByText(/profile is private/i)).toBeTruthy()
    expect(screen.queryByText('List Progress')).toBeNull()
    expect(mocks.query).not.toHaveBeenCalled()
  })

  it('keeps social, list, and genre UI out of Profile', async () => {
    renderProfile('activity')
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
  it('deduplicates Favorites by public Anime identity', async () => {
    const first = {
      anime: favorites[0]!,
      favoriteAt: 2,
    }
    const second = {
      anime: favorites[1]!,
      favoriteAt: 1,
    }
    mocks.query
      .mockResolvedValueOnce({
        items: [first],
        cursor: 'next',
        hasMore: true,
      })
      .mockResolvedValueOnce({
        items: [{ ...first, favoriteAt: 3 }, second],
        cursor: null,
        hasMore: false,
      })
    const { result } = renderHook(() => useProfilePages(
      'rinko',
      'favorites',
      true,
    ))
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    await act(async () => {
      await result.current.loadMore()
    })
    expect(result.current.items.map((item) => item.anime.publicId)).toEqual([
      'anime_1',
      'anime_2',
    ])
  })

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
