import { describe, expect, test, vi } from 'vitest'

import { logSafeFailure, toSafeFailureMetadata } from './authFailureLog'

describe('safe auth failure logging', () => {
  test('keeps allowlisted delivery metadata and drops sensitive provider fields', () => {
    const sensitive = 'recipient=user@example.com otp=123456 request-body-secret'
    const error = {
      attempt: 2,
      code: 'rate_limit',
      message: sensitive,
      requestBody: sensitive,
      responseBody: sensitive,
      statusCode: 429,
    }

    expect(toSafeFailureMetadata(error)).toEqual({
      attempt: 2,
      code: 'rate_limit',
      statusCode: 429,
    })
    expect(JSON.stringify(toSafeFailureMetadata(error))).not.toContain(sensitive)
  })

  test('logs a stable label and metadata without passing the error object', () => {
    const log = vi.fn()
    const sensitive = 'provider detail token=secret'

    logSafeFailure('Password reset delivery failed.', new Error(sensitive), log)

    expect(log).toHaveBeenCalledWith('Password reset delivery failed.', {
      attempt: null,
      code: null,
      statusCode: null,
    })
    expect(JSON.stringify(log.mock.calls)).not.toContain(sensitive)
  })
})
