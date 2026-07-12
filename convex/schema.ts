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
  animeSummaries: defineTable({
    anilistId: v.number(),
    slug: v.string(),
    titles: v.object({
      display: v.string(),
      english: v.union(v.string(), v.null()),
      romaji: v.union(v.string(), v.null()),
      native: v.union(v.string(), v.null()),
    }),
    coverImageUrl: v.union(v.string(), v.null()),
    bannerImageUrl: v.union(v.string(), v.null()),
    format: v.union(
      v.literal('TV'),
      v.literal('TV_SHORT'),
      v.literal('MOVIE'),
      v.literal('SPECIAL'),
      v.literal('OVA'),
      v.literal('ONA'),
      v.literal('MUSIC'),
      v.null(),
    ),
    season: v.union(
      v.literal('WINTER'),
      v.literal('SPRING'),
      v.literal('SUMMER'),
      v.literal('FALL'),
      v.null(),
    ),
    seasonYear: v.union(v.number(), v.null()),
    episodes: v.union(v.number(), v.null()),
    genres: v.array(v.string()),
    popularity: v.number(),
    averageScore: v.union(v.number(), v.null()),
    trending: v.union(v.number(), v.null()),
    startDate: v.union(
      v.object({
        year: v.union(v.number(), v.null()),
        month: v.union(v.number(), v.null()),
        day: v.union(v.number(), v.null()),
      }),
      v.null(),
    ),
    nextAiringAt: v.union(v.number(), v.null()),
    updatedAt: v.number(),
  }).index('by_anilist_id', ['anilistId']),
  discoverSectionCache: defineTable({
    key: v.union(
      v.literal('trending'),
      v.literal('seasonal'),
      v.literal('recommendations'),
      v.literal('upcoming'),
    ),
    animeIds: v.array(v.number()),
    refreshedAt: v.number(),
    expiresAt: v.number(),
  }).index('by_key', ['key']),
  discoverCacheLeases: defineTable({
    key: v.union(
      v.literal('trending'),
      v.literal('seasonal'),
      v.literal('recommendations'),
      v.literal('upcoming'),
    ),
    leaseId: v.string(),
    leaseUntil: v.number(),
    updatedAt: v.number(),
  }).index('by_key', ['key']),
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
