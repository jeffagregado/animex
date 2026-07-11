import { describe, expect, it, vi } from 'vitest'

import { deleteAuthVerificationRows } from './authVerificationCleanup'

describe('auth verification cleanup', () => {
  it('deletes reset rows selected by auth ID and exact pending-email OTP identifiers', async () => {
    const remove = vi.fn(async (_identifier: string) => undefined)
    const listByAuthId = vi.fn(async () => ({
      hasMore: false,
      identifiers: ['reset-password:token-1', 'reset-password:token-2'],
    }))
    await deleteAuthVerificationRows({ listByAuthId, remove }, 'auth-1', 'fan@example.com')
    expect(listByAuthId).toHaveBeenCalledWith('auth-1', 20)
    expect(remove.mock.calls.map(([identifier]) => identifier)).toEqual([
      'reset-password:token-1',
      'reset-password:token-2',
      'email-verification-otp-fan@example.com',
      'sign-in-otp-fan@example.com',
      'forget-password-otp-fan@example.com',
    ])
  })

  it('fails for retry when more user-bound verification rows remain', async () => {
    await expect(deleteAuthVerificationRows({
      listByAuthId: async () => ({ hasMore: true, identifiers: ['reset-password:token'] }),
      remove: async () => undefined,
    }, 'auth-1', 'fan@example.com')).rejects.toThrow('bounded batch')
  })
})
