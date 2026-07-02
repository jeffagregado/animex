// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { ForgotPasswordPage } from './forgot-password-page'
import { getOAuthRedirectPath } from './oauth-callback-page'
import { ResetPasswordPage } from './reset-password-page'
import { SignInPage } from './sign-in-page'
import { SignUpPage } from './sign-up-page'
import { UsernamePage } from './username-page'
import { VerifyEmailPage } from './verify-email-page'

const mockSignedOutState = (): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          status: 'signedOut',
          email: null,
          emailVerified: false,
          profile: null,
        }),
      } as Response
    }),
  )
}

const mockNeedsProfileState = (): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          status: 'needsProfile',
          email: 'user@example.com',
          emailVerified: true,
          profile: null,
        }),
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
  window.history.replaceState(null, '', '/')
})

describe('auth pages', () => {
  test('renders sign-in form with Google entry and forgot-password link', () => {
    mockSignedOutState()

    render(<SignInPage />)

    expect(screen.getAllByRole('link', { name: 'AnimeX home' }).length).toBeGreaterThan(1)
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Community' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Stats' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeTruthy()
    expect(screen.getByLabelText('Account Email')).toBeTruthy()
    expect(screen.getByLabelText('Password')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Show password' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toBeTruthy()
  })

  test('renders create account form without username', () => {
    mockSignedOutState()

    render(<SignUpPage />)

    expect(screen.getByRole('heading', { name: 'Create Account' })).toBeTruthy()
    expect(screen.queryByLabelText('Username')).toBeNull()
    expect(screen.getByLabelText('Account Email')).toBeTruthy()
    expect(screen.getByLabelText('Password')).toBeTruthy()
    expect(screen.getByLabelText('Confirm Password')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Show password' })).toHaveLength(2)
  })

  test('toggles password visibility in sign-in', () => {
    mockSignedOutState()

    render(<SignInPage />)

    const passwordInput = screen.getByLabelText('Password')
    expect(passwordInput).toHaveProperty('type', 'password')

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))

    expect(passwordInput).toHaveProperty('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeTruthy()
  })

  test('renders verification and recovery forms', () => {
    mockSignedOutState()

    render(<VerifyEmailPage />)
    expect(screen.getByRole('heading', { name: 'Verify Email' })).toBeTruthy()
    expect(screen.getByLabelText('Verification Code')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Verify Email' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Resend code' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Go back' })).toBeTruthy()

    render(<ForgotPasswordPage />)
    expect(screen.getByRole('heading', { name: 'Reset Password' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Send Reset Link' })).toBeTruthy()

    render(<ResetPasswordPage token={null} />)
    expect(screen.getByRole('heading', { name: 'Set New Password' })).toBeTruthy()
    expect(screen.getByText('Reset link is invalid or expired. Request a new one.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Request a new reset link' })).toBeTruthy()
  })

  test('renders reset password fields before submit token validation', () => {
    mockPendingAuthState()
    window.history.replaceState(null, '', '/auth/reset-password?token=reset-token')

    render(<ResetPasswordPage token="reset-token" />)

    expect(screen.getByRole('heading', { name: 'Set New Password' })).toBeTruthy()
    expect(screen.getByLabelText('Password')).toBeTruthy()
    expect(screen.getByLabelText('Confirm Password')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Set New Password' })).toBeTruthy()
    expect(screen.queryByText('Checking reset link.')).toBeNull()
  })

  test('renders reset password page without browser globals during SSR', () => {
    vi.stubGlobal('window', undefined)

    expect(() => renderToString(<ResetPasswordPage token={null} />)).not.toThrow()
  })

  test('prefills verification email from query params', async () => {
    mockSignedOutState()
    window.history.replaceState(null, '', '/auth/verify-email?email=Mika%40Example.com')

    render(<VerifyEmailPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('Account Email')).toHaveProperty('value', 'mika@example.com')
    })
  })

  test('does not render username form before auth gate resolves', () => {
    mockPendingAuthState()

    render(<UsernamePage />)

    expect(screen.getByRole('heading', { name: 'Choose Username' })).toBeTruthy()
    expect(screen.queryByLabelText('Username')).toBeNull()
  })

  test('renders username completion form for profile-pending users', async () => {
    mockNeedsProfileState()

    render(<UsernamePage />)

    await waitFor(() => {
      expect(screen.getByText('Signed in with user@example.com')).toBeTruthy()
    })
    expect(screen.getByLabelText('Username').closest('.auth-input-shell')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy()
  })

  test('maps OAuth callback state to the correct destination', () => {
    expect(getOAuthRedirectPath({
      status: 'complete',
      email: 'user@example.com',
      emailVerified: true,
      profile: {},
    })).toBe('/home')
    expect(getOAuthRedirectPath({
      status: 'needsProfile',
      email: 'user@example.com',
      emailVerified: true,
      profile: null,
    })).toBe('/auth/username')
    expect(getOAuthRedirectPath({
      status: 'emailUnverified',
      email: 'Mika@example.com',
      emailVerified: false,
      profile: null,
    })).toBe('/auth/verify-email?email=Mika%40example.com')
    expect(getOAuthRedirectPath({
      status: 'signedOut',
      email: null,
      emailVerified: false,
      profile: null,
    })).toBe('/auth/sign-in')
  })
})
