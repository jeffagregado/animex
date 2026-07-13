import { ConvexError, type Infer, v } from 'convex/values'

import { authComponent } from './auth'
import { internal } from './_generated/api'
import { type Doc, type Id } from './_generated/dataModel'
import {
  action,
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
  query,
} from './_generated/server'
import { fetchProviderAvatar, storeAvatarForProfile } from './avatarImport'
import { logSafeFailure } from './authFailureLog'
import { completePendingProfile } from './oauthLifecycle'

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
  avatarStorageId: v.optional(v.id('_storage')),
  visibility: visibilityValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
})

const authStateValidator = v.union(
  v.object({ status: v.literal('signedOut') }),
  v.object({
    status: v.literal('emailUnverified'),
    email: v.string(),
  }),
  v.object({
    status: v.literal('needsProfile'),
    email: v.string(),
    signupMethod: v.union(v.literal('password'), v.literal('oauth')),
    suggestedUsername: v.union(v.string(), v.null()),
  }),
  v.object({
    status: v.literal('complete'),
    email: v.string(),
    profile: v.object({
      id: v.string(),
      username: v.string(),
      name: v.string(),
      avatarUrl: v.union(v.string(), v.null()),
      visibility: visibilityValidator,
    }),
  }),
)
type AuthState = Infer<typeof authStateValidator>
type PendingOauthSignup = Doc<'pendingOauthSignups'>

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

