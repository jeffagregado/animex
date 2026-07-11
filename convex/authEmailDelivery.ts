import { Resend } from 'resend'

import { sendWithRetry } from './authSecurity'

const requireEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required for AnimeX auth.`)
  }
  return value
}

// Keep sandbox delivery pinned to explicit localhost configuration.
export const getAuthEmailRecipient = (email: string): string => {
  if (process.env.RESEND_TEST_MODE === 'true') {
    if (requireEnv('SITE_URL') !== 'http://localhost:3000') {
      throw new Error('RESEND_TEST_MODE can only be used with local SITE_URL.')
    }
    return requireEnv('RESEND_TEST_RECIPIENT')
  }
  return email
}

const delay = async (milliseconds: number): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}

// Send one auth email with stable idempotency and bounded retry policy.
export const sendAuthEmail = async ({
  html,
  idempotencyKey,
  subject,
  text,
  to,
}: {
  html: string
  idempotencyKey: string
  subject: string
  text: string
  to: string
}): Promise<void> => {
  const resend = new Resend(requireEnv('RESEND_API_KEY'))
  await sendWithRetry({
    delay,
    send: async () => await resend.emails.send(
      {
        from: requireEnv('RESEND_FROM_EMAIL'),
        html,
        subject,
        text,
        to: getAuthEmailRecipient(to),
      },
      { idempotencyKey },
    ),
    warn: (message, metadata) => console.warn(message, metadata),
  })
}
