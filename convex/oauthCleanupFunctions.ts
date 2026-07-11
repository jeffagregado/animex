import { v } from 'convex/values'

import { components, internal } from './_generated/api'
import { internalAction, internalMutation, type ActionCtx } from './_generated/server'
import { createAuth } from './auth'
import { toSafeFailureMetadata } from './authFailureLog'
import {
  cleanupPendingIdentity,
  CLEANUP_BATCH_LIMIT,
  CLEANUP_LEASE_MS,
} from './oauthCleanup'
import { deleteAuthVerificationRows } from './authVerificationCleanup'

const PRUNE_BATCH_LIMIT = 20
const RATE_LIMIT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

type AuthAccount = { accountId: string; providerId: string }
type AuthSession = { expiresAt: Date }
type VerificationPage = {
  isDone: boolean
  page: Array<{ identifier: string }>
}
type CleanupPending = {
  authId: string
  cleanupAfter: number
  email: string
  providerAccountId: string | null
  providerId: string | null
  state: 'provisional' | 'oauth'
  cleanupPhase: 'deleting' | null
}
type CleanupAuthContext = Awaited<ReturnType<typeof createAuth>['$context']>

const processPendingCleanup = async (
  ctx: ActionCtx,
  authContext: CleanupAuthContext,
  pending: CleanupPending,
): Promise<void> => {
  const leaseUntil = Date.now() + CLEANUP_LEASE_MS
  const leased = await ctx.runMutation(internal.pendingOauthSignups.acquireLease, {
    authId: pending.authId,
    leaseUntil,
    now: Date.now(),
  })
  if (!leased) {
    console.log('OAuth cleanup skipped: lease unavailable.', { authId: pending.authId })
    return
  }

  try {
    const result = await cleanupPendingIdentity({
      cleanupAfter: pending.cleanupAfter,
      cleanupPhase: pending.cleanupPhase ?? undefined,
      providerId: pending.providerId,
      state: pending.state,
    }, Date.now(), {
      deleteAuth: async () => await authContext.internalAdapter.deleteUser(pending.authId),
      deleteVerifications: async () => await deleteAuthVerificationRows({
        listByAuthId: async (authId, limit) => {
          const page = await ctx.runQuery(components.betterAuth.adapter.findMany, {
            model: 'verification',
            paginationOpts: { cursor: null, numItems: limit },
            where: [{ field: 'value', value: authId }],
          }) as VerificationPage
          return {
            hasMore: !page.isDone,
            identifiers: page.page.map((verification) => verification.identifier),
          }
        },
        remove: async (identifier) => {
          await authContext.internalAdapter.deleteVerificationByIdentifier(identifier)
        },
      }, pending.authId, pending.email),
      finish: async () => {
        await ctx.runMutation(internal.pendingOauthSignups.finishCleanup, {
          authId: pending.authId,
          leaseUntil,
        })
      },
      inspect: async () => {
        const [hasProfile, accounts, sessions] = await Promise.all([
          ctx.runQuery(internal.users.hasProfile, { authId: pending.authId }),
          authContext.internalAdapter.findAccounts(pending.authId),
          authContext.internalAdapter.listSessions(pending.authId, { onlyActiveSessions: true }),
        ])
        return {
          accountExists: accounts.some((account: AuthAccount) =>
            account.providerId === pending.providerId &&
            account.accountId === pending.providerAccountId),
          hasAccount: accounts.length > 0,
          hasActiveSession: sessions.some((session: AuthSession) =>
            session.expiresAt.getTime() > Date.now()),
          hasProfile,
        }
      },
      markDeleting: async () => {
        await ctx.runMutation(
          internal.pendingOauthSignups.markDeleting,
          { authId: pending.authId, leaseUntil },
        )
      },
      releaseLease: async () => {
        await ctx.runMutation(internal.pendingOauthSignups.releaseLease, {
          authId: pending.authId,
          leaseUntil,
        })
      },
    })
    console.log(`OAuth cleanup ${result} pending identity.`, { authId: pending.authId })
  } catch (error) {
    console.error('OAuth cleanup failed; lease retained until expiry.', {
      authId: pending.authId,
      ...toSafeFailureMetadata(error),
    })
    throw error
  }
}

export const pruneLocalAuthState = internalMutation({
  args: { now: v.number() },
  returns: v.object({
    authRateLimits: v.number(),
    otpSendLimits: v.number(),
    passwordResets: v.number(),
  }),
  handler: async (ctx, args) => {
    const [rateLimits, otpLimits, passwordResets] = await Promise.all([
      ctx.db.query('authRateLimits')
        .withIndex('by_last_request', (q) => q.lte('lastRequest', args.now - RATE_LIMIT_RETENTION_MS))
        .take(PRUNE_BATCH_LIMIT),
      ctx.db.query('otpSendLimits')
        .withIndex('by_next_allowed_at', (q) => q.lte('nextAllowedAt', args.now))
        .take(PRUNE_BATCH_LIMIT),
      ctx.db.query('passwordResets')
        .withIndex('by_expires_at', (q) => q.lte('expiresAt', args.now))
        .take(PRUNE_BATCH_LIMIT),
    ])
    await Promise.all([
      ...rateLimits.map(async (row) => await ctx.db.delete(row._id)),
      ...otpLimits.map(async (row) => await ctx.db.delete(row._id)),
      ...passwordResets.map(async (row) => await ctx.db.delete(row._id)),
    ])
    return {
      authRateLimits: rateLimits.length,
      otpSendLimits: otpLimits.length,
      passwordResets: passwordResets.length,
    }
  },
})

export const runWeeklyCleanup = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now()
    const due = await ctx.runQuery(internal.pendingOauthSignups.listDue, {
      limit: CLEANUP_BATCH_LIMIT,
      now,
    })
    const authContext = await createAuth(ctx).$context

    for (const pending of due) await processPendingCleanup(ctx, authContext, pending)

    const pruned = await ctx.runMutation(internal.oauthCleanupFunctions.pruneLocalAuthState, { now })
    console.log('Weekly auth cleanup completed.', { pendingProcessed: due.length, ...pruned })
    return null
  },
})
