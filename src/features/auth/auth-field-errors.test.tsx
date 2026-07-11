// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

const authClientMock = vi.hoisted(() => ({
  $fetch: vi.fn(),
  signIn: {
    email: vi.fn(),
    social: vi.fn(),
  },
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

import { SignInPage } from './sign-in-page'
import { SignUpPage } from './sign-up-page'
import { ForgotPasswordPage } from './forgot-password-page'
import { VerifyEmailPage } from './verify-email-page'

const mockSignedOutState = (): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: 'signedOut' }),
    } as Response)),
  )
}

const mockEmailUnverifiedState = (): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: 'emailUnverified', email: 'owner@example.com' }),
    } as Response)),
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

describe('auth field errors', () => {
  test('validates on blur, then revalidates on change without moving focus', async () => {
    mockSignedOutState()
    render(<SignInPage />)

    const email = screen.getByLabelText('Account Email')
    const password = screen.getByLabelText('Password')
    email.focus()
    fireEvent.change(email, { target: { value: 'invalid' } })

    expect(screen.queryByText('Enter a valid email address.')).toBeNull()

    fireEvent.blur(email)
    await screen.findByText('Enter a valid email address.')
    expect(email.getAttribute('aria-invalid')).toBe('true')
    expect(email.getAttribute('aria-describedby')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    password.focus()
    fireEvent.change(email, { target: { value: 'mika@example.com' } })
    await waitFor(() => expect(screen.queryByText('Enter a valid email address.')).toBeNull())
    expect(document.activeElement).toBe(password)
  })

  test('invalid submit shows all field errors and focuses first editable invalid field', async () => {
    mockSignedOutState()
    render(<SignUpPage />)

    fireEvent.change(screen.getByLabelText('Account Email'), { target: { value: 'invalid' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } })
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'different' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy()
    expect(screen.getByText('Password must be 8-24 characters.')).toBeTruthy()
    expect(screen.getByText('Passwords must match.')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByLabelText('Account Email'))
    expect(authClientMock.signUp.email).not.toHaveBeenCalled()
  })

  test('submits transformed email after field validation succeeds', async () => {
    mockSignedOutState()
    authClientMock.signIn.email.mockResolvedValue({ data: {}, error: null })
    render(<SignInPage />)

    fireEvent.change(screen.getByLabelText('Account Email'), {
      target: { value: '  Mika@Example.COM  ' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(authClientMock.signIn.email).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'mika@example.com' }),
      )
    })
  })

  test('maps email conflict to email, focuses it, and clears error on edit', async () => {
    mockSignedOutState()
    authClientMock.signUp.email.mockResolvedValue({
      data: null,
      error: { code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', status: 422 },
    })
    render(<SignUpPage />)

    fireEvent.change(screen.getByLabelText('Account Email'), { target: { value: 'mika@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    const email = screen.getByLabelText('Account Email')
    expect(await screen.findByText('Email already in use. Sign in instead.')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(email))
    expect(email.getAttribute('aria-invalid')).toBe('true')

    fireEvent.change(email, { target: { value: 'other@example.com' } })
    await waitFor(() => expect(screen.queryByText('Email already in use. Sign in instead.')).toBeNull())
  })

  test('keeps unknown auth failures as alerts and success instructions as status', async () => {
    mockSignedOutState()
    authClientMock.signIn.email.mockResolvedValue({ data: null, error: { code: 'UNKNOWN_AUTH_FAILURE' } })
    render(<SignInPage />)
    fireEvent.change(screen.getByLabelText('Account Email'), { target: { value: 'mika@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Invalid email or password.')

    cleanup()
    mockSignedOutState()
    authClientMock.$fetch.mockResolvedValue({ data: {}, error: null })
    render(<ForgotPasswordPage />)
    fireEvent.change(screen.getByLabelText('Account Email'), { target: { value: 'mika@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }))
    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      'If an account exists, reset instructions were sent.',
    )
  })

  test('skips read-only email focus and keeps email-change intents separate', async () => {
    mockEmailUnverifiedState()
    render(<VerifyEmailPage />)
    const otp = screen.getByLabelText('Verification Code')
    await waitFor(() => expect(screen.getByLabelText('Account Email')).toHaveProperty('value', 'owner@example.com'))

    fireEvent.click(screen.getByRole('button', { name: 'Verify Email' }))
    expect(await screen.findByText('Verification code is required.')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(otp))

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
    fireEvent.blur(screen.getByLabelText('New Email Code'))
    expect(await screen.findByText('Verification code is required.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }))
    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy()
    await waitFor(() => expect(screen.queryByText('Verification code is required.')).toBeNull())

    fireEvent.change(screen.getByLabelText('New Account Email'), {
      target: { value: 'new@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm email' }))
    expect(await screen.findByText('Verification code is required.')).toBeTruthy()
  })
})
