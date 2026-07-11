import { describe, expect, it } from 'vitest'

import {
  advancePendingSession,
  assertAuthUserCreationAllowed,
  applyAccountToProvisional,
  buildProvisionalIdentity,
  buildPendingOauthSignup,
  completePendingProfile,
} from './oauthLifecycle'

const GOOGLE_ERROR = "Google sign-in couldn’t continue. Try another sign-in method."

describe('OAuth lifecycle', () => {
  it('requires verified Google email but allows unverified password signup', () => {
    expect(() => assertAuthUserCreationAllowed({ path: '/callback/:id', params: { id: 'google' } }, {
      email: 'fan@example.com', emailVerified: false,
    })).toThrow("Google sign-in couldn’t continue. Try another sign-in method.")
    expect(() => assertAuthUserCreationAllowed({ path: '/sign-up/email' }, {
      email: 'fan@example.com', emailVerified: false,
    })).not.toThrow()
  })

  it('rejects missing Google email', () => {
    expect(() => assertAuthUserCreationAllowed({ path: '/callback/:id', params: { id: 'google' } }, {
      email: '', emailVerified: true,
    })).toThrow("Google sign-in couldn’t continue. Try another sign-in method.")
  })

  it('gates direct Google ID-token sign-in', () => {
    expect(() => assertAuthUserCreationAllowed({
      path: '/sign-in/social', body: { provider: 'google', idToken: 'token' },
    }, { email: 'fan@example.com', emailVerified: false })).toThrow(GOOGLE_ERROR)
  })

  it('creates provisional lifecycle row then converts Google or removes non-Google', () => {
    const provisional = buildProvisionalIdentity({ id: 'auth-1', email: 'fan@example.com', name: 'Fan' }, 100)
    expect(provisional.state).toBe('provisional')
    expect(provisional.cleanupAfter).toBe(86_400_100)
    expect(applyAccountToProvisional(provisional, { accountId: 'google-1', providerId: 'google', userId: 'auth-1' }, 200)?.state).toBe('oauth')
    expect(applyAccountToProvisional(provisional, { accountId: 'password', providerId: 'credential', userId: 'auth-1' }, 200)).toBe(null)
  })

  it('creates pending state keyed by Google provider account', () => {
    expect(buildPendingOauthSignup({
      accountId: 'google-1', providerId: 'google', userId: 'auth-1',
    }, { email: 'Fan@Example.com', name: 'Anime Fan' }, 100)).toEqual({
      authId: 'auth-1', providerAccountId: 'google-1', providerId: 'google',
      email: 'fan@example.com', suggestedUsername: 'Anime_Fan',
      cleanupAfter: 86_400_100, createdAt: 100, updatedAt: 100,
    })
  })

  it('advances pending expiry and rejects session during cleanup lease', () => {
    expect(advancePendingSession({ cleanupLeaseUntil: 200 }, 150, 300)).toEqual({
      allowed: false,
      cleanupAfter: 86_400_300,
      lastSessionExpiresAt: 300,
      updatedAt: 150,
    })
    expect(advancePendingSession({}, 250, 300).allowed).toBe(true)
  })

  it('inserts profile then removes pending in one transaction helper', async () => {
    const calls: string[] = []
    const id = await completePendingProfile({
      insert: async () => { calls.push('insert'); return 'profile-1' },
      removePending: async () => { calls.push('remove'); },
    })
    expect(id).toBe('profile-1')
    expect(calls).toEqual(['insert', 'remove'])
  })
})
