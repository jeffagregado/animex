import { describe, expect, test, vi } from 'vitest'

import {
  orchestratePasswordReset,
  orchestrateOtpSend,
  scheduleNonBlocking,
} from './authOrchestration'

describe('password reset orchestration', () => {
  test('deletes ineligible verification and never marks or schedules', async () => {
    const deleteVerification = vi.fn().mockResolvedValue(undefined)
    const markShadow = vi.fn().mockResolvedValue(undefined)
    const schedule = vi.fn().mockResolvedValue(undefined)

    await orchestratePasswordReset({
      authId: 'oauth-user',
      checkEligible: vi.fn().mockResolvedValue(false),
      clearShadow: vi.fn().mockResolvedValue(undefined),
      deleteVerification,
      logError: vi.fn(),
      markShadow,
      schedule,
      token: 'token-1',
      tokenKey: 'token-key-1',
    })

    expect(deleteVerification).toHaveBeenCalledWith('token-1')
    expect(markShadow).not.toHaveBeenCalled()
    expect(schedule).not.toHaveBeenCalled()
  })

  test('schedules eligible delivery and does not await later provider failure', async () => {
    const laterDelivery = Promise.reject(new Error('Resend down'))
    laterDelivery.catch(() => undefined)
    const schedule = vi.fn().mockImplementation(async () => {
      void laterDelivery
    })

    await expect(orchestratePasswordReset({
      authId: 'password-user',
      checkEligible: vi.fn().mockResolvedValue(true),
      clearShadow: vi.fn().mockResolvedValue(undefined),
      deleteVerification: vi.fn().mockResolvedValue(undefined),
      logError: vi.fn(),
      markShadow: vi.fn().mockResolvedValue(undefined),
      schedule,
      token: 'token-1',
      tokenKey: 'token-key-1',
    })).resolves.toBeUndefined()
    expect(schedule).toHaveBeenCalledOnce()
  })

  test('cleans verification and shadow when scheduling fails', async () => {
    const clearShadow = vi.fn().mockResolvedValue(undefined)
    const deleteVerification = vi.fn().mockResolvedValue(undefined)
    const logError = vi.fn()

    await expect(orchestratePasswordReset({
      authId: 'password-user',
      checkEligible: vi.fn().mockResolvedValue(true),
      clearShadow,
      deleteVerification,
      logError,
      markShadow: vi.fn().mockResolvedValue(undefined),
      schedule: vi.fn().mockRejectedValue(new Error('scheduler down')),
      token: 'token-1',
      tokenKey: 'token-key-1',
    })).resolves.toBeUndefined()

    expect(deleteVerification).toHaveBeenCalledWith('token-1')
    expect(clearShadow).toHaveBeenCalledWith('token-key-1')
    expect(logError).toHaveBeenCalledOnce()
  })
})

describe('OTP delivery orchestration', () => {
  test('finalizes matching claim only after successful send', async () => {
    const finalize = vi.fn().mockResolvedValue(true)
    const release = vi.fn().mockResolvedValue(undefined)

    await orchestrateOtpSend({
      claim: vi.fn().mockResolvedValue('claim-1'),
      finalize,
      release,
      send: vi.fn().mockResolvedValue(undefined),
    })

    expect(finalize).toHaveBeenCalledWith('claim-1')
    expect(release).not.toHaveBeenCalled()
  })

  test('releases matching claim after final send failure', async () => {
    const release = vi.fn().mockResolvedValue(undefined)

    await expect(orchestrateOtpSend({
      claim: vi.fn().mockResolvedValue('claim-1'),
      finalize: vi.fn().mockResolvedValue(true),
      release,
      send: vi.fn().mockRejectedValue(new Error('send failed')),
    })).rejects.toThrow('send failed')
    expect(release).toHaveBeenCalledWith('claim-1')
  })
})

describe('notice scheduling', () => {
  test('logs scheduling failure without rejecting password-reset path', async () => {
    const logError = vi.fn()
    await expect(scheduleNonBlocking({
      logError,
      schedule: vi.fn().mockRejectedValue(new Error('scheduler down')),
    })).resolves.toBeUndefined()
    expect(logError).toHaveBeenCalledOnce()
  })
})
