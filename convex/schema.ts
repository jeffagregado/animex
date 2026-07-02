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
    avatar: v.optional(v.string()),
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
    .index('by_token_key', ['tokenKey']),
})
