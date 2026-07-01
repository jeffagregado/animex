// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'

import { ForgotPasswordPage } from './forgot-password-page'
import { ResetPasswordPage } from './reset-password-page'
import { SignInPage } from './sign-in-page'
import { SignUpPage } from './sign-up-page'
import { UsernamePage } from './username-page'
import { VerifyEmailPage } from './verify-email-page'

afterEach(() => {
  cleanup()
})

describe('auth pages', () => {
  test('renders sign-in form with Google entry and forgot-password link', () => {
    render(<SignInPage />)

    expect(screen.getAllByRole('link', { name: 'AnimeX home' }).length).toBeGreaterThan(1)
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Community' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Stats' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeTruthy()
    expect(screen.getByLabelText('Account Email')).toBeTruthy()
    expect(screen.getByLabelText('Password')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toBeTruthy()
  })

  test('renders create account form without username', () => {
    render(<SignUpPage />)

    expect(screen.getByRole('heading', { name: 'Create Account' })).toBeTruthy()
    expect(screen.queryByLabelText('Username')).toBeNull()
    expect(screen.getByLabelText('Account Email')).toBeTruthy()
    expect(screen.getByLabelText('Password')).toBeTruthy()
    expect(screen.getByLabelText('Confirm Password')).toBeTruthy()
  })

  test('renders verification and recovery forms', () => {
    render(<VerifyEmailPage />)
    expect(screen.getByRole('heading', { name: 'Verify Email' })).toBeTruthy()
    expect(screen.getByLabelText('Verification Code')).toBeTruthy()

    render(<ForgotPasswordPage />)
    expect(screen.getByRole('heading', { name: 'Reset Password' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Send Reset Link' })).toBeTruthy()

    render(<ResetPasswordPage />)
    expect(screen.getByRole('heading', { name: 'Set New Password' })).toBeTruthy()
    expect(screen.getByText('Reset link is invalid or expired.')).toBeTruthy()
  })

  test('renders username completion form', () => {
    render(<UsernamePage />)

    expect(screen.getByRole('heading', { name: 'Choose Username' })).toBeTruthy()
    expect(screen.getByLabelText('Username')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy()
  })
})
