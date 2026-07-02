import { describe, expect, test } from 'vitest'

import {
  confirmPasswordSchema,
  normalizeAccountEmail,
  otpSchema,
  resetTokenSchema,
  validatePassword,
  validateUsername,
} from './auth-validation'

describe('auth validation', () => {
  test('accepts valid usernames with typed capitalization', () => {
    expect(validateUsername('Mika_2026')).toEqual({ valid: true })
    expect(validateUsername('mika_2026')).toEqual({ valid: true })
  })

  test('rejects invalid username formats', () => {
    expect(validateUsername('mi')).toEqual({
      valid: false,
      message: 'Username must be 3-30 characters.',
    })
    expect(validateUsername('_mika')).toEqual({
      valid: false,
      message: 'Username cannot start or end with underscore.',
    })
    expect(validateUsername('mika san')).toEqual({
      valid: false,
      message: 'Use letters, numbers, and underscores only.',
    })
  })

  test('validates MVP password rules', () => {
    expect(validatePassword('animex2026')).toEqual({ valid: true })
    expect(validatePassword('short')).toEqual({
      valid: false,
      message: 'Password must be 8-24 characters.',
    })
    expect(validatePassword('a'.repeat(25))).toEqual({
      valid: false,
      message: 'Password must be 8-24 characters.',
    })
  })

  test('normalizes account email for auth submit', () => {
    expect(normalizeAccountEmail('  Mika@Example.COM ')).toBe('mika@example.com')
  })

  test('rejects invalid account email values', () => {
    expect(() => normalizeAccountEmail('not-an-email')).toThrow('Enter a valid email address.')
  })

  test('validates confirm password match', () => {
    expect(confirmPasswordSchema.parse({
      password: 'animex2026',
      confirmPassword: 'animex2026',
    })).toEqual({
      password: 'animex2026',
      confirmPassword: 'animex2026',
    })
    expect(() => confirmPasswordSchema.parse({
      password: 'animex2026',
      confirmPassword: 'animex2027',
    })).toThrow('Passwords must match.')
  })

  test('requires non-empty OTP and reset token values', () => {
    expect(otpSchema.parse('  527382  ')).toBe('527382')
    expect(resetTokenSchema.parse('  token-value  ')).toBe('token-value')
    expect(() => otpSchema.parse('   ')).toThrow('Verification code is required.')
    expect(() => resetTokenSchema.parse('   ')).toThrow('Reset token is required.')
  })
})
