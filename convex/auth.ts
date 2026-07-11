import { createClient, type GenericCtx } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import { betterAuth } from 'better-auth/minimal'
import { emailOTP } from 'better-auth/plugins/email-otp'
import { type GenericActionCtx } from 'convex/server'

import { components, internal } from './_generated/api'
import { type DataModel } from './_generated/dataModel'

import { sendAuthEmail } from './authEmailDelivery'
import { renderAuthEmail } from './authEmails'
import { logSafeFailure } from './authFailureLog'
import {
  orchestrateOtpSend,
  orchestratePasswordReset,
  scheduleNonBlocking,
} from './authOrchestration'
import {
  getAuthRateLimitRules,
  hashLimiterSubject,
  isPasswordResetEligible,
} from './authSecurity'
import authConfig from './auth.config'
import { authOauthTriggers, authUserCreateBeforeHook } from './authOAuthHandlers'

type EmailOtpType =
  | 'sign-in'
  | 'email-verification'
  | 'forget-password'
  | 'change-email'

type AuthRunCtx = GenericCtx<DataModel> & Pick<
  GenericActionCtx<DataModel>,
  'runMutation' | 'runQuery' | 'scheduler'
>
type AuthComponent = ReturnType<typeof createClient<DataModel>>
type AuthAccount = { providerId: string }

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

const getEmailTone = (type: EmailOtpType): 'cyan' | 'coral' => {
  if (type === 'forget-password') {
    return 'coral'
  }
  return 'cyan'
}

const sendVerificationOtp = async ({
  ctx,
  email,
  otp,
  type,
}: {
  ctx: GenericCtx<DataModel>
  email: string
  otp: string
  type: EmailOtpType
}): Promise<void> => {
  const actionCtx = requireActionCtx(ctx)
  const subject = getEmailSubject(type)
  const intro = getEmailIntro(type)
  const template = renderAuthEmail({
    actionHref: null,
    actionLabel: null,
    code: otp,
    intro,
    meta: 'This code expires in 10 minutes.',
    preheader: `${subject}. This code expires in 10 minutes.`,
    title: subject,
    tone: getEmailTone(type),
  })
  const otpKey = await hashLimiterSubject(email, type)
  const claimId = crypto.randomUUID()
  await orchestrateOtpSend({
    claim: async () => await actionCtx.runMutation(internal.otpSendLimits.claim, {
      claimId,
      key: otpKey,
    }),
    finalize: async (ownedClaimId) => await actionCtx.runMutation(
      internal.otpSendLimits.finalize,
      { claimId: ownedClaimId, key: otpKey },
    ),
    release: async (ownedClaimId) => await actionCtx.runMutation(
      internal.otpSendLimits.release,
      { claimId: ownedClaimId, key: otpKey },
    ),
    send: async () => {
      const messageKey = await toTokenKey(`${type}:${email}:${otp}`)
      await sendAuthEmail({
        html: template.html,
        idempotencyKey: `auth-otp/${messageKey}`,
        to: email,
        subject,
        text: template.text,
      })
    },
  })
}

const getPasswordResetUrl = (token: string): string => {
  const url = new URL('/auth/reset-password', requireEnv('SITE_URL'))
  url.searchParams.set('token', token)
  return url.href
}

const sendResetPassword = async ({
  checkEligible,
  ctx,
  deleteVerification,
  token,
  user,
}: {
  checkEligible: (authId: string) => Promise<boolean>
  ctx: GenericCtx<DataModel>
  deleteVerification: (token: string) => Promise<void>
  token: string
  user: { email: string; id: string }
}): Promise<void> => {
  const actionCtx = requireActionCtx(ctx)
  const tokenKey = await toTokenKey(token)
  const resetUrl = getPasswordResetUrl(token)
  await orchestratePasswordReset({
    authId: user.id,
    checkEligible,
    clearShadow: async (ownedTokenKey) => {
      await actionCtx.runMutation(internal.passwordResets.clearInternal, {
        tokenKey: ownedTokenKey,
      })
    },
    deleteVerification,
    logError: (message, error) => logSafeFailure(message, error, console.error),
    markShadow: async () => {
      await actionCtx.runMutation(internal.passwordResets.mark, {
        authId: user.id,
        tokenKey,
      })
    },
    schedule: async () => await actionCtx.scheduler.runAfter(
      0,
      internal.authNotices.sendPasswordResetDelivery,
      { email: user.email, resetUrl, tokenKey },
    ),
    token,
    tokenKey,
  })
}

