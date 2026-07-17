import {
  makeFunctionReference,
  paginationResultValidator,
  type PaginationResult,
} from 'convex/server'
import { ConvexError, v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import {
  fetchProfileMedia,
  type ProfileMediaKind,
  validateProfileMedia,
} from './profileMediaPolicy'
import { requireProfile } from './users'

const PENDING_LIFETIME_MS = 60 * 60 * 1000
const CLEANUP_PAGE_SIZE = 50
const kindValidator = v.union(v.literal('avatar'), v.literal('banner'))
const uploadValidator = v.object({
  _id: v.id('profileMediaUploads'),
  _creationTime: v.number(),
  userId: v.id('users'),
  kind: kindValidator,
  storageId: v.id('_storage'),
  expiresAt: v.number(),
  createdAt: v.number(),
})
const uploadPageValidator = paginationResultValidator(uploadValidator)

type PrepareArgs = { kind: ProfileMediaKind; storageId: Id<'_storage'> }
type PrepareResult = {
  oldStorageId: Id<'_storage'> | null
  url: string
}
type CommitResult = { oldStorageId: Id<'_storage'> | null }
type CleanupArgs = PrepareArgs
type ExpiredPageArgs = { cursor: string | null; now: number }
type CleanupExpiredArgs = ExpiredPageArgs
type CleanupExpiredCandidateArgs = {
  uploadId: Id<'profileMediaUploads'>
  now: number
}

const prepareRef = makeFunctionReference<'query', PrepareArgs, PrepareResult>(
  'profileMedia:prepareFinalize',
)
const commitRef = makeFunctionReference<'mutation', PrepareArgs, CommitResult>(
  'profileMedia:commitFinalize',
)
const cleanupCandidateRef = makeFunctionReference<'mutation', CleanupArgs, null>(
  'profileMedia:cleanupCandidate',
)
const deleteUnclaimedRef = makeFunctionReference<
  'mutation',
  { storageId: Id<'_storage'> },
  null
>('profileMedia:deleteUnclaimed')
const listExpiredRef = makeFunctionReference<
  'query',
  ExpiredPageArgs,
  PaginationResult<Doc<'profileMediaUploads'>>
>('profileMedia:listExpired')
const cleanupExpiredCandidateRef = makeFunctionReference<
  'mutation',
  CleanupExpiredCandidateArgs,
  null
>('profileMedia:cleanupExpiredCandidate')
const cleanupExpiredRef = makeFunctionReference<
  'action',
  CleanupExpiredArgs,
  null
>('profileMedia:cleanupExpired')

const fail = (code: string, message: string): never => {
  throw new ConvexError({ code, message })
}

const currentStorageId = (
  profile: Doc<'users'>,
  kind: ProfileMediaKind,
): Id<'_storage'> | null => (
  kind === 'avatar'
    ? profile.avatarStorageId ?? null
    : profile.bannerStorageId ?? null
)

const readClaims = async (
  ctx: MutationCtx,
  storageId: Id<'_storage'>,
): Promise<boolean> => {
  const [avatar, banner, pending] = await Promise.all([
    ctx.db.query('users')
      .withIndex('by_avatar_storage_id', (q) => q.eq('avatarStorageId', storageId))
      .take(1),
    ctx.db.query('users')
      .withIndex('by_banner_storage_id', (q) => q.eq('bannerStorageId', storageId))
      .take(1),
    ctx.db.query('profileMediaUploads')
      .withIndex('by_storage', (q) => q.eq('storageId', storageId))
      .take(1),
  ])
  return avatar.length > 0 || banner.length > 0 || pending.length > 0
}

/** Deletes storage only after all reference and pending claims are absent. */
const deleteIfUnclaimed = async (
  ctx: MutationCtx,
  storageId: Id<'_storage'>,
): Promise<void> => {
  if (await readClaims(ctx, storageId)) return
  if (await ctx.db.system.get('_storage', storageId)) {
    await ctx.storage.delete(storageId)
  }
}

const findPending = async (
  ctx: Pick<QueryCtx, 'db'>,
  storageId: Id<'_storage'>,
): Promise<Doc<'profileMediaUploads'> | null> => {
  const rows = await ctx.db.query('profileMediaUploads')
    .withIndex('by_storage', (q) => q.eq('storageId', storageId))
    .take(2)
  if (rows.length > 1) {
    return fail('PROFILE_MEDIA_STATE_CORRUPT', 'Profile media has duplicate pending claims.')
  }
  return rows[0] ?? null
}

const assertAvailable = async (
  ctx: MutationCtx,
  storageId: Id<'_storage'>,
): Promise<void> => {
  if (await readClaims(ctx, storageId)) {
    return fail('PROFILE_MEDIA_ALREADY_CLAIMED', 'Profile media storage is already claimed.')
  }
}

const assertPendingAccess = (
  upload: Doc<'profileMediaUploads'> | null,
  userId: Id<'users'>,
  kind: ProfileMediaKind,
  now: number,
): Doc<'profileMediaUploads'> => {
  if (!upload) return fail('PROFILE_MEDIA_NOT_REGISTERED', 'Profile media upload is not registered.')
  if (upload.userId !== userId) {
    return fail('PROFILE_MEDIA_FORBIDDEN', 'Profile media upload belongs to another user.')
  }
  if (upload.kind !== kind) {
    return fail('PROFILE_MEDIA_PURPOSE_MISMATCH', 'Profile media upload purpose does not match.')
  }
  if (upload.expiresAt <= now) {
    return fail('PROFILE_MEDIA_EXPIRED', 'Profile media upload registration expired.')
  }
  return upload
}

const errorCode = (error: unknown): string => {
  if (error instanceof ConvexError) {
    const data = error.data as { code?: unknown }
    if (typeof data.code === 'string') return data.code
  }
  if (error instanceof Error && error.message.startsWith('PROFILE_MEDIA_INVALID')) {
    return 'PROFILE_MEDIA_INVALID'
  }
  return 'PROFILE_MEDIA_FETCH_FAILED'
}

const explicitFailure = (error: unknown): ConvexError<{ code: string; message: string }> => {
  if (error instanceof ConvexError) return error as ConvexError<{ code: string; message: string }>
  const code = errorCode(error)
  const message = code === 'PROFILE_MEDIA_INVALID'
    ? 'Profile media must be a valid static WebP with exact dimensions.'
    : 'Profile media could not be fetched after three attempts.'
  return new ConvexError({ code, message })
}

export const generateUploadUrl = mutation({
  args: { kind: kindValidator },
  returns: v.string(),
  handler: async (ctx) => {
    await requireProfile(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

export const registerPending = mutation({
  args: { kind: kindValidator, storageId: v.id('_storage') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    if (!await ctx.db.system.get('_storage', args.storageId)) {
      return fail('PROFILE_MEDIA_NOT_FOUND', 'Uploaded Profile media was not found.')
    }
    await assertAvailable(ctx, args.storageId)
    const now = Date.now()
    await ctx.db.insert('profileMediaUploads', {
      userId: profile._id,
      kind: args.kind,
      storageId: args.storageId,
      expiresAt: now + PENDING_LIFETIME_MS,
      createdAt: now,
    })
    return null
  },
})

export const prepareFinalize = internalQuery({
  args: { kind: kindValidator, storageId: v.id('_storage') },
  returns: v.object({
    oldStorageId: v.union(v.id('_storage'), v.null()),
    url: v.string(),
  }),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    const upload = await findPending(ctx, args.storageId)
    assertPendingAccess(upload, profile._id, args.kind, Date.now())
    const url = await ctx.storage.getUrl(args.storageId)
    if (!url) return fail('PROFILE_MEDIA_NOT_FOUND', 'Uploaded Profile media was not found.')
    return { oldStorageId: currentStorageId(profile, args.kind), url }
  },
})

export const commitFinalize = internalMutation({
  args: { kind: kindValidator, storageId: v.id('_storage') },
  returns: v.object({ oldStorageId: v.union(v.id('_storage'), v.null()) }),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    const upload = assertPendingAccess(
      await findPending(ctx, args.storageId),
      profile._id,
      args.kind,
      Date.now(),
    )
    const [avatar, banner] = await Promise.all([
      ctx.db.query('users')
        .withIndex('by_avatar_storage_id', (q) => q.eq('avatarStorageId', args.storageId))
        .take(1),
      ctx.db.query('users')
        .withIndex('by_banner_storage_id', (q) => q.eq('bannerStorageId', args.storageId))
        .take(1),
    ])
    if (avatar.length > 0 || banner.length > 0) {
      return fail('PROFILE_MEDIA_ALREADY_CLAIMED', 'Profile media storage is already claimed.')
    }
    const oldStorageId = currentStorageId(profile, args.kind)
    await ctx.db.patch('users', profile._id, {
      [args.kind === 'avatar' ? 'avatarStorageId' : 'bannerStorageId']: args.storageId,
      updatedAt: Date.now(),
    })
    await ctx.db.delete('profileMediaUploads', upload._id)
    return { oldStorageId }
  },
})

export const cleanupCandidate = internalMutation({
  args: { kind: kindValidator, storageId: v.id('_storage') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    const upload = await findPending(ctx, args.storageId)
    if (upload?.userId !== profile._id || upload.kind !== args.kind) return null
    await ctx.db.delete('profileMediaUploads', upload._id)
    await deleteIfUnclaimed(ctx, args.storageId)
    return null
  },
})

export const deleteUnclaimed = internalMutation({
  args: { storageId: v.id('_storage') },
  returns: v.null(),
  handler: async (ctx, args) => {
    await deleteIfUnclaimed(ctx, args.storageId)
    return null
  },
})

export const finalize = action({
  args: { kind: kindValidator, storageId: v.id('_storage') },
  returns: v.null(),
  handler: async (ctx, args) => {
    let committed: CommitResult
    try {
      const prepared = await ctx.runQuery(prepareRef, args)
      const bytes = await fetchProfileMedia(
        fetch,
        prepared.url,
        async (delayMs) => await new Promise((resolve) => setTimeout(resolve, delayMs)),
        (message) => console.warn(message),
      )
      validateProfileMedia(bytes, args.kind)
      committed = await ctx.runMutation(commitRef, args)
    } catch (error) {
      const original = explicitFailure(error)
      try {
        await ctx.runMutation(cleanupCandidateRef, args)
      } catch {
        throw new ConvexError({
          code: 'PROFILE_MEDIA_CLEANUP_FAILED',
          message: 'Profile media cleanup failed after finalization failed.',
          originalCode: errorCode(original),
        })
      }
      throw original
    }

    if (committed.oldStorageId && committed.oldStorageId !== args.storageId) {
      await ctx.runMutation(deleteUnclaimedRef, { storageId: committed.oldStorageId })
    }
    return null
  },
})

export const remove = mutation({
  args: { kind: kindValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    const storageId = currentStorageId(profile, args.kind)
    if (!storageId) return null
    await ctx.db.patch('users', profile._id, {
      [args.kind === 'avatar' ? 'avatarStorageId' : 'bannerStorageId']: undefined,
      updatedAt: Date.now(),
    })
    await deleteIfUnclaimed(ctx, storageId)
    return null
  },
})

export const listExpired = internalQuery({
  args: { cursor: v.union(v.string(), v.null()), now: v.number() },
  returns: uploadPageValidator,
  handler: async (ctx, args) => await ctx.db.query('profileMediaUploads')
    .withIndex('by_expiry', (q) => q.lte('expiresAt', args.now))
    .paginate({ cursor: args.cursor, numItems: CLEANUP_PAGE_SIZE }),
})

export const cleanupExpiredCandidate = internalMutation({
  args: { uploadId: v.id('profileMediaUploads'), now: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const upload = await ctx.db.get('profileMediaUploads', args.uploadId)
    if (!upload || upload.expiresAt > args.now) return null
    await ctx.db.delete('profileMediaUploads', upload._id)
    await deleteIfUnclaimed(ctx, upload.storageId)
    return null
  },
})

export const cleanupExpired = internalAction({
  args: { cursor: v.union(v.string(), v.null()), now: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.runQuery(listExpiredRef, args)
    for (const upload of page.page) {
      await ctx.runMutation(cleanupExpiredCandidateRef, {
        uploadId: upload._id,
        now: args.now,
      })
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, cleanupExpiredRef, {
        cursor: page.continueCursor,
        now: args.now,
      })
    }
    return null
  },
})

export const runDailyCleanup = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.runAction(cleanupExpiredRef, { cursor: null, now: Date.now() })
    return null
  },
})
