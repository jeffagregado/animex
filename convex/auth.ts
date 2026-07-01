import { createClient, type GenericCtx } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import { betterAuth } from 'better-auth/minimal'
import { emailOTP } from 'better-auth/plugins/email-otp'
import { type GenericActionCtx } from 'convex/server'
import { Resend } from 'resend'

import { components, internal } from './_generated/api'
import { type DataModel } from './_generated/dataModel'

import authConfig from './auth.config'

type EmailOtpType =
  | 'sign-in'
  | 'email-verification'
  | 'forget-password'
  | 'change-email'

type AuthRunCtx = GenericCtx<DataModel> & Pick<
  GenericActionCtx<DataModel>,
  'runMutation'
>

const RESET_TOKEN_TTL_SECONDS = 1800

const requireEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required for AnimeX auth.`)
  }
  return value
}

const getEmailSubject = (type: EmailOtpType): string => {
  if (type === 'forget-password') {
    return 'Reset your AnimeX password'
  }
  if (type === 'change-email') {
    return 'Confirm your new AnimeX email'
  }
  return 'Verify your AnimeX email'
}

const getEmailIntro = (type: EmailOtpType): string => {
  if (type === 'forget-password') {
    return 'Use this code to reset your AnimeX password.'
  }
  if (type === 'change-email') {
    return 'Use this code to confirm your new AnimeX email.'
  }
  return 'Use this code to verify your AnimeX account.'
}

const getRecipient = (email: string): string => {
  if (process.env.RESEND_TEST_MODE === 'true') {
    if (requireEnv('SITE_URL') !== 'http://localhost:3000') {
      throw new Error('RESEND_TEST_MODE can only be used with local SITE_URL.')
    }
    return requireEnv('RESEND_TEST_RECIPIENT')
  }
  return email
}

const sendResendEmail = async ({
  from,
  to,
  subject,
  text,
}: {
  from: string
  to: string
  subject: string
  text: string
}): Promise<void> => {
  const resend = new Resend(requireEnv('RESEND_API_KEY'))
  const attempts = 3
  let lastError: unknown = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await resend.emails.send({ from, to, subject, text })
      return
    } catch (error) {
      lastError = error
      console.warn(`Resend email attempt ${attempt} failed.`)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Resend email failed.')
}

const sendVerificationOtp = async ({
  email,
  otp,
  type,
}: {
  email: string
  otp: string
  type: EmailOtpType
}): Promise<void> => {
  const recipient = getRecipient(email)
  const subject = getEmailSubject(type)
  const intro = getEmailIntro(type)
  const from = requireEnv('RESEND_FROM_EMAIL')

  await sendResendEmail({
    from,
    to: recipient,
    subject,
    text: `${intro}\n\n${otp}\n\nThis code expires in 10 minutes.`,
  })
}

const getPasswordResetUrl = (token: string): string => {
  const url = new URL('/auth/reset-password', requireEnv('SITE_URL'))
  url.searchParams.set('token', token)
  return url.href
}

const sendResetPassword = async ({
  ctx,
  token,
  user,
}: {
  ctx: GenericCtx<DataModel>
  token: string
  user: { email: string; id: string }
}): Promise<void> => {
  const actionCtx = requireActionCtx(ctx)
  const tokenKey = await toTokenKey(token)
  const resetUrl = getPasswordResetUrl(token)
  await actionCtx.runMutation(internal.passwordResets.mark, {
    authId: user.id,
    tokenKey,
  })
  await sendResendEmail({
    from: requireEnv('RESEND_FROM_EMAIL'),
    to: getRecipient(user.email),
    subject: 'Reset your AnimeX password',
    text: [
      'Use this link to reset your AnimeX password.',
      '',
      resetUrl,
      '',
      'This link expires in 30 minutes.',
    ].join('\n'),
  })
}

const sendPasswordResetNotice = async ({
  user,
}: {
  user: { email: string }
}): Promise<void> => {
  await sendResendEmail({
    from: requireEnv('RESEND_FROM_EMAIL'),
    to: getRecipient(user.email),
    subject: 'Your AnimeX password was changed',
    text: 'Your AnimeX password was changed. If this was not you, contact support.',
  })
}

const requireActionCtx = (ctx: GenericCtx<DataModel>): AuthRunCtx => {
  if (!('runMutation' in ctx)) {
    throw new Error('AnimeX auth hooks require a Convex action context.')
  }
  return ctx as AuthRunCtx
}

const toTokenKey = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export const authComponent = createClient<DataModel>(components.betterAuth)

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  const siteUrl = requireEnv('SITE_URL')

  return betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 24,
      resetPasswordTokenExpiresIn: RESET_TOKEN_TTL_SECONDS,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ token, user }) => {
        await sendResetPassword({ ctx, token, user })
      },
      onPasswordReset: sendPasswordResetNotice,
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
    },
    socialProviders: {
      google: {
        clientId: requireEnv('GOOGLE_CLIENT_ID'),
        clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
      },
    },
    plugins: [
      emailOTP({
        sendVerificationOTP: sendVerificationOtp,
        sendVerificationOnSignUp: true,
        overrideDefaultEmailVerification: true,
        expiresIn: 600,
        allowedAttempts: 5,
        rateLimit: {
          window: 60,
          max: 5,
        },
      }),
      convex({ authConfig }),
    ],
    trustedOrigins: [siteUrl],
  })
}

export const { getAuthUser } = authComponent.clientApi()