const schedulePasswordResetNotice = async ({
  ctx,
  user,
}: {
  ctx: GenericCtx<DataModel>
  user: { email: string }
}): Promise<void> => {
  await scheduleNonBlocking({
    logError: (message, error) => logSafeFailure(message, error, console.error),
    schedule: async () => {
      const actionCtx = requireActionCtx(ctx)
    const idempotencyKey = await toTokenKey(
      `password-reset-notice:${user.email}:${Date.now()}`,
    )
      return await actionCtx.scheduler.runAfter(
        0,
        internal.authNotices.sendPasswordReset,
        { email: user.email, idempotencyKey },
      )
    },
  })
}

const requireActionCtx = (ctx: GenericCtx<DataModel>): AuthRunCtx => {
  if (!('runMutation' in ctx) || !('runQuery' in ctx) || !('scheduler' in ctx)) {
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

export const authComponent: AuthComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions: {
    onCreate: internal.auth.onCreate,
    onDelete: internal.auth.onDelete,
    onUpdate: internal.auth.onUpdate,
  },
  triggers: authOauthTriggers,
})

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  const siteUrl = requireEnv('SITE_URL')
  let checkResetEligible: (authId: string) => Promise<boolean> = async () => {
    throw new Error('AnimeX auth context was not initialized.')
  }
  let deleteResetVerification: (token: string) => Promise<void> = async () => {
    throw new Error('AnimeX auth context was not initialized.')
  }

  const auth = betterAuth({
    account: {
      accountLinking: {
        enabled: false,
        disableImplicitLinking: true,
      },
    },
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    databaseHooks: {
      user: {
        create: {
          before: authUserCreateBeforeHook,
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
      maxPasswordLength: 24,
      resetPasswordTokenExpiresIn: RESET_TOKEN_TTL_SECONDS,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ token, user }) => {
        await sendResetPassword({
          ctx,
          checkEligible: checkResetEligible,
          deleteVerification: deleteResetVerification,
          token,
          user,
        })
      },
      onPasswordReset: async ({ user }) => {
        await schedulePasswordResetNotice({ ctx, user })
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
    },
    socialProviders: {
      google: {
        clientId: requireEnv('GOOGLE_CLIENT_ID'),
        clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
      },
    },
    plugins: [
      emailOTP({
        changeEmail: {
          enabled: true,
          verifyCurrentEmail: false,
        },
        sendVerificationOTP: async ({ email, otp, type }) => {
          await sendVerificationOtp({ ctx, email, otp, type })
        },
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
    rateLimit: {
      enabled: true,
      customRules: getAuthRateLimitRules(),
      customStorage: {
        get: async (key) => {
          const actionCtx = requireActionCtx(ctx)
          const value = await actionCtx.runQuery(internal.authRateLimits.get, { key })
          return value ? { key, ...value } : null
        },
        set: async (key, value) => {
          const actionCtx = requireActionCtx(ctx)
          await actionCtx.runMutation(internal.authRateLimits.set, {
            count: value.count,
            key,
            lastRequest: value.lastRequest,
          })
        },
        consume: async (key, rule) => {
          const actionCtx = requireActionCtx(ctx)
          return await actionCtx.runMutation(internal.authRateLimits.consume, {
            key,
            max: rule.max,
            window: rule.window,
          })
        },
      },
    },
    trustedOrigins: [siteUrl],
  })
  checkResetEligible = async (authId) => {
    const actionCtx = requireActionCtx(ctx)
    const context = await auth.$context
    const [hasProfile, accounts] = await Promise.all([
      actionCtx.runQuery(internal.users.hasProfile, { authId }),
      context.internalAdapter.findAccounts(authId),
    ])
    return isPasswordResetEligible(
      hasProfile,
      accounts.map((account: AuthAccount) => account.providerId),
    )
  }
  deleteResetVerification = async (token) => {
    const context = await auth.$context
    await context.internalAdapter.deleteVerificationByIdentifier(
      `reset-password:${token}`,
    )
  }
  return auth
}

export const { getAuthUser } = authComponent.clientApi()
export const { onCreate, onDelete, onUpdate } = authComponent.triggersApi()
