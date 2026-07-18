// @vitest-environment jsdom

import { useRef } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClientAuthState } from '../../auth/use-auth-state'
import type { QuickSearchRow } from '../shared/quick-search-contracts'
import { QuickSearchProvider, useQuickSearchControls } from './quick-search-provider'

const mocks = vi.hoisted(() => ({
  auth: {
    status: 'ready',
    authState: { status: 'signedOut' },
  } as ClientAuthState,
  convexAuth: { isAuthenticated: false, isLoading: false },
  navigate: vi.fn(),
  provider: vi.fn(),
  users: vi.fn(),
}))

vi.mock('../../shell/public-auth-context', () => ({
  usePublicAuthState: () => mocks.auth,
}))
vi.mock('convex/react', () => ({
  useConvex: () => ({ query: mocks.users }),
  useConvexAuth: () => mocks.convexAuth,
}))
vi.mock('convex/server', () => ({
  makeFunctionReference: (name: string) => name,
}))
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
}))
vi.mock('../server/quick-search.functions', () => ({
  searchQuickCatalog: mocks.provider,
}))
vi.mock('../../profile/server/user-search.functions', () => ({
  searchUsersPreview: async ({ data }: { data: { query: string } }) => (
    await mocks.users('userSearch:searchPreview', { query: data.query })
  ),
}))

const row = (
  id: string,
  label: string,
  destination: string,
): QuickSearchRow => ({
  destination,
  id,
  imageUrl: null,
  label,
  metadata: null,
})

function OpenButton() {
  const ref = useRef<HTMLButtonElement>(null)
  const controls = useQuickSearchControls()
  return (
    <button
      onClick={() => {
        if (!ref.current) throw new Error('Quick Search trigger is unavailable.')
        controls.openSearch(ref.current)
      }}
      ref={ref}
      type="button"
    >
      Open search
    </button>
  )
}

function renderSearch() {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  })
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <QuickSearchProvider><OpenButton /></QuickSearchProvider>
      </QueryClientProvider>,
    ),
  }
}

const setViewport = (desktop: boolean) => {
  const matchMedia = vi.fn<(_query: string) => MediaQueryList>(() => ({
    addEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: desktop,
    media: '(min-width: 48rem)',
    onchange: null,
    removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList)
  vi.stubGlobal('matchMedia', matchMedia)
  return matchMedia
}

const typeValidQuery = async (value: string) => {
  fireEvent.change(screen.getByRole('searchbox'), { target: { value } })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300)
    await Promise.resolve()
  })
}

