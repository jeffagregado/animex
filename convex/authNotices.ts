import { v } from 'convex/values'

import { internalAction } from './_generated/server'
import { sendAuthEmail } from './authEmailDelivery'
import { renderAuthEmail } from './authEmails'
import { logSafeFailure } from './authFailureLog'

export const sendPasswordReset = internalAction({
  args: { email: v.string(), idempotencyKey: v.string() },
  returns: v.null(),
  handler: async (_ctx, args) => {
    const copy = 'Your AnimeX password was reset.'
    const template = renderAuthEmail({
      actionHref: null,
      actionLabel: null,
      code: null,
      intro: copy,
      meta: 'If this was not you, contact support.',
      preheader: copy,
      title: copy,
      tone: 'cyan',
    })

    try {
      await sendAuthEmail({
        html: template.html,
        idempotencyKey: `auth-password-reset-notice/${args.idempotencyKey}`,
        subject: copy,
        text: template.text,
        to: args.email,
      })
    } catch (error) {
      logSafeFailure('Password reset security notice failed.', error, console.error)
      throw error
    }
    return null
  },
})

export const sendPasswordResetDelivery = internalAction({
  args: {
    email: v.string(),
    resetUrl: v.string(),
    tokenKey: v.string(),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    const template = renderAuthEmail({
      actionHref: args.resetUrl,
      actionLabel: 'Reset password',
      code: null,
      intro: 'Use this secure link to reset your AnimeX password.',
      meta: 'This link expires in 30 minutes.',
      preheader: 'Use this link within 30 minutes to reset your password.',
      title: 'Reset your AnimeX password',
      tone: 'coral',
    })
    try {
      await sendAuthEmail({
        html: template.html,
        idempotencyKey: `auth-password-reset/${args.tokenKey}`,
        subject: 'Reset your AnimeX password',
        text: template.text,
        to: args.email,
      })
    } catch (error) {
      logSafeFailure('Password reset delivery failed.', error, console.error)
      throw error
    }
    return null
  },
})
