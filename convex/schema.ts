import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  products: defineTable({
    title: v.string(),
    imageId: v.string(),
    price: v.number(),
  }),
  todos: defineTable({
    text: v.string(),
    completed: v.boolean(),
  }),
  users: defineTable({
    authId: v.string(),
    username: v.string(),
    usernameKey: v.string(),
    name: v.string(),
    avatarStorageId: v.optional(v.id('_storage')),
    visibility: v.union(
      v.literal('private'),
      v.literal('followers'),
      v.literal('public'),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_auth_id', ['authId'])
    .index('by_username_key', ['usernameKey']),
  passwordResets: defineTable({
    authId: v.string(),
    tokenKey: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index('by_auth_id', ['authId'])
    .index('by_token_key', ['tokenKey'])
    .index('by_expires_at', ['expiresAt']),
  authRateLimits: defineTable({
    key: v.string(),
    count: v.number(),
    lastRequest: v.number(),
  })
    .index('by_key', ['key'])
    .index('by_last_request', ['lastRequest']),
  otpSendLimits: defineTable({
    key: v.string(),
    claimId: v.string(),
    nextAllowedAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_key', ['key'])
    .index('by_next_allowed_at', ['nextAllowedAt']),
  pendingOauthSignups: defineTable({
    authId: v.string(),
    providerId: v.optional(v.string()),
    providerAccountId: v.optional(v.string()),
    email: v.string(),
    state: v.union(v.literal('provisional'), v.literal('oauth')),
    suggestedUsername: v.optional(v.string()),
    lastSessionExpiresAt: v.optional(v.number()),
    cleanupAfter: v.number(),
    cleanupLeaseUntil: v.optional(v.number()),
    cleanupPhase: v.optional(v.literal('deleting')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_auth_id', ['authId'])
    .index('by_provider_account', ['providerId', 'providerAccountId'])
    .index('by_cleanup_after', ['cleanupAfter']),
})