export const hasProfile = internalQuery({
  args: { authId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => Boolean(await readProfileByAuthId(ctx, args.authId)),
})

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

/** Resolves optional viewer profile without requiring authentication. */
export const getOptionalProfile = async (ctx: UserCtx) => {
  const authUser = await authComponent.safeGetAuthUser(ctx)
  if (!authUser) return null
  return await readProfileByAuthId(ctx, authUser._id)
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

const readPendingOauthSignup = async (
  ctx: UserCtx,
  authId: string,
): Promise<PendingOauthSignup | null> => await ctx.db
  .query('pendingOauthSignups')
  .withIndex('by_auth_id', (q) => q.eq('authId', authId))
  .unique()

const buildNeedsProfileState = async (
  ctx: UserCtx,
  authUser: { email: string; _id: string },
): Promise<Extract<AuthState, { status: 'needsProfile' }>> => {
  const pending = await readPendingOauthSignup(ctx, authUser._id)
  return {
    status: 'needsProfile',
    email: authUser.email,
    signupMethod: pending ? 'oauth' : 'password',
    suggestedUsername: pending?.suggestedUsername ?? null,
  }
}

const buildCompleteProfileState = async (
  ctx: UserCtx,
  authUser: { email: string },
  profile: Doc<'users'>,
): Promise<Extract<AuthState, { status: 'complete' }>> => {
  const avatarUrl = profile.avatarStorageId
    ? await ctx.storage.getUrl(profile.avatarStorageId)
    : null
  return {
    status: 'complete',
    email: authUser.email,
    profile: {
      id: profile._id,
      username: profile.username,
      name: profile.name,
      avatarUrl,
      visibility: profile.visibility,
    },
  }
}

export const getAuthState = query({
  args: {},
  returns: authStateValidator,
  handler: async (ctx): Promise<AuthState> => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser) {
      return {
        status: 'signedOut' as const,
      }
    }

    if (!authUser.emailVerified) {
      return {
        status: 'emailUnverified' as const,
        email: authUser.email,
      }
    }

    const profile = await readProfileByAuthId(ctx, authUser._id)
    if (!profile) {
      return await buildNeedsProfileState(ctx, authUser)
    }

    return await buildCompleteProfileState(ctx, authUser, profile)
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

export const prepareProfileCompletion = internalQuery({
  args: {},
  returns: v.object({
    existingProfileId: v.union(v.id('users'), v.null()),
    providerImage: v.union(v.string(), v.null()),
  }),
  handler: async (ctx): Promise<{
    existingProfileId: Id<'users'> | null
    providerImage: string | null
  }> => {
    const authUser = await requireVerifiedUser(ctx)
    const profile = await readProfileByAuthId(ctx, authUser._id)
    const pending = await readPendingOauthSignup(ctx, authUser._id)
    return {
      existingProfileId: profile?._id ?? null,
      providerImage: getProviderImage(pending, authUser.image),
    }
  },
})

const getProviderImage = (
  pending: PendingOauthSignup | null,
  image: unknown,
): string | null => {
  if (!pending || typeof image !== 'string') return null
  return image
}

const hasActivePendingCleanup = (
  pending: PendingOauthSignup,
  now: number,
): boolean => {
  if (pending.cleanupPhase === 'deleting') return true
  return Boolean(pending.cleanupLeaseUntil && pending.cleanupLeaseUntil > now)
}

const assertPendingProfileState = (
  pending: PendingOauthSignup | null,
  email: string,
  now: number,
): void => {
  if (!pending) return
  if (hasActivePendingCleanup(pending, now)) {
    throw new ConvexError({
      code: 'OAUTH_CLEANUP_ACTIVE',
      message: 'Google sign-in cleanup is active. Sign in again and retry.',
    })
  }
  if (pending.email !== email.toLowerCase()) {
    throw new ConvexError({
      code: 'OAUTH_IDENTITY_MISMATCH',
      message: 'Google identity email no longer matches this session.',
    })
  }
}

export const completeProfileInternal = internalMutation({
  args: {
    avatarStorageId: v.optional(v.id('_storage')),
    username: v.string(),
  },
  returns: v.id('users'),
  handler: async (ctx, args) => {
    const authUser = await requireVerifiedUser(ctx)
    const username = requireProfileUsername(args.username)
    const existingProfile = await readProfileByAuthId(ctx, authUser._id)
    if (existingProfile) {
      throw new ConvexError({
        code: 'PROFILE_ALREADY_COMPLETED',
        message: 'Profile was completed by another request.',
      })
    }
    const now = Date.now()
    const pending = await readPendingOauthSignup(ctx, authUser._id)
    assertPendingProfileState(pending, authUser.email, now)

    return await completePendingProfile({
      insert: async () => {
        await assertUsernameAvailable(ctx, username, authUser._id)
        const profileId = await ctx.db.insert('users', {
          authId: authUser._id,
          avatarStorageId: args.avatarStorageId,
          createdAt: now,
          name: username,
          updatedAt: now,
          username,
          usernameKey: toUsernameKey(username),
          visibility: 'private',
        })
        return profileId
      },
      removePending: async () => {
        if (pending) await ctx.db.delete(pending._id)
      },
    })
  },
})

export const completeProfile = action({
  args: { username: v.string() },
  returns: v.id('users'),
  handler: async (ctx, args): Promise<Id<'users'>> => {
    const prepared = await ctx.runQuery(internal.users.prepareProfileCompletion, {})
    if (prepared.existingProfileId) return prepared.existingProfileId

    const providerAvatar = await importProviderAvatar(prepared.providerImage)

    if (!providerAvatar) {
      return await ctx.runMutation(internal.users.completeProfileInternal, {
        username: args.username,
      })
    }

    return await storeAvatarForProfile<Id<'_storage'>, Id<'users'>>({
      blob: providerAvatar,
      complete: async (avatarStorageId) => await ctx.runMutation(
        internal.users.completeProfileInternal,
        { avatarStorageId, username: args.username },
      ),
      remove: async (avatarStorageId) => await ctx.storage.delete(avatarStorageId),
      store: async (blob) => await ctx.storage.store(blob),
    })
  },
})

const importProviderAvatar = async (image: string | null): Promise<Blob | null> => {
  if (!image) return null
  try {
    return await fetchProviderAvatar(fetch, image, 5_000, 5 * 1024 * 1024)
  } catch (error) {
    logSafeFailure(
      'Google avatar import failed; initials avatar will be used.',
      error,
      console.warn,
    )
    return null
  }
}
