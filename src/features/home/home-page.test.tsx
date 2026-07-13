// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { getFunctionName } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type AuthState } from '../auth/profile-actions'
import { PublicAuthStateProvider } from '../shell/public-auth-context'
import { HomePage } from './home-page'

const convex = vi.hoisted(() => ({ authenticated: true, query: vi.fn(async (..._args: unknown[]) => ({ items: [], cursor: null, hasMore: false })), mutation: vi.fn(() => vi.fn()) }))
vi.mock('convex/react', () => ({ useConvexAuth: () => ({ isAuthenticated: convex.authenticated, isLoading: false }), useConvex: () => ({ query: convex.query }), useMutation: convex.mutation }))
const home = <HomePage onSearchChange={() => undefined} search={{ feed: 'home', compose: false }} />

const mockAuthState = (state: AuthState): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      return {
        ok: true,
        json: async () => state,
      } as Response
    }),
  )
}

const mockPendingAuthState = (): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  convex.authenticated = true
  convex.query.mockClear()
  convex.mutation.mockClear()
})

describe('HomePage', () => {
  it('renders content without duplicating the public shell', () => {
    mockAuthState({
      status: 'signedOut',
    })

    render(<PublicAuthStateProvider>{home}</PublicAuthStateProvider>)

    expect(screen.queryByRole('link', { name: /AnimeX/i })).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Mobile' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Community' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Stats' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Seasonal Anime' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'My Anime' })).toBeNull()
    expect(screen.queryByText('What are you watching?')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Following' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Global' })).toBeNull()
    expect(screen.queryByText('Create')).toBeNull()
    expect(screen.queryByText('Profile')).toBeNull()
  })

  it('shows no shell auth controls for signed-out users', () => {
    mockAuthState({
      status: 'signedOut',
    })

    render(<PublicAuthStateProvider>{home}</PublicAuthStateProvider>)

    expect(screen.queryByRole('button', { name: 'Auth' })).toBeNull()

    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull()
  })

  it('does not render shell loading chrome while auth state loads', () => {
    mockPendingAuthState()

    render(<PublicAuthStateProvider>{home}</PublicAuthStateProvider>)

    expect(document.querySelector('[data-testid="header-auth-skeleton"]')).toBeNull()
  })

  it('shows private content for signed-in users', async () => {
    mockAuthState({
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

    render(<PublicAuthStateProvider>{home}</PublicAuthStateProvider>)

    await waitFor(() => expect(screen.getByRole('tab', { name: 'home' })).toBeTruthy())
    expect(screen.queryByRole('heading', { name: 'My Anime' })).toBeNull()
    expect(screen.getByText('What are you watching?')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'following' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'global' })).toBeTruthy()
  })

  it('keeps pending users signed in but hides private actions', async () => {
    mockAuthState({
      status: 'needsProfile',
      email: 'mika@example.com',
      signupMethod: 'password',
      suggestedUsername: null,
    })

    render(<PublicAuthStateProvider>{home}</PublicAuthStateProvider>)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Seasonal Anime' })).toBeTruthy())
    expect(screen.queryByText('What are you watching?')).toBeNull()
  })

  it('waits for Convex auth before mounting private Home actions', async () => {
    convex.authenticated = false
    convex.query.mockResolvedValue({ items: [{ id: 'card', kind: 'post', postId: 'post', author: { id: 'profile-1', username: 'mika', displayName: 'Mika', avatarUrl: null }, text: 'Public card', imageIds: [], imageUrls: [], hasSpoiler: false, visibility: 'public', createdAt: 1, updatedAt: 1 }], cursor: null, hasMore: false } as never)
    mockAuthState({ status: 'complete', email: 'mika@example.com', profile: { id: 'profile-1', username: 'mika', name: 'Mika', avatarUrl: null, visibility: 'private' } })
    const view = render(<PublicAuthStateProvider>{home}</PublicAuthStateProvider>)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Global' })).toBeTruthy())
    await waitFor(() => expect(getFunctionName(convex.query.mock.calls.at(-1)?.[0] as Parameters<typeof getFunctionName>[0])).toBe('feed:listGlobal'))
    await screen.findByText('Public card')
    expect(screen.queryByText('What are you watching?')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Owner actions' })).toBeNull()
    expect(convex.mutation).not.toHaveBeenCalled()
    convex.authenticated = true
    view.rerender(<PublicAuthStateProvider>{home}</PublicAuthStateProvider>)
    await waitFor(() => expect(screen.getByRole('tab', { name: 'home' })).toBeTruthy())
    await waitFor(() => expect(getFunctionName(convex.query.mock.calls.at(-1)?.[0] as Parameters<typeof getFunctionName>[0])).toBe('feed:listHome'))
    expect(screen.getByText('What are you watching?')).toBeTruthy()
  })
})
