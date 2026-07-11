import { describe, expect, test } from 'vitest'

import { resolveAuthReturnTo } from './auth-return'

describe('resolveAuthReturnTo', () => {
  test('sends a missing target home', () => {
    expect(resolveAuthReturnTo(null)).toEqual({ available: true, path: '/home' })
  })

  test('preserves a same-origin path, query, and hash', () => {
    expect(resolveAuthReturnTo('/anime/86?tab=reviews#latest')).toEqual({
      available: true,
      path: '/anime/86?tab=reviews#latest',
    })
  })

  test.each([
    '//evil.example/path',
    '/\\evil.example/path',
    '/%5cevil.example/path',
    'https://user:password@evil.example/path',
    'https://evil.example/path',
    '/auth',
    '/auth/sign-in',
  ])('rejects unavailable target %s', (target) => {
    expect(resolveAuthReturnTo(target)).toEqual({
      available: false,
      message: 'This content is unavailable.',
    })
  })
})
