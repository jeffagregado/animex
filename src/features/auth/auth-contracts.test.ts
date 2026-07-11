import { afterEach, describe, expect, test, vi } from 'vitest'

import { assertAuthResponse, getAuthErrorMessage, postAuthEndpoint } from './auth-actions'
import { checkUsername, readAuthState } from './profile-actions'

const authClientMock = vi.hoisted(() => ({
  $fetch: vi.fn(),
}))

vi.mock('../../lib/auth-client', () => ({
  authClient: authClientMock,
}))

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('auth response contracts', () => {
  test('returns data only when response has data and no error', async () => {
    await expect(assertAuthResponse({ data: { id: 'user-1' }, error: null }, 'Unknown failure.'))
      .resolves.toEqual({ id: 'user-1' })
  })

  test('rejects an error response even when data is present', async () => {
    await expect(assertAuthResponse({
      data: { id: 'user-1' },
      error: { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'provider detail' },
    }, 'Unknown failure.')).rejects.toThrow('Invalid email or password.')
  })

  test('rejects a response with absent data', async () => {
    await expect(assertAuthResponse({ data: null, error: null }, 'Request failed.'))
      .rejects.toThrow('Request failed.')
  })

  test.each([
    ['USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', 'Email already in use. Sign in instead.'],
    ['account_not_linked', 'Email already in use. Sign in instead.'],
    ['PROVIDER_NOT_FOUND', 'Google sign-in couldn\u2019t continue. Try another sign-in method.'],
    ['TOO_MANY_REQUESTS', 'Too many attempts. Try again later.'],
    ['INVALID_OTP', 'Verification code is invalid.'],
    ['OTP_EXPIRED', 'Verification code expired. Request a new code.'],
    ['TOO_MANY_ATTEMPTS', 'Too many incorrect codes. Request a new code.'],
  ])('maps %s to settled copy', async (code, copy) => {
    try {
      await assertAuthResponse({ data: null, error: { code, message: 'sensitive detail' } }, 'Fallback.')
      throw new Error('Expected auth response rejection.')
    } catch (error) {
      expect(getAuthErrorMessage(error, 'Fallback.')).toBe(copy)
    }
  })

  test('uses caller fallback for unknown codes without exposing provider detail', async () => {
    try {
      await assertAuthResponse({
        data: null,
        error: { code: 'UNKNOWN_PROVIDER_FAILURE', message: 'sensitive detail' },
      }, 'Safe fallback.')
      throw new Error('Expected auth response rejection.')
    } catch (error) {
      expect(getAuthErrorMessage(error, 'Safe fallback.')).toBe('Safe fallback.')
    }
  })

  test('postAuthEndpoint inspects the Better Fetch result', async () => {
    authClientMock.$fetch.mockResolvedValue({
      data: null,
      error: { code: 'TOO_MANY_REQUESTS', message: 'provider detail' },
    })

    await expect(postAuthEndpoint('/reset-password', { token: 'token' }))
      .rejects.toThrow('Too many attempts. Try again later.')
  })
})

describe('auth state contract', () => {
  test('does not expose a non-OK response body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      text: async () => 'database connection includes secret-token',
    } as Response)))

    await expect(readAuthState()).rejects.toThrow('Auth state check failed.')
  })

  test.each([
    { status: 'signedOut' },
    { status: 'emailUnverified', email: 'user@example.com' },
    {
      status: 'needsProfile',
      email: 'user@example.com',
      signupMethod: 'oauth',
      suggestedUsername: 'mika',
    },
    {
      status: 'complete',
      email: 'user@example.com',
      profile: {
        id: 'profile-1',
        username: 'mika',
        name: 'Mika',
        avatarUrl: null,
        visibility: 'private',
      },
    },
  ])('accepts $status', async (state) => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => state,
    } as Response)))

    await expect(readAuthState()).resolves.toEqual(state)
  })

  test('accepts followers visibility from existing profiles', async () => {
    const state = {
      status: 'complete',
      email: 'user@example.com',
      profile: {
        id: 'profile-1',
        username: 'mika',
        name: 'Mika',
        avatarUrl: null,
        visibility: 'followers',
      },
    }
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => state,
    } as Response)))

    await expect(readAuthState()).resolves.toEqual(state)
  })

  test('rejects malformed runtime JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: 'complete',
        email: 'user@example.com',
        profile: { id: 'profile-1' },
      }),
    } as Response)))

    await expect(readAuthState()).rejects.toThrow('Invalid auth state response.')
  })
})

describe('username availability contract', () => {
  test('accepts the exact username response shape', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ available: true, message: null }),
    } as Response)))

    await expect(checkUsername('mika')).resolves.toEqual({ available: true, message: null })
  })

  test('rejects malformed or extended runtime JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ available: 'yes', message: null, providerDetail: 'secret' }),
    } as Response)))

    await expect(checkUsername('mika')).rejects.toThrow('Invalid username check response.')
  })

  test('does not expose a non-OK response body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      text: async () => 'database detail token=secret',
    } as Response)))

    await expect(checkUsername('mika')).rejects.toThrow('Username check failed.')
  })
})
