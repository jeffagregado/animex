// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'

const authClientMock = vi.hoisted(() => ({
  $fetch: vi.fn(),
  signIn: {
    email: vi.fn(),
    social: vi.fn(),
  },
  signOut: vi.fn(),
  signUp: {
    email: vi.fn(),
  },
}))

const navigateToAuthPathMock = vi.hoisted(() => vi.fn())

vi.mock('../../lib/auth-client', () => ({
  authClient: authClientMock,
}))

vi.mock('./auth-navigation', () => ({
  navigateToAuthPath: navigateToAuthPathMock,
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ activeOptions: _activeOptions, activeProps: _activeProps, children, hash, to, ...props }: { activeOptions?: unknown, activeProps?: unknown, children: ReactNode, hash?: string, to: string }) => (
    <a href={`${to}${hash === undefined ? '' : `#${hash}`}`} {...props}>{children}</a>
  ),
}))

import { ForgotPasswordPage } from './forgot-password-page'
import { getOAuthRedirectPath, OAuthCallbackPage } from './oauth-callback-page'
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
          signupMethod: 'password',
          suggestedUsername: null,
        }),
      } as Response
    }),
  )
}

const mockEmailUnverifiedState = (email: string): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: 'emailUnverified', email }),
    } as Response)),
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
  vi.clearAllMocks()
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

  test('uses native POST for every auth form with named user input', async () => {
    const expectNamedInputFormToPost = (label: string): void => {
      const input = screen.getByLabelText(label)
      const inputName = input.getAttribute('name')
      const form = input.closest('form')
      expect(inputName).not.toBeNull()
      expect(inputName?.trim().length).toBeGreaterThan(0)
      expect(form).not.toBeNull()
      expect(form?.getAttribute('method')).toBe('post')
    }

    mockSignedOutState()
    render(<SignInPage />)
    expectNamedInputFormToPost('Password')

    cleanup()
    mockSignedOutState()
    render(<SignUpPage />)
    expectNamedInputFormToPost('Password')

    cleanup()
    mockSignedOutState()
    render(<ForgotPasswordPage />)
    expectNamedInputFormToPost('Account Email')

    cleanup()
    render(<ResetPasswordPage token="reset-token" />)
    expectNamedInputFormToPost('Password')
    expectNamedInputFormToPost('Confirm Password')

    cleanup()
    mockEmailUnverifiedState('owner@example.com')
    render(<VerifyEmailPage />)
    expectNamedInputFormToPost('Verification Code')
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
    expectNamedInputFormToPost('New Account Email')
    expectNamedInputFormToPost('New Email Code')

    cleanup()
    mockNeedsProfileState()
    render(<UsernamePage />)
    await waitFor(() => expectNamedInputFormToPost('Username'))
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

  test('shows loading state while sign-in submit is pending', async () => {
    mockSignedOutState()
    authClientMock.signIn.email.mockReturnValue(new Promise(() => {}))

    render(<SignInPage />)

    fireEvent.change(screen.getByLabelText('Account Email'), { target: { value: 'mika@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      const button = screen.getByRole('button', { name: 'Sign in' })
      expect(button).toHaveProperty('disabled', true)
      expect(button.getAttribute('aria-busy')).toBe('true')
    })
  })

  test('shows loading state while Google sign-in is pending', async () => {
    mockSignedOutState()
    authClientMock.signIn.social.mockReturnValue(new Promise(() => {}))

    render(<SignInPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))

    await waitFor(() => {
      const button = screen.getByRole('button', { name: 'Continue with Google' })
      expect(button).toHaveProperty('disabled', true)
      expect(button.getAttribute('aria-busy')).toBe('true')
    })
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

  test('uses authoritative verification email and ignores malformed query override', async () => {
    mockEmailUnverifiedState('owner@example.com')
    window.history.replaceState(null, '', '/auth/verify-email?email=%E0%A4%A')

    render(<VerifyEmailPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('Account Email')).toHaveProperty('value', 'owner@example.com')
    })
    expect(screen.getByLabelText('Account Email')).toHaveProperty('readOnly', true)
  })

  test('keeps password reset request generic when provider returns a rate-limit detail', async () => {
    mockSignedOutState()
    authClientMock.$fetch.mockResolvedValue({
      data: null,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'resend provider quota for customer-4821',
        status: 429,
      },
    })

    render(<ForgotPasswordPage />)
    fireEvent.change(screen.getByLabelText('Account Email'), { target: { value: 'mika@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }))

    await waitFor(() => {
      expect(screen.getByText('If an account exists, reset instructions were sent.')).toBeTruthy()
    })
    expect(screen.queryByText('Too many attempts. Try again later.')).toBeNull()
    expect(screen.queryByText('resend provider quota for customer-4821')).toBeNull()
  })

  test('Google sign-in sends success and error callbacks with return target', async () => {
    mockSignedOutState()
    authClientMock.signIn.social.mockResolvedValue({ data: { redirect: true }, error: null })
    window.history.replaceState(null, '', '/auth/sign-in?returnTo=%2Fanime%2F86%3Ftab%3Dreviews%23latest')

    render(<SignInPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))

    await waitFor(() => expect(authClientMock.signIn.social).toHaveBeenCalledOnce())
    expect(authClientMock.signIn.social).toHaveBeenCalledWith(expect.objectContaining({
      callbackURL: expect.stringContaining('returnTo=%2Fanime%2F86%3Ftab%3Dreviews%23latest'),
      errorCallbackURL: expect.stringContaining('returnTo=%2Fanime%2F86%3Ftab%3Dreviews%23latest'),
      provider: 'google',
    }))
  })

  test('email correction sends one OTP and no second verification request', async () => {
    mockEmailUnverifiedState('owner@example.com')
    authClientMock.$fetch.mockResolvedValue({ data: { success: true }, error: null })
    render(<VerifyEmailPage />)

    await waitFor(() => expect(screen.getByLabelText('Account Email')).toHaveProperty('value', 'owner@example.com'))
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
    fireEvent.change(screen.getByLabelText('New Account Email'), { target: { value: 'new@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }))
    await waitFor(() => expect(authClientMock.$fetch).toHaveBeenCalledTimes(1))
    expect(authClientMock.$fetch.mock.calls[0]?.[0]).toBe('/email-otp/request-email-change')

    fireEvent.change(screen.getByLabelText('New Email Code'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm email' }))
    await waitFor(() => expect(authClientMock.$fetch).toHaveBeenCalledTimes(2))
    expect(authClientMock.$fetch.mock.calls[1]?.[0]).toBe('/email-otp/change-email')
    expect(authClientMock.$fetch.mock.calls.filter(([path]) => path === '/email-otp/send-verification-otp')).toHaveLength(0)
    expect(navigateToAuthPathMock).toHaveBeenCalledWith('/auth/username')
  })

  test('maps verification send failure to settled copy', async () => {
    mockEmailUnverifiedState('owner@example.com')
    authClientMock.$fetch.mockResolvedValue({
      data: null,
      error: { code: 'DELIVERY_PROVIDER_DETAIL', message: 'sensitive provider failure' },
    })
    render(<VerifyEmailPage />)
    await waitFor(() => expect(screen.getByLabelText('Account Email')).toHaveProperty('value', 'owner@example.com'))

    fireEvent.click(screen.getByRole('button', { name: 'Resend code' }))

    await waitFor(() => {
      expect(screen.getByText('Verification email couldn’t be sent. Try again.')).toBeTruthy()
    })
    expect(screen.queryByText('sensitive provider failure')).toBeNull()
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
      profile: {
        id: 'profile-1',
        username: 'mika',
        name: 'Mika',
        avatarUrl: null,
        visibility: 'private',
      },
    })).toBe('/home')
    expect(getOAuthRedirectPath({
      status: 'needsProfile',
      email: 'user@example.com',
      signupMethod: 'password',
      suggestedUsername: null,
    })).toBe('/auth/username')
    expect(getOAuthRedirectPath({
      status: 'emailUnverified',
      email: 'Mika@example.com',
    })).toBeNull()
    expect(getOAuthRedirectPath({
      status: 'signedOut',
    })).toBe('/auth/sign-in')
  })

  test('renders settled OAuth copy for unknown provider error without fetching state or leaking description', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState(
      null,
      '',
      '/auth/oauth-callback?error=provider_secret_detail&error_description=tenant%20secret%20abc123',
    )

    render(<OAuthCallbackPage />)

    await waitFor(() => {
      expect(screen.getByText('Google sign-in couldn’t continue. Try another sign-in method.')).toBeTruthy()
    })
    expect(screen.queryByText('tenant secret abc123')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(navigateToAuthPathMock).not.toHaveBeenCalled()
  })
})
