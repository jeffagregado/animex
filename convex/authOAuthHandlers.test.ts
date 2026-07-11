import { describe, expect, it, vi } from 'vitest'

import {
  authAccountCreateTrigger,
  authSessionWriteTrigger,
  authUserCreateBeforeHook,
  authUserCreateTrigger,
} from './authOAuthHandlers'

type Pending = {
  _id: string
  authId: string
  cleanupAfter: number
  cleanupLeaseUntil?: number
  cleanupPhase?: 'deleting'
  createdAt: number
  email: string
  state: 'oauth' | 'provisional'
  updatedAt: number
}

const fakeContext = (pending: Pending | null, authUser?: { email: string; emailVerified: boolean; name: string }) => {
  const insert = vi.fn(async () => 'pending-1')
  const patch = vi.fn(async () => undefined)
  const remove = vi.fn(async () => undefined)
  const ctx = {
    db: {
      delete: remove,
      insert,
      patch,
      query: () => ({
        withIndex: (name: string) => ({
          unique: async () => name === 'by_auth_id' ? pending : null,
        }),
      }),
    },
    runQuery: vi.fn(async () => authUser ?? null),
  }
  return { ctx, insert, patch, remove }
}

describe('production OAuth handlers', () => {
  it('rejects callback and direct ID-token Google users before persistence continues', async () => {
    let persisted = false
    await expect((async () => {
      await authUserCreateBeforeHook(
        { email: 'fan@example.com', emailVerified: false },
        { path: '/callback/:id', params: { id: 'google' } },
      )
      persisted = true
    })()).rejects.toThrow("Google sign-in couldn’t continue")
    expect(persisted).toBe(false)
    await expect(authUserCreateBeforeHook(
      { email: 'fan@example.com', emailVerified: false },
      { path: '/sign-in/social', body: { provider: 'google', idToken: { token: 'structured' } } },
    )).rejects.toThrow("Google sign-in couldn’t continue")
  })

  it('creates provisional row through actual user trigger', async () => {
    const { ctx, insert } = fakeContext(null)
    await authUserCreateTrigger(ctx as unknown as Parameters<typeof authUserCreateTrigger>[0], {
      _id: 'auth-1', email: 'fan@example.com', name: 'Fan',
    })
    expect(insert).toHaveBeenCalledWith('pendingOauthSignups', expect.objectContaining({
      authId: 'auth-1', state: 'provisional',
    }))
  })

  it('converts Google provisional and removes non-Google provisional through account trigger', async () => {
    const pending: Pending = {
      _id: 'pending-1', authId: 'auth-1', cleanupAfter: 100,
      createdAt: 50, email: 'fan@example.com', state: 'provisional', updatedAt: 50,
    }
    const google = fakeContext(pending, { email: 'fan@example.com', emailVerified: true, name: 'Fan' })
    await authAccountCreateTrigger(google.ctx as unknown as Parameters<typeof authAccountCreateTrigger>[0], {
      accountId: 'google-1', providerId: 'google', userId: 'auth-1',
    })
    expect(google.patch).toHaveBeenCalledWith('pending-1', expect.objectContaining({ state: 'oauth' }))

    const password = fakeContext(pending)
    await authAccountCreateTrigger(password.ctx as unknown as Parameters<typeof authAccountCreateTrigger>[0], {
      accountId: 'credential', providerId: 'credential', userId: 'auth-1',
    })
    expect(password.remove).toHaveBeenCalledWith('pending-1')
  })

  it('rejects actual session trigger while lease or deleting phase fences cleanup', async () => {
    const pending: Pending = {
      _id: 'pending-1', authId: 'auth-1', cleanupAfter: 100,
      cleanupLeaseUntil: Date.now() + 60_000,
      createdAt: 50, email: 'fan@example.com', state: 'oauth', updatedAt: 50,
    }
    const leased = fakeContext(pending)
    await expect(authSessionWriteTrigger(
      leased.ctx as unknown as Parameters<typeof authSessionWriteTrigger>[0], {
      expiresAt: Date.now() + 120_000, userId: 'auth-1',
    })).rejects.toThrow('cleanup')
    const deleting = fakeContext({ ...pending, cleanupLeaseUntil: undefined, cleanupPhase: 'deleting' })
    await expect(authSessionWriteTrigger(
      deleting.ctx as unknown as Parameters<typeof authSessionWriteTrigger>[0], {
      expiresAt: Date.now() + 120_000, userId: 'auth-1',
    })).rejects.toThrow('cleanup')
  })
})
