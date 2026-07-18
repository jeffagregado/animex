// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  resolveUserSearchQuery,
  UserSearchPage,
} from './user-search-page'
import { getProfileDestination } from '#/routes/_public/_profile/route'

const convex = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('convex/react', () => ({ useConvex: () => convex }))

const user = (id: string, username: string, name: string): {
  avatarUrl: string | null
  id: string
  name: string
  username: string
} => ({
  id,
  username,
  name,
  avatarUrl: null,
})
const result = (
  page: ReturnType<typeof user>[],
  continueCursor: string,
  isDone: boolean,
) => ({ page, continueCursor, isDone })
const renderPage = (query: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(<QueryClientProvider client={client}><UserSearchPage onQuerySubmit={vi.fn()} query={query} /></QueryClientProvider>)
}

afterEach(() => {
  cleanup()
  convex.query.mockReset()
  vi.unstubAllGlobals()
})

describe('UserSearchPage', () => {
  it('keeps missing, trim, 1, 2, 100, and 101-character URL states distinct', () => {
    expect(resolveUserSearchQuery(undefined)).toMatchObject({ canonicalSearch: {}, query: '', shouldRequest: false })
    expect(resolveUserSearchQuery(' x ')).toMatchObject({ canonicalSearch: { q: 'x' }, query: 'x', shouldReplace: true, shouldRequest: false })
    expect(resolveUserSearchQuery(' Ab ')).toMatchObject({ canonicalSearch: { q: 'Ab' }, query: 'Ab', shouldRequest: true })
    expect(resolveUserSearchQuery('x'.repeat(100)).shouldRequest).toBe(true)
    expect(resolveUserSearchQuery('x'.repeat(101))).toMatchObject({
      error: 'Search query must be 100 characters or fewer.',
      query: 'x'.repeat(101),
      shouldRequest: false,
    })
  })

  it('never requests below minimum or above maximum', () => {
    renderPage('x')
    cleanup()
    renderPage('x'.repeat(101))
    expect(convex.query).not.toHaveBeenCalled()
  })

  it('preserves exact protected User-search return target through the parent guard', () => {
    expect(getProfileDestination(
      { status: 'ready', authState: { status: 'signedOut' } },
      '/search/users?q=Case%20Sensitive',
    )).toBe('/auth/sign-in?returnTo=%2Fsearch%2Fusers%3Fq%3DCase%2520Sensitive')
    expect(convex.query).not.toHaveBeenCalled()
  })

  it('requests identity-only 20-row cursor pages and preserves first-seen order', async () => {
    convex.query
      .mockResolvedValueOnce(result([user('2', 'two', 'Second'), user('1', 'one', 'First')], 'next', false))
      .mockResolvedValueOnce(result([user('2', 'duplicate', 'Duplicate'), user('3', 'three', 'Third')], '', true))
    renderPage('Fan')
    await screen.findByText('Second')
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    await screen.findByText('Third')
    expect(screen.getAllByRole('link').map((link) => within(link).getByRole('heading').textContent)).toEqual(['Second', 'First', 'Third'])
    expect(screen.getByRole('link', { name: /Third/ }).getAttribute('href')).toBe('/users/three')
    expect(convex.query.mock.calls.map(([, args]) => args)).toEqual([
      { query: 'Fan', paginationOpts: { cursor: null, numItems: 20 } },
      { query: 'Fan', paginationOpts: { cursor: 'next', numItems: 20 } },
    ])
    expect(document.body.textContent).not.toMatch(/email|visibility|bio|stats/i)
  })

  it('raises explicit repeated-cursor pagination error and retries same cursor', async () => {
    convex.query
      .mockResolvedValueOnce(result([user('1', 'one', 'First')], 'next', false))
      .mockResolvedValueOnce(result([user('2', 'two', 'Second')], 'next', false))
      .mockResolvedValueOnce(result([user('2', 'two', 'Second')], '', true))
    renderPage('ab')
    await screen.findByText('First')
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect((await screen.findByRole('alert')).textContent).toContain('invalid pagination cursor')
    expect(screen.getByText('First')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Second')).toBeTruthy()
    await waitFor(() => expect(convex.query).toHaveBeenCalledTimes(3))
  })

  it('rejects an A to B to A cursor cycle and retries the failed B page', async () => {
    convex.query
      .mockResolvedValueOnce(result([user('1', 'one', 'First')], 'A', false))
      .mockResolvedValueOnce(result([user('2', 'two', 'Second')], 'B', false))
      .mockResolvedValueOnce(result([user('3', 'three', 'Third')], 'A', false))
      .mockResolvedValueOnce(result([user('3', 'three', 'Third')], '', true))
    renderPage('ab')
    await screen.findByText('First')
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    await screen.findByText('Second')
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect((await screen.findByRole('alert')).textContent).toContain('invalid pagination cursor')
    expect(screen.queryByText('Third')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Third')).toBeTruthy()
    expect(convex.query.mock.calls.map(([, args]) => args.paginationOpts.cursor)).toEqual([
      null,
      'A',
      'B',
      'B',
    ])
  })

  it('resets cursor history when a full infinite query refetch restarts at null', async () => {
    convex.query
      .mockResolvedValueOnce(result([user('1', 'one', 'First')], 'A', false))
      .mockResolvedValueOnce(result([user('2', 'two', 'Second')], '', true))
      .mockResolvedValueOnce(result([user('1', 'one', 'First')], 'A', false))
      .mockResolvedValueOnce(result([user('2', 'two', 'Second')], '', true))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><UserSearchPage onQuerySubmit={vi.fn()} query="ab" /></QueryClientProvider>)
    await screen.findByText('First')
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    await screen.findByText('Second')

    await act(async () => {
      await client.refetchQueries({ exact: true, queryKey: ['user-search', 'ab'] })
    })

    expect(client.getQueryState(['user-search', 'ab'])?.error).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(convex.query.mock.calls.map(([, args]) => args.paginationOpts.cursor)).toEqual([
      null,
      'A',
      null,
      'A',
    ])
  })

  it('retries the failed continuation after an empty successful first page', async () => {
    convex.query
      .mockResolvedValueOnce(result([], 'next', false))
      .mockRejectedValueOnce(new Error('Cursor unavailable.'))
      .mockResolvedValueOnce(result([user('1', 'one', 'First')], '', true))
    renderPage('ab')
    expect((await screen.findByRole('alert')).textContent).toContain('Cursor unavailable.')
    expect(screen.queryByText('No users found.')).toBeNull()
    expect(screen.queryByText('End of results.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('First')).toBeTruthy()
    expect(convex.query.mock.calls.map(([, args]) => args.paginationOpts.cursor)).toEqual([
      null,
      'next',
      'next',
    ])
  })

  it('fails visibly when runtime payload exposes an unexpected field', async () => {
    convex.query.mockResolvedValueOnce({
      ...result([], '', true),
      email: 'private@example.com',
    })
    renderPage('ab')
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText('private@example.com')).toBeNull()
  })

  it('renders labelled 64px shared avatars for valid and missing images', async () => {
    convex.query.mockResolvedValueOnce(result([
      { ...user('1', 'mika', 'Mika'), avatarUrl: 'https://example.test/mika.jpg' },
      user('2', 'sora', 'Sora'),
    ], '', true))
    renderPage('mi')

    const mika = await screen.findByRole('img', { name: 'Mika avatar' })
    const sora = screen.getByRole('img', { name: 'Sora avatar' })
    for (const avatar of [mika, sora]) {
      expect(avatar.className).toContain('size-16')
      expect(avatar.className).toContain('rounded-full')
    }
    expect(sora.textContent).toBe('S')
  })
})
