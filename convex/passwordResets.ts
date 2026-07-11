import { v } from 'convex/values'

import { internalMutation, type MutationCtx, mutation, type QueryCtx, query } from './_generated/server'

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000

const readByAuthId = async (ctx: MutationCtx, authId: string) => {
  return await ctx.db
    .query('passwordResets')
    .withIndex('by_auth_id', (q) => q.eq('authId', authId))
    .unique()
}

const readByTokenKey = async (
  ctx: QueryCtx | MutationCtx,
  tokenKey: string,
) => {
  return await ctx.db
    .query('passwordResets')
    .withIndex('by_token_key', (q) => q.eq('tokenKey', tokenKey))
    .unique()
}

export const mark = internalMutation({
  args: {
    authId: v.string(),
    tokenKey: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now()
    const existing = await readByAuthId(ctx, args.authId)
    const reset = {
      authId: args.authId,
      tokenKey: args.tokenKey,
      expiresAt: now + RESET_TOKEN_TTL_MS,
      createdAt: now,
    }

    if (existing) {
      await ctx.db.patch(existing._id, reset)
      return null
    }

    await ctx.db.insert('passwordResets', reset)
    return null
  },
})

export const isCurrent = query({
  args: { tokenKey: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const reset = await readByTokenKey(ctx, args.tokenKey)
    return Boolean(reset && reset.expiresAt > Date.now())
  },
})

export const clear = mutation({
  args: { tokenKey: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const reset = await readByTokenKey(ctx, args.tokenKey)
    if (!reset) {
      return null
    }

    await ctx.db.delete(reset._id)
    return null
  },
})

export const clearInternal = internalMutation({
  args: { tokenKey: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const reset = await readByTokenKey(ctx, args.tokenKey)
    if (reset) await ctx.db.delete(reset._id)
    return null
  },
})
