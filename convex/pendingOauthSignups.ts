import { v } from 'convex/values'

import { type Doc } from './_generated/dataModel'
import { internalMutation, internalQuery, type MutationCtx } from './_generated/server'
import { acquireCleanupLease, releaseCleanupLease } from './oauthCleanup'

type PendingAuthRow = {
  authId: string
  email: string
  providerAccountId: string | null
  providerId: string | null
  state: 'provisional' | 'oauth'
  suggestedUsername: string | null
  cleanupAfter: number
  cleanupLeaseUntil: number | null
  cleanupPhase: 'deleting' | null
  lastSessionExpiresAt: number | null
}

type PendingOauthSignup = Doc<'pendingOauthSignups'>

const toNullableString = (value: string | undefined): string | null => {
  if (value === undefined) return null
  return value
}

const toNullableNumber = (value: number | undefined): number | null => {
  if (value === undefined) return null
  return value
}

const toNullableCleanupPhase = (
  value: 'deleting' | undefined,
): 'deleting' | null => {
  if (value === undefined) return null
  return value
}

const toPendingAuthRow = (pending: PendingOauthSignup): PendingAuthRow => ({
  authId: pending.authId,
  email: pending.email,
  providerAccountId: toNullableString(pending.providerAccountId),
  providerId: toNullableString(pending.providerId),
  state: pending.state,
  suggestedUsername: toNullableString(pending.suggestedUsername),
  cleanupAfter: pending.cleanupAfter,
  cleanupLeaseUntil: toNullableNumber(pending.cleanupLeaseUntil),
  cleanupPhase: toNullableCleanupPhase(pending.cleanupPhase),
  lastSessionExpiresAt: toNullableNumber(pending.lastSessionExpiresAt),
})

const isActiveCleanupLease = (
  pending: PendingOauthSignup | null,
  leaseUntil: number,
  now: number,
): pending is PendingOauthSignup => Boolean(
  pending && pending.cleanupLeaseUntil === leaseUntil && leaseUntil > now,
)

const deletePasswordResets = async (
  ctx: MutationCtx,
  authId: string,
): Promise<void> => {
  const resets = await ctx.db
    .query('passwordResets')
    .withIndex('by_auth_id', (q) => q.eq('authId', authId))
    .collect()
  await Promise.all(resets.map(async (reset) => await ctx.db.delete(reset._id)))
}

const assertDeletingCleanup = (
  pending: PendingOauthSignup,
  leaseUntil: number,
  now: number,
): void => {
  if (!isActiveCleanupLease(pending, leaseUntil, now)) {
    throw new Error('OAuth cleanup refused: cleanup lease is not active for this worker.')
  }
  if (pending.cleanupPhase !== 'deleting') {
    throw new Error('OAuth cleanup refused: cleanup lease is not active for this worker.')
  }
}

export const readByAuthId = internalQuery({
  args: { authId: v.string() },
  returns: v.union(
    v.object({
      authId: v.string(),
      email: v.string(),
      providerAccountId: v.union(v.string(), v.null()),
      providerId: v.union(v.string(), v.null()),
      state: v.union(v.literal('provisional'), v.literal('oauth')),
      suggestedUsername: v.union(v.string(), v.null()),
      cleanupAfter: v.number(),
      cleanupLeaseUntil: v.union(v.number(), v.null()),
      cleanupPhase: v.union(v.literal('deleting'), v.null()),
      lastSessionExpiresAt: v.union(v.number(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query('pendingOauthSignups')
      .withIndex('by_auth_id', (q) => q.eq('authId', args.authId))
    .unique()
    if (!pending) {
      return null
    }
    return toPendingAuthRow(pending)
  },
})

export const listDue = internalQuery({
  args: { limit: v.number(), now: v.number() },
  returns: v.array(v.object({
    authId: v.string(),
    cleanupAfter: v.number(),
    email: v.string(),
    providerAccountId: v.union(v.string(), v.null()),
    providerId: v.union(v.string(), v.null()),
    state: v.union(v.literal('provisional'), v.literal('oauth')),
    cleanupPhase: v.union(v.literal('deleting'), v.null()),
  })),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('pendingOauthSignups')
      .withIndex('by_cleanup_after', (q) => q.lte('cleanupAfter', args.now))
      .take(Math.min(args.limit, 20))
    return rows.map((row) => ({
      authId: row.authId,
      cleanupAfter: row.cleanupAfter,
      email: row.email,
      providerAccountId: row.providerAccountId ?? null,
      providerId: row.providerId ?? null,
      state: row.state,
      cleanupPhase: row.cleanupPhase ?? null,
    }))
  },
})

export const acquireLease = internalMutation({
  args: { authId: v.string(), leaseUntil: v.number(), now: v.number() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query('pendingOauthSignups')
      .withIndex('by_auth_id', (q) => q.eq('authId', args.authId))
      .unique()
    if (!pending) return false
    const lease = acquireCleanupLease(pending, args.now, args.leaseUntil)
    if (!lease.acquired) return false
    const profile = await ctx.db
      .query('users')
      .withIndex('by_auth_id', (q) => q.eq('authId', args.authId))
      .unique()
    if (profile) return false
    await ctx.db.patch(pending._id, { cleanupLeaseUntil: lease.cleanupLeaseUntil, updatedAt: args.now })
    return true
  },
})

export const releaseLease = internalMutation({
  args: { authId: v.string(), leaseUntil: v.number() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query('pendingOauthSignups')
      .withIndex('by_auth_id', (q) => q.eq('authId', args.authId))
      .unique()
    if (!pending || !releaseCleanupLease(pending, args.leaseUntil)) return false
    await ctx.db.patch(pending._id, { cleanupLeaseUntil: undefined, updatedAt: Date.now() })
    return true
  },
})

export const markDeleting = internalMutation({
  args: { authId: v.string(), leaseUntil: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query('pendingOauthSignups')
    .withIndex('by_auth_id', (q) => q.eq('authId', args.authId))
    .unique()
    if (!isActiveCleanupLease(pending, args.leaseUntil, Date.now())) {
      throw new Error('OAuth cleanup refused: cleanup lease is not active for deleting phase.')
    }
    const profile = await ctx.db
      .query('users')
      .withIndex('by_auth_id', (q) => q.eq('authId', args.authId))
      .unique()
    if (profile) throw new Error('OAuth cleanup refused: AnimeX profile exists.')
    await ctx.db.patch(pending._id, { cleanupPhase: 'deleting', updatedAt: Date.now() })
    return null
  },
})

export const finishCleanup = internalMutation({
  args: { authId: v.string(), leaseUntil: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query('users')
      .withIndex('by_auth_id', (q) => q.eq('authId', args.authId))
      .unique()
    if (profile) throw new Error('OAuth cleanup refused: AnimeX profile exists.')
    const pending = await ctx.db
      .query('pendingOauthSignups')
      .withIndex('by_auth_id', (q) => q.eq('authId', args.authId))
      .unique()
    if (!pending) return null
    assertDeletingCleanup(pending, args.leaseUntil, Date.now())
    await ctx.db.delete(pending._id)
    await deletePasswordResets(ctx, args.authId)
    return null
  },
})
