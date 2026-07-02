// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type AuthState } from '../auth/profile-actions'
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

const getHeaderQueries = () => {
  const header = document.querySelector('header')
  if (header === null) {
    throw new Error('Expected home page header.')
  }
  return within(header)
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('HomePage', () => {
  it('renders the AnimeX shell navigation and feed preview', () => {
    mockAuthState({
      status: 'signedOut',
      email: null,
      emailVerified: false,
      profile: null,
    })

    render(<HomePage />)

    expect(screen.getByRole('link', { name: /AnimeX/i })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Mobile' })).toBeTruthy()
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

  it('shows sign-in action for signed-out users', async () => {
    mockAuthState({
      status: 'signedOut',
      email: null,
      emailVerified: false,
      profile: null,
    })

    render(<HomePage />)

    expect(screen.queryByRole('button', { name: 'Auth' })).toBeNull()

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy()
    })

    const header = getHeaderQueries()
    expect(header.getByRole('button', { name: 'Search' })).toBeTruthy()
    expect(header.queryByRole('button', { name: 'Notifications' })).toBeNull()
    expect(header.queryByRole('button', { name: 'Profile' })).toBeNull()
  })

  it('shows a header auth skeleton while auth state loads', () => {
    mockPendingAuthState()

    render(<HomePage />)

    const header = getHeaderQueries()
    expect(header.queryByRole('link', { name: 'Sign in' })).toBeNull()
    expect(document.querySelector('[data-testid="header-auth-skeleton"]')).toBeTruthy()
  })

  it('shows sign-out action for signed-in users', async () => {
    mockAuthState({
      status: 'complete',
      email: 'mika@example.com',
      emailVerified: true,
      profile: {},
    })

    render(<HomePage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()
    })

    const header = getHeaderQueries()
    expect(header.getByRole('button', { name: 'Search' })).toBeTruthy()
    expect(header.getByRole('button', { name: 'Notifications' })).toBeTruthy()
    expect(header.getByRole('button', { name: 'Profile' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'My Anime' })).toBeTruthy()
    expect(screen.getByText('What are you watching?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Following' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Global' })).toBeTruthy()
  })

  it('keeps pending users signed in but hides private actions', async () => {
    mockAuthState({
      status: 'needsProfile',
      email: 'mika@example.com',
      emailVerified: true,
      profile: null,
    })

    render(<HomePage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()
    })

    const header = getHeaderQueries()
    expect(header.getByRole('button', { name: 'Search' })).toBeTruthy()
    expect(header.queryByRole('button', { name: 'Notifications' })).toBeNull()
    expect(header.queryByRole('button', { name: 'Profile' })).toBeNull()
    expect(screen.queryByText('What are you watching?')).toBeNull()
  })
})