const settleQueries = async () => {
  await act(async () => {
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(0)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  mocks.auth = { status: 'ready', authState: { status: 'signedOut' } }
  mocks.convexAuth = { isAuthenticated: false, isLoading: false }
  mocks.navigate.mockReset()
  mocks.provider.mockReset().mockResolvedValue({
    anime: [row('1', 'Frieren', '/anime/1/frieren')],
    characters: [],
    staff: [],
  })
  mocks.users.mockReset().mockResolvedValue([])
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('QuickSearchProvider', () => {
  it('does not choose or mount a surface while closed', () => {
    const matchMedia = setViewport(true)
    renderSearch()

    expect(matchMedia).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens one fixed desktop surface and debounces one provider request', async () => {
    const matchMedia = setViewport(true)
    renderSearch()
    fireEvent.click(screen.getByRole('button', { name: 'Open search' }))

    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(20) })
    expect(screen.getByRole('searchbox')).toBe(document.activeElement)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '  frieren  ' } })
    expect(mocks.provider).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(299) })
    expect(mocks.provider).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    await settleQueries()
    expect(screen.getByText('Frieren')).toBeTruthy()
    expect(mocks.provider).toHaveBeenCalledTimes(1)
    expect(mocks.provider).toHaveBeenCalledWith({ data: { query: 'frieren' } })

    matchMedia.mockImplementation(() => ({ matches: false }) as MediaQueryList)
    window.dispatchEvent(new Event('resize'))
    expect(document.querySelector('[data-slot="drawer-popup"]')).toBeNull()
  })

  it('re-evaluates the surface after close completes and reopens', async () => {
    const matchMedia = setViewport(true)
    renderSearch()
    const trigger = screen.getByRole('button', { name: 'Open search' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
    await act(async () => { await vi.runAllTimersAsync() })
    expect(document.activeElement).toBe(trigger)

    matchMedia.mockImplementation(() => ({ matches: false }) as MediaQueryList)
    fireEvent.click(trigger)
    expect(document.querySelector('[data-slot="drawer-popup"]')).not.toBeNull()
    expect(matchMedia).toHaveBeenCalledTimes(2)
  })

  it('mounts mobile field after the scroll region with safe-area padding', () => {
    setViewport(false)
    renderSearch()
    fireEvent.click(screen.getByRole('button', { name: 'Open search' }))

    const popup = document.querySelector('[data-slot="drawer-popup"]')
    const results = document.querySelector('#quick-search-results')?.parentElement?.parentElement
    const footer = document.querySelector('[data-slot="drawer-footer"]')
    const close = screen.getByRole('button', { name: 'Close Quick Search' })
    const closeZone = document.querySelector('[data-slot="quick-search-close-zone"]')
    const handle = document.querySelector('[data-slot="drawer-swipe-handle"]')
    if (!results || !footer || !closeZone || !handle) {
      throw new Error('Mobile Quick Search structure is incomplete.')
    }
    expect(screen.getAllByRole('searchbox')).toHaveLength(1)
    expect(popup?.querySelector('[data-slot="drawer-swipe-handle"]')).not.toBeNull()
    expect(results?.className).toContain('flex min-h-0 flex-1 overflow-y-auto overscroll-contain')
    expect(results?.className).not.toContain('h-full')
    expect(footer?.className).toContain('pb-[max(1rem,env(safe-area-inset-bottom))]')
    expect(results.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Quick Search' }).className).toContain('sr-only')
    expect(screen.getByText(/Search Anime, Characters/).className).toContain('sr-only')
    expect(document.querySelector('[data-slot="drawer-header"]')).toBeNull()
    expect(close.className).toContain('top-3')
    expect(close.className).toContain('size-11')
    expect(handle.className).toContain('group-data-[swipe-axis=y]/drawer-popup:h-3')
    expect(closeZone.className).toContain('h-12')
    expect(closeZone.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const closeBottomPixels = 12 + 44
    const resultsTopPixels = 12 + 48
    expect(resultsTopPixels).toBeGreaterThan(closeBottomPixels)
  })

  it('requests Users only for complete matching auth and keys cache by profile', async () => {
    setViewport(true)
    mocks.auth = {
      status: 'ready',
      authState: {
        status: 'complete',
        email: 'mika@example.com',
        profile: {
          avatarUrl: null,
          id: 'profile-1',
          name: 'Mika',
          username: 'mika',
          visibility: 'private',
        },
      },
    }
    mocks.convexAuth = { isAuthenticated: true, isLoading: false }
    mocks.users.mockResolvedValue([{
      avatarUrl: null,
      id: 'user-2',
      name: 'Fern',
      username: 'fern',
    }])
    const view = renderSearch()
    fireEvent.click(screen.getByRole('button', { name: 'Open search' }))
    await typeValidQuery('fern')
    await settleQueries()
    expect(screen.getByText('@fern')).toBeTruthy()

    expect(mocks.users).toHaveBeenCalledWith('userSearch:searchPreview', { query: 'fern' })
    expect(view.client.getQueryCache().find({
      queryKey: ['quick-search', 'users', 'profile-1', 'fern'],
      exact: true,
    })).toBeTruthy()
  })

  it('keeps successful Users visible when provider fails and retries independently', async () => {
    setViewport(true)
    mocks.auth = {
      status: 'ready',
      authState: {
        status: 'complete',
        email: 'mika@example.com',
        profile: { avatarUrl: null, id: 'p1', name: 'Mika', username: 'mika', visibility: 'public' },
      },
    }
    mocks.convexAuth = { isAuthenticated: true, isLoading: false }
    mocks.provider.mockRejectedValue(new Error('Provider unavailable'))
    mocks.users.mockResolvedValue([{ avatarUrl: null, id: 'u1', name: 'Fern', username: 'fern' }])
    renderSearch()
    fireEvent.click(screen.getByRole('button', { name: 'Open search' }))
    await typeValidQuery('fern')
    await settleQueries()
    expect(screen.getByText('Catalog search failed.')).toBeTruthy()

    expect(screen.getByText('Fern')).toBeTruthy()
    expect(screen.getByText('@fern')).toBeTruthy()
    expect(screen.queryByText('No results found for fern.')).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: 'Retry' })[0]!)
    expect(mocks.provider).toHaveBeenCalledTimes(2)
    expect(mocks.users).toHaveBeenCalledTimes(1)
  })

  it('hides old results immediately and navigates active rows after close completes', async () => {
    setViewport(true)
    renderSearch()
    fireEvent.click(screen.getByRole('button', { name: 'Open search' }))
    await typeValidQuery('frieren')
    await settleQueries()
    expect(screen.getByText('Frieren')).toBeTruthy()
    const input = screen.getByRole('searchbox')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toContain('anime-1')

    fireEvent.change(input, { target: { value: 'fern' } })
    expect(screen.queryByText('Frieren')).toBeNull()
    expect(input.getAttribute('aria-activedescendant')).toBeNull()
    await typeValidQuery('frieren')
    await settleQueries()
    expect(screen.getByText('Frieren')).toBeTruthy()
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mocks.navigate).not.toHaveBeenCalled()
    await act(async () => { await vi.runAllTimersAsync() })
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/anime/1/frieren' })
  })

  it('leaves Enter inactive and closes before click navigation', async () => {
    setViewport(true)
    renderSearch()
    fireEvent.click(screen.getByRole('button', { name: 'Open search' }))
    await typeValidQuery('frieren')
    await settleQueries()
    expect(screen.getByText('Frieren')).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter' })
    expect(mocks.navigate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('option', { name: /Frieren/ }))
    expect(mocks.navigate).not.toHaveBeenCalled()
    await act(async () => { await vi.runAllTimersAsync() })
    expect(mocks.navigate).toHaveBeenCalledTimes(1)
  })

  it('disables invalid lengths and announces the exact maximum', async () => {
    setViewport(true)
    renderSearch()
    fireEvent.click(screen.getByRole('button', { name: 'Open search' }))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'x'.repeat(101) } })
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })

    expect(mocks.provider).not.toHaveBeenCalled()
    expect(mocks.users).not.toHaveBeenCalled()
    expect(screen.getAllByText('Search query must be at most 100 characters.')).toHaveLength(2)
  })

  it('renders global empty only after every eligible lane succeeds empty', async () => {
    setViewport(true)
    mocks.provider.mockResolvedValue({ anime: [], characters: [], staff: [] })
    renderSearch()
    fireEvent.click(screen.getByRole('button', { name: 'Open search' }))
    await typeValidQuery('missing')
    await settleQueries()

    expect(screen.getAllByText('No results found for missing.')).toHaveLength(2)
    expect(mocks.users).not.toHaveBeenCalled()
  })

  it('keeps provider rows when the independent User lane fails', async () => {
    setViewport(true)
    mocks.auth = {
      status: 'ready',
      authState: {
        status: 'complete',
        email: 'mika@example.com',
        profile: { avatarUrl: null, id: 'p1', name: 'Mika', username: 'mika', visibility: 'public' },
      },
    }
    mocks.convexAuth = { isAuthenticated: true, isLoading: false }
    mocks.users.mockRejectedValue(new Error('User query unavailable'))
    renderSearch()
    fireEvent.click(screen.getByRole('button', { name: 'Open search' }))
    await typeValidQuery('frieren')
    await settleQueries()

    expect(screen.getByText('Frieren')).toBeTruthy()
    expect(screen.getByText('User search failed.')).toBeTruthy()
    expect(screen.queryByText('No results found for frieren.')).toBeNull()
  })

  it('never renders a sixth row from an invalid provider response', async () => {
    setViewport(true)
    mocks.provider.mockResolvedValue({
      anime: Array.from({ length: 6 }, (_, index) => (
        row(String(index), `Anime ${index}`, `/anime/${index}/anime`)
      )),
      characters: [],
      staff: [],
    })
    renderSearch()
    fireEvent.click(screen.getByRole('button', { name: 'Open search' }))
    await typeValidQuery('anime')
    await settleQueries()

    expect(screen.getByText('Catalog search failed.')).toBeTruthy()
    expect(screen.queryByText('Anime 5')).toBeNull()
  })

  it('ignores superseded responses and configures non-retrying cached queries', async () => {
    setViewport(true)
    const oldRequest: { resolve?: (value: {
      anime: QuickSearchRow[]
      characters: QuickSearchRow[]
      staff: QuickSearchRow[]
    }) => void } = {}
    mocks.provider.mockImplementation(({ data }: { data: { query: string } }) => {
      if (data.query === 'old') {
        return new Promise((resolve) => { oldRequest.resolve = resolve })
      }
      return Promise.resolve({
        anime: [row('2', 'New result', '/anime/2/new')],
        characters: [],
        staff: [],
      })
    })
    const view = renderSearch()
    fireEvent.click(screen.getByRole('button', { name: 'Open search' }))
    await typeValidQuery('old')
    await typeValidQuery('new')
    await settleQueries()
    expect(screen.getByText('New result')).toBeTruthy()

    if (!oldRequest.resolve) throw new Error('Old request was not started.')
    oldRequest.resolve({
      anime: [row('1', 'Old result', '/anime/1/old')],
      characters: [],
      staff: [],
    })
    await settleQueries()
    expect(screen.queryByText('Old result')).toBeNull()
    const query = view.client.getQueryCache().find({
      exact: true,
      queryKey: ['quick-search', 'provider', 'new'],
    })
    expect(query?.options.retry).toBe(false)
    expect((query?.options as { staleTime?: number }).staleTime).toBe(60_000)
  })

  it('wraps keyboard selection across actual groups only', async () => {
    setViewport(true)
    mocks.provider.mockResolvedValue({
      anime: [row('1', 'Anime result', '/anime/1/a')],
      characters: [],
      staff: [row('2', 'Staff result', '/staff/2/staff')],
    })
    renderSearch()
    fireEvent.click(screen.getByRole('button', { name: 'Open search' }))
    await typeValidQuery('result')
    await settleQueries()
    const input = screen.getByRole('searchbox')

    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input.getAttribute('aria-activedescendant')).toContain('staff-2')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toContain('anime-1')
    expect(screen.getAllByRole('option')).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: /View all/ })).toHaveLength(2)
  })
})
