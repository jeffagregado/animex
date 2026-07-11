import { APIError } from 'better-auth/api'

import { components } from './_generated/api'
import { type MutationCtx } from './_generated/server'
import {
  advancePendingSession,
  applyAccountToProvisional,
  assertAuthUserCreationAllowed,
  buildPendingOauthSignup,
  buildProvisionalIdentity,
  GOOGLE_OAUTH_ERROR,
} from './oauthLifecycle'

type AuthHookUser = { email: string; emailVerified: boolean }
type AuthHookContext = {
  body?: Record<string, unknown> | null
  params?: Record<string, unknown> | null
  path?: string
} | null
type AuthUserDoc = { _id: string; email: string; name: string }
type AuthAccountDoc = { accountId: string; providerId: string; userId: string }
type AuthSessionDoc = { expiresAt: number; userId: string }

export const authUserCreateBeforeHook = async (
  user: AuthHookUser,
  context: AuthHookContext,
): Promise<void> => {
  try {
    assertAuthUserCreationAllowed({
      body: {
        idToken: context?.body?.idToken,
        provider: context?.body?.provider,
      },
      params: { id: context?.params?.id },
      path: context?.path ?? '',
    }, user)
  } catch {
    throw new APIError('BAD_REQUEST', {
      code: 'GOOGLE_EMAIL_NOT_VERIFIED',
      message: GOOGLE_OAUTH_ERROR,
    })
  }
}

export const authUserCreateTrigger = async (
  ctx: MutationCtx,
  user: AuthUserDoc,
): Promise<void> => {
  const now = Date.now()
  const existing = await ctx.db
    .query('pendingOauthSignups')
    .withIndex('by_auth_id', (q) => q.eq('authId', user._id))
    .unique()
  if (!existing) {
    await ctx.db.insert('pendingOauthSignups', buildProvisionalIdentity({
      email: user.email,
      id: user._id,
      name: user.name,
    }, now))
  }
}

export const authAccountCreateTrigger = async (
  ctx: MutationCtx,
  account: AuthAccountDoc,
): Promise<void> => {
  const pending = await ctx.db
    .query('pendingOauthSignups')
    .withIndex('by_auth_id', (q) => q.eq('authId', account.userId))
    .unique()
  if (account.providerId !== 'google') {
    if (pending?.state === 'provisional') await ctx.db.delete(pending._id)
    return
  }
  const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: 'user',
    where: [{ field: '_id', value: account.userId }],
  })
  if (!user || !user.email?.trim() || user.emailVerified !== true) {
    throw new Error(GOOGLE_OAUTH_ERROR)
  }
  const now = Date.now()
  const value = buildPendingOauthSignup(account, user, now)
  const byProvider = await ctx.db
    .query('pendingOauthSignups')
    .withIndex('by_provider_account', (q) => q
      .eq('providerId', account.providerId)
      .eq('providerAccountId', account.accountId))
    .unique()
  const existing = byProvider ?? pending
  if (existing) {
    const provisional = buildProvisionalIdentity({
      email: existing.email,
      id: existing.authId,
      name: user.name,
    }, existing.createdAt)
    const oauth = applyAccountToProvisional(provisional, account, now)
    if (!oauth) throw new Error('Google pending conversion failed.')
    await ctx.db.patch(existing._id, { ...oauth, createdAt: existing.createdAt })
    return
  }
  await ctx.db.insert('pendingOauthSignups', { ...value, state: 'oauth' })
}

export const authSessionWriteTrigger = async (
  ctx: MutationCtx,
  session: AuthSessionDoc,
): Promise<void> => {
  const pending = await ctx.db
    .query('pendingOauthSignups')
    .withIndex('by_auth_id', (q) => q.eq('authId', session.userId))
    .unique()
  if (!pending) return
  const next = advancePendingSession(pending, Date.now(), session.expiresAt)
  if (!next.allowed) throw new Error('Google sign-in is temporarily blocked by account cleanup.')
  await ctx.db.patch(pending._id, {
    cleanupAfter: next.cleanupAfter,
    lastSessionExpiresAt: next.lastSessionExpiresAt,
    updatedAt: next.updatedAt,
  })
}

export const authOauthTriggers = {
  account: { onCreate: authAccountCreateTrigger },
  session: {
    onCreate: authSessionWriteTrigger,
    onUpdate: authSessionWriteTrigger,
  },
  user: { onCreate: authUserCreateTrigger },
}
