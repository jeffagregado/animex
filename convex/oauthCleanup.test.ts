import { describe, expect, it } from 'vitest'

import {
  acquireCleanupLease,
  canCleanupProvisional,
  canCleanupPending,
  cleanupPendingIdentity,
  releaseCleanupLease,
  selectCleanupBatch,
} from './oauthCleanup'

describe('OAuth cleanup', () => {
  it('requires due no-profile Google identity with no active session', () => {
    const base = { accountExists: true, cleanupAfter: 100, hasActiveSession: false, hasProfile: false, providerId: 'google' }
    expect(canCleanupPending(base, 100)).toBe(true)
    expect(canCleanupPending({ ...base, hasProfile: true }, 100)).toBe(false)
    expect(canCleanupPending({ ...base, hasActiveSession: true }, 100)).toBe(false)
    expect(canCleanupPending({ ...base, accountExists: false }, 100)).toBe(false)
  })

  it('cleans provisional orphan only when no account exists', () => {
    expect(canCleanupProvisional({ cleanupAfter: 100, hasAccount: false, hasActiveSession: false, hasProfile: false }, 100)).toBe(true)
    expect(canCleanupProvisional({ cleanupAfter: 100, hasAccount: true, hasActiveSession: false, hasProfile: false }, 100)).toBe(false)
  })

  it('leases only eligible rows and blocks a second owner', () => {
    expect(acquireCleanupLease({}, 100, 200)).toEqual({ acquired: true, cleanupLeaseUntil: 200 })
    expect(acquireCleanupLease({ cleanupLeaseUntil: 150 }, 100, 200).acquired).toBe(false)
    expect(acquireCleanupLease({ cleanupLeaseUntil: 99 }, 100, 200).acquired).toBe(true)
  })

  it('does not let a stale worker release a newer lease', () => {
    expect(releaseCleanupLease({ cleanupLeaseUntil: 300 }, 200)).toBe(false)
    expect(releaseCleanupLease({ cleanupLeaseUntil: 300 }, 300)).toBe(true)
  })

  it('retries local finalization after auth deletion without requiring missing account', async () => {
    let phase: 'deleting' | undefined
    let authExists = true
    let finishAttempts = 0
    const deleteAuth = async () => { authExists = false }
    const finish = async () => {
      finishAttempts += 1
      if (finishAttempts === 1) throw new Error('injected finalization failure')
    }
    const dependencies = {
      deleteAuth,
      deleteVerifications: async () => undefined,
      finish,
      inspect: async () => ({
        accountExists: authExists,
        hasAccount: authExists,
        hasActiveSession: false,
        hasProfile: false,
      }),
      markDeleting: async () => { phase = 'deleting' },
      releaseLease: async () => undefined,
    }
    const pending = {
      cleanupAfter: 100,
      providerId: 'google',
      state: 'oauth' as const,
    }

    await expect(cleanupPendingIdentity({ ...pending, cleanupPhase: phase }, 200, dependencies))
      .rejects.toThrow('injected')
    expect(phase).toBe('deleting')
    await expect(cleanupPendingIdentity({ ...pending, cleanupPhase: phase }, 200, dependencies))
      .resolves.toBe('deleted')
    expect(finishAttempts).toBe(2)
  })

  it('does not clean arbitrary missing-account OAuth row before deleting phase', async () => {
    let marked = false
    let released = false
    const result = await cleanupPendingIdentity({
      cleanupAfter: 100,
      providerId: 'google',
      state: 'oauth',
    }, 200, {
      deleteAuth: async () => undefined,
      deleteVerifications: async () => undefined,
      finish: async () => undefined,
      inspect: async () => ({ accountExists: false, hasAccount: false, hasActiveSession: false, hasProfile: false }),
      markDeleting: async () => { marked = true },
      releaseLease: async () => { released = true },
    })
    expect(result).toBe('skipped')
    expect(marked).toBe(false)
    expect(released).toBe(true)
  })

  it('limits and deterministically orders cleanup batches to 20', () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({ id: `${index}`, cleanupAfter: 25 - index }))
    const selected = selectCleanupBatch(rows, 30, 20)
    expect(selected).toHaveLength(20)
    expect(selected[0]?.cleanupAfter).toBe(1)
  })
})
