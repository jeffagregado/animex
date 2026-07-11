import { describe, expect, test } from 'vitest'

import { renderAuthEmail } from './authEmails'

describe('password reset email', () => {
  test('includes exact preheader and visible raw fallback URL', () => {
    const url = 'https://animex.example/auth/reset-password?token=secret'
    const template = renderAuthEmail({
      actionHref: url,
      actionLabel: 'Reset password',
      code: null,
      intro: 'Use this secure link to reset your AnimeX password.',
      meta: 'This link expires in 30 minutes.',
      preheader: 'Use this link within 30 minutes to reset your password.',
      title: 'Reset your AnimeX password',
      tone: 'coral',
    })

    expect(template.html).toContain('Use this link within 30 minutes to reset your password.')
    expect(template.html).toContain(`>${url.replaceAll('&', '&amp;')}</a>`)
    expect(template.text).toContain(url)
  })

  test('uses exact password-reset notice copy', () => {
    const template = renderAuthEmail({
      actionHref: null,
      actionLabel: null,
      code: null,
      intro: 'Your AnimeX password was reset.',
      meta: 'If this was not you, contact support.',
      preheader: 'Your AnimeX password was reset.',
      title: 'Your AnimeX password was reset.',
      tone: 'cyan',
    })

    expect(template.html).toContain('Your AnimeX password was reset.')
    expect(template.text).toContain('Your AnimeX password was reset.')
  })
})
