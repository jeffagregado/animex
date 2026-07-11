import { describe, expect, test } from 'vitest'

import { resolveOAuthCallback, resolvePasswordSignIn } from './auth-flow'
import { type AuthState } from './auth-contracts'

const completeState: AuthState = {
  status: 'complete',
  email: 'fan@example.com',
  profile: {
    id: 'profile-1', username: 'fan', name: 'Fan', avatarUrl: null, visibility: 'private',
  },
}

describe('password sign-in routing', () => {
  test.each([
    [{ status: 'emailUnverified', email: 'fan@example.com' }, '/auth/verify-email'],
    [{ status: 'needsProfile', email: 'fan@example.com', signupMethod: 'password', suggestedUsername: null }, '/auth/username'],
    [completeState, '/anime/86?tab=reviews#latest'],
  ] satisfies Array<[AuthState, string]>)('routes $status authoritatively', (state, path) => {
    expect(resolvePasswordSignIn(state, '/anime/86?tab=reviews#latest')).toEqual({ kind: 'redirect', path })
  })

  test('uses home without return target and reports invalid requested target', () => {
    expect(resolvePasswordSignIn(completeState, null)).toEqual({ kind: 'redirect', path: '/home' })
    expect(resolvePasswordSignIn(completeState, '/auth/sign-in')).toEqual({
      kind: 'message', message: 'This content is unavailable.',
    })
  })

  test('does not claim success when authoritative state remains signed out', () => {
    expect(resolvePasswordSignIn({ status: 'signedOut' }, null)).toEqual({
      kind: 'message', message: 'Sign-in couldn’t be completed. Try again.',
    })
  })
})

describe('OAuth callback routing', () => {
  test.each(['account_not_linked', 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'])('maps conflict %s', (error) => {
    expect(resolveOAuthCallback({ status: 'signedOut' }, error, null)).toEqual({
      kind: 'message', message: 'Email already in use. Sign in instead.',
    })
  })

  test.each(['email_not_found', 'GOOGLE_EMAIL_NOT_VERIFIED', 'oauth_provider_not_found', 'invalid_code'])('maps Google failure %s', (error) => {
    expect(resolveOAuthCallback({ status: 'signedOut' }, error, null)).toEqual({
      kind: 'message', message: 'Google sign-in couldn’t continue. Try another sign-in method.',
    })
  })

  test('maps unknown callback error to safe generic without raw description', () => {
    expect(resolveOAuthCallback({ status: 'signedOut' }, 'provider_secret_detail', null)).toEqual({
      kind: 'message', message: 'Google sign-in couldn’t continue. Try another sign-in method.',
    })
  })

  test('preserves valid return target and rejects unavailable target', () => {
    expect(resolveOAuthCallback(completeState, null, '/anime/86?tab=reviews#latest')).toEqual({
      kind: 'redirect', path: '/anime/86?tab=reviews#latest',
    })
    expect(resolveOAuthCallback(completeState, null, '//evil.example')).toEqual({
      kind: 'message', message: 'This content is unavailable.',
    })
  })

  test('routes pending and signed-out states without loops and rejects unexpected unverified Google state', () => {
    expect(resolveOAuthCallback({
      status: 'needsProfile', email: 'fan@example.com', signupMethod: 'oauth', suggestedUsername: null,
    }, null, null)).toEqual({ kind: 'redirect', path: '/auth/username' })
    expect(resolveOAuthCallback({ status: 'signedOut' }, null, null)).toEqual({ kind: 'redirect', path: '/auth/sign-in' })
    expect(resolveOAuthCallback({ status: 'emailUnverified', email: 'fan@example.com' }, null, null)).toEqual({
      kind: 'message', message: 'Google sign-in couldn’t continue. Try another sign-in method.',
    })
  })
})
