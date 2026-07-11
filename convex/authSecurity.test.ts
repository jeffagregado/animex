import { describe, expect, test, vi } from 'vitest'

import {
  consumeRateLimit,
  getAuthRateLimitRules,
  hashLimiterSubject,
  isPasswordResetEligible,
  sendWithRetry,
} from './authSecurity'

describe('auth rate-limit policy', () => {
  test('locks exact endpoint limits', () => {
    expect(getAuthRateLimitRules()).toEqual({
      '/email-otp/*': { max: 5, window: 60 },
      '/forget-password/email-otp': { max: 5, window: 60 },
      '/request-password-reset': { max: 3, window: 60 },
      '/sign-in/email': { max: 3, window: 10 },
      '/sign-in/social': { max: 3, window: 10 },
      '/sign-up/email': { max: 3, window: 10 },
    })
  })

  test('atomically denies requests after maximum in active window', () => {
    const now = 20_000
    const result = consumeRateLimit(
      { count: 3, lastRequest: 15_000 },
      { max: 3, window: 10 },
      now,
    )

    expect(result).toEqual({
      allowed: false,
      next: { count: 3, lastRequest: 15_000 },
      retryAfter: 5,
    })
  })

  test('resets expired window before counting request', () => {
    const result = consumeRateLimit(
      { count: 3, lastRequest: 5_000 },
      { max: 3, window: 10 },
      20_001,
    )

    expect(result).toEqual({
      allowed: true,
      next: { count: 1, lastRequest: 20_001 },
      retryAfter: null,
    })
  })

  test('advances active-window timestamp after allowed request', () => {
    const result = consumeRateLimit(
      { count: 1, lastRequest: 15_000 },
      { max: 3, window: 10 },
      20_000,
    )

    expect(result.next).toEqual({ count: 2, lastRequest: 20_000 })
  })

  test('allows only three concurrent consumes through serialized mutation boundary', async () => {
    let current: { count: number; lastRequest: number } | null = null
    let queue = Promise.resolve()
    const consume = async (): Promise<boolean> => {
      let allowed = false
      queue = queue.then(() => {
        const decision = consumeRateLimit(current, { max: 3, window: 10 }, 20_000)
        current = decision.next
        allowed = decision.allowed
      })
      await queue
      return allowed
    }
    const decisions = await Promise.all(Array.from({ length: 4 }, consume))

    expect(decisions).toEqual([true, true, true, false])
  })
})

describe('auth limiter subjects', () => {
  test('normalizes and hashes email plus OTP type', async () => {
    const first = await hashLimiterSubject('  USER@Example.COM ', 'email-verification')
    const second = await hashLimiterSubject('user@example.com', 'email-verification')
    const otherType = await hashLimiterSubject('user@example.com', 'change-email')

    expect(first).toBe(second)
    expect(first).not.toContain('user@example.com')
    expect(first).not.toBe(otherType)
  })
})

describe('password reset eligibility', () => {
  test('rejects pending OAuth identity without profile or credential account', () => {
    expect(isPasswordResetEligible(false, ['google'])).toBe(false)
  })

  test('accepts completed profile or credential account', () => {
    expect(isPasswordResetEligible(true, ['google'])).toBe(true)
    expect(isPasswordResetEligible(false, ['credential'])).toBe(true)
  })
})

describe('Resend retry policy', () => {
  test('retries 429 and 5xx with 500ms then 1000ms delays', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: 'busy', statusCode: 429 } })
      .mockResolvedValueOnce({ data: null, error: { message: 'down', statusCode: 503 } })
      .mockResolvedValueOnce({ data: { id: 'email-1' }, error: null })
    const delay = vi.fn().mockResolvedValue(undefined)
    const warn = vi.fn()

    await expect(sendWithRetry({ delay, send, warn })).resolves.toEqual({ id: 'email-1' })
    expect(send).toHaveBeenCalledTimes(3)
    expect(delay.mock.calls).toEqual([[500], [1000]])
    expect(warn.mock.calls).toEqual([
      ['Resend email attempt failed.', { attempt: 1, code: null, retryable: true, statusCode: 429 }],
      ['Resend email attempt failed.', { attempt: 2, code: null, retryable: true, statusCode: 503 }],
    ])
  })

  test.each([400, 401, 422])('fails status %s without retry', async (statusCode) => {
    const send = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'invalid', statusCode },
    })
    const delay = vi.fn().mockResolvedValue(undefined)

    await expect(sendWithRetry({ delay, send, warn: vi.fn() })).rejects.toThrow('Resend email failed.')
    expect(send).toHaveBeenCalledTimes(1)
    expect(delay).not.toHaveBeenCalled()
  })

  test('raises final error after third retryable failure', async () => {
    const send = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'still down', statusCode: 500 },
    })
    const delay = vi.fn().mockResolvedValue(undefined)

    await expect(sendWithRetry({ delay, send, warn: vi.fn() })).rejects.toThrow(
      'Resend email failed after 3 attempts.',
    )
    expect(send).toHaveBeenCalledTimes(3)
    expect(delay.mock.calls).toEqual([[500], [1000]])
  })

  test('never exposes provider message while preserving safe status code and attempts', async () => {
    const sensitive = 'recipient user@example.com token=otp-123 body={secret}'
    const warn = vi.fn()
    const send = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'rate_limit', message: sensitive, statusCode: 429 },
    })

    let caught: unknown
    try {
      await sendWithRetry({ delay: vi.fn().mockResolvedValue(undefined), send, warn })
    } catch (error) {
      caught = error
    }

    expect(caught).toMatchObject({
      attempt: 3,
      code: 'rate_limit',
      message: 'Resend email failed after 3 attempts.',
      statusCode: 429,
    })
    expect(JSON.stringify(caught)).not.toContain(sensitive)
    expect(JSON.stringify(warn.mock.calls)).not.toContain(sensitive)
    expect(warn).toHaveBeenLastCalledWith('Resend email attempt failed.', {
      attempt: 3,
      code: 'rate_limit',
      retryable: true,
      statusCode: 429,
    })
  })
})
