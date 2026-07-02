import { ConvexError, v } from 'convex/values'

import { authComponent } from './auth'
import {
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from './_generated/server'

const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/

type UserCtx = QueryCtx | MutationCtx

type UsernameRule = {
  invalid: (username: string) => boolean
  message: string
}

const usernameRules: UsernameRule[] = [
  {
    invalid: (username) => username.length < 3 || username.length > 30,
    message: 'Username must be 3-30 characters.',
  },
  {
    invalid: (username) => !USERNAME_PATTERN.test(username),
    message: 'Use letters, numbers, and underscores only.',
  },
  {
    invalid: (username) => username.startsWith('_') || username.endsWith('_'),
    message: 'Username cannot start or end with underscore.',
  },
]

const visibilityValidator = v.union(
  v.literal('private'),
  v.literal('followers'),
  v.literal('public'),
)

const userValidator = v.object({
  _id: v.id('users'),
  _creationTime: v.number(),
  authId: v.string(),
  username: v.string(),
  usernameKey: v.string(),
  name: v.string(),
  avatar: v.optional(v.string()),
  visibility: visibilityValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
})

const authStateValidator = v.object({
  status: v.union(
    v.literal('signedOut'),
    v.literal('emailUnverified'),
    v.literal('needsProfile'),
    v.literal('complete'),
  ),
  email: v.union(v.string(), v.null()),
  emailVerified: v.boolean(),
  profile: v.union(userValidator, v.null()),
})

export const toUsernameKey = (username: string): string => username.toLowerCase()

export const validateUsername = (username: string): void => {
  const failedRule = usernameRules.find((rule) => rule.invalid(username))
  if (failedRule) {
    throw new ConvexError({
      code: 'INVALID_USERNAME',
      message: failedRule.message,
    })
  }
}

const readProfileByAuthId = async (ctx: UserCtx, authId: string) => {
  return await ctx.db
    .query('users')
    .withIndex('by_auth_id', (q) => q.eq('authId', authId))
    .unique()
}

const readProfileByUsername = async (ctx: UserCtx, username: string) => {
  return await ctx.db
    .query('users')
    .withIndex('by_username_key', (q) => q.eq('usernameKey', toUsernameKey(username)))
    .unique()
}

export const requireVerifiedUser = async (ctx: UserCtx) => {
  const authUser = await authComponent.getAuthUser(ctx)
  if (!authUser.emailVerified) {
    throw new ConvexError({
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Verify your email before continuing.',
    })
  }
  return authUser
}

export const requireProfile = async (ctx: UserCtx) => {
  const authUser = await requireVerifiedUser(ctx)
  const profile = await readProfileByAuthId(ctx, authUser._id)

  if (!profile) {
    throw new ConvexError({
      code: 'PROFILE_REQUIRED',
      message: 'Complete your profile before continuing.',
    })
  }

  return { authUser, profile }
}

const requireProfileUsername = (username: string): string => {
  validateUsername(username)
  return username
}

const assertUsernameAvailable = async (
  ctx: UserCtx,
  username: string,
  currentAuthId: string | undefined,
): Promise<void> => {
  const owner = await readProfileByUsername(ctx, username)

  if (owner && owner.authId !== currentAuthId) {
    throw new ConvexError({
      code: 'USERNAME_TAKEN',
      message: 'Username is already taken.',
    })
  }
}

const validateUsernameForCheck = (username: string) => {
  try {
    validateUsername(username)
    return { available: true, message: null }
  } catch (error) {
    if (error instanceof ConvexError) {
      return { available: false, message: error.data.message }
    }
    throw error
  }
}

const isOwnedByOtherAuthUser = (
  owner: { authId: string } | null,
  currentAuthId: string | undefined,
): boolean => Boolean(owner && owner.authId !== currentAuthId)

const insertProfile = async (
  ctx: MutationCtx,
  args: {
    authId: string
    username: string
    avatar: string | undefined
  },
) => {
  await assertUsernameAvailable(ctx, args.username, args.authId)

  const now = Date.now()
  return await ctx.db.insert('users', {
    authId: args.authId,
    username: args.username,
    usernameKey: toUsernameKey(args.username),
    name: args.username,
    avatar: args.avatar,
    visibility: 'private',
    createdAt: now,
    updatedAt: now,
  })
}

export const getAuthState = query({
  args: {},
  returns: authStateValidator,
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser) {
      return {
        status: 'signedOut' as const,
        email: null,
        emailVerified: false,
        profile: null,
      }
    }

    const profile = await readProfileByAuthId(ctx, authUser._id)
    if (!authUser.emailVerified) {
      return {
        status: 'emailUnverified' as const,
        email: authUser.email,
        emailVerified: false,
        profile,
      }
    }

    if (!profile) {
      return {
        status: 'needsProfile' as const,
        email: authUser.email,
        emailVerified: true,
        profile: null,
      }
    }

    return {
      status: 'complete' as const,
      email: authUser.email,
      emailVerified: true,
      profile,
    }
  },
})

export const getProfile = query({
  args: {},
  returns: v.union(userValidator, v.null()),
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser) {
      return null
    }

    return await readProfileByAuthId(ctx, authUser._id)
  },
})

export const checkUsername = query({
  args: { username: v.string() },
  returns: v.object({
    available: v.boolean(),
    message: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const validation = validateUsernameForCheck(args.username)
    if (!validation.available) {
      return validation
    }

    const authUser = await authComponent.safeGetAuthUser(ctx)
    const currentAuthId = authUser ? authUser._id : undefined
    const owner = await readProfileByUsername(ctx, args.username)

    if (isOwnedByOtherAuthUser(owner, currentAuthId)) {
      return {
        available: false,
        message: 'Username is already taken.',
      }
    }

    return { available: true, message: null }
  },
})

export const completeProfile = mutation({
  args: { username: v.string() },
  returns: v.id('users'),
  handler: async (ctx, args) => {
    const authUser = await requireVerifiedUser(ctx)
    const username = requireProfileUsername(args.username)
    const existingProfile = await readProfileByAuthId(ctx, authUser._id)

    if (existingProfile) {
      return existingProfile._id
    }

    return await insertProfile(ctx, {
      authId: authUser._id,
      username,
      avatar: authUser.image ?? undefined,
    })
  },
})
