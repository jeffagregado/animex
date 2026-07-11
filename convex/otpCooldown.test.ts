import { describe, expect, test } from 'vitest'

import {
  claimOtpCooldown,
  finalizeOtpCooldown,
  releaseOtpCooldown,
} from './otpCooldown'

describe('owned OTP cooldown claims', () => {
  test('reserves longer than maximum delivery retry duration', () => {
    expect(claimOtpCooldown(null, 'claim-1', 1_000)).toEqual({
      claimId: 'claim-1',
      nextAllowedAt: 301_000,
      updatedAt: 1_000,
    })
  })

  test('stale release cannot delete newer claim', () => {
    const current = {
      claimId: 'claim-2',
      nextAllowedAt: 301_000,
      updatedAt: 1_000,
    }
    expect(releaseOtpCooldown(current, 'claim-1')).toBe(false)
    expect(releaseOtpCooldown(current, 'claim-2')).toBe(true)
  })

  test('stale finalize cannot change newer claim', () => {
    const current = {
      claimId: 'claim-2',
      nextAllowedAt: 301_000,
      updatedAt: 1_000,
    }
    expect(finalizeOtpCooldown(current, 'claim-1', 5_000)).toBeNull()
    expect(finalizeOtpCooldown(current, 'claim-2', 5_000)).toEqual({
      claimId: 'claim-2',
      nextAllowedAt: 65_000,
      updatedAt: 5_000,
    })
  })
})
