import { describe, expect, test } from 'vitest'

import {
  normalizeAccountEmail,
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
})
