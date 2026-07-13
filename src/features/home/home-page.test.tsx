// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type AuthState } from '../auth/profile-actions'
import { PublicAuthStateProvider } from '../shell/public-auth-context'
import { HomePage } from './home-page'

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
})

describe('HomePage', () => {
  it('renders content without duplicating the public shell', () => {
    mockAuthState({
      status: 'signedOut',
    })

    render(<PublicAuthStateProvider><HomePage /></PublicAuthStateProvider>)

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

    render(<PublicAuthStateProvider><HomePage /></PublicAuthStateProvider>)

    expect(screen.queryByRole('button', { name: 'Auth' })).toBeNull()

    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull()
  })

  it('does not render shell loading chrome while auth state loads', () => {
    mockPendingAuthState()

    render(<PublicAuthStateProvider><HomePage /></PublicAuthStateProvider>)

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

    render(<PublicAuthStateProvider><HomePage /></PublicAuthStateProvider>)

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

    render(<PublicAuthStateProvider><HomePage /></PublicAuthStateProvider>)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Seasonal Anime' })).toBeTruthy())
    expect(screen.queryByText('What are you watching?')).toBeNull()
  })
})
