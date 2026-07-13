import { ConvexError, v } from 'convex/values'

import { createPostInputSchema, updatePostInputSchema } from '../src/features/social/shared/social-contracts'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, type MutationCtx } from './_generated/server'
import { makeOrderKey } from './feedPolicy'
import { assertImageMetadata, assertRequestId, assertStoredImageMetadata, normalizePostContent } from './socialPolicy'
import { requireProfile } from './users'

const visibilityValidator = v.union(v.literal('private'), v.literal('followers'), v.literal('public'))
const postInput = {
  requestId: v.string(), text: v.string(), imageIds: v.array(v.id('postImages')),
  hasSpoiler: v.boolean(), visibility: visibilityValidator,
}

const fail = (code: string, message: string): never => { throw new ConvexError({ code, message }) }

const readOwnedPost = async (ctx: MutationCtx, postId: Id<'posts'>, userId: Id<'users'>) => {
  const post = await ctx.db.get('posts', postId)
  if (!post) return fail('POST_NOT_FOUND', 'Post not found.')
  if (post.userId !== userId) return fail('POST_FORBIDDEN', 'Only the Post owner can change it.')
  return post
}

const readOwnedImages = async (
  ctx: MutationCtx,
  imageIds: Id<'postImages'>[],
  userId: Id<'users'>,
  postId: Id<'posts'> | null,
): Promise<Doc<'postImages'>[]> => await Promise.all(imageIds.map(async (imageId) => {
  const image = await ctx.db.get('postImages', imageId)
  if (!image) return fail('IMAGE_NOT_FOUND', 'Registered Post image not found.')
  if (image.ownerId !== userId) return fail('IMAGE_FORBIDDEN', 'Post image belongs to another user.')
  if (image.state === 'attached' && image.postId !== postId) return fail('IMAGE_ATTACHED', 'Post image is already attached.')
  if (!image.storageId) return fail('IMAGE_STORAGE_MISSING', 'Post image storage object is missing.')
  return image
}))

const removeImage = async (ctx: MutationCtx, image: Doc<'postImages'>): Promise<void> => {
  if (image.storageId) await ctx.storage.delete(image.storageId)
  await ctx.db.delete('postImages', image._id)
}

const assertImageDimensions = (width: number, height: number): void => {
  if (!Number.isSafeInteger(width) || width < 1) return fail('INVALID_IMAGE_DIMENSIONS', 'Image width must be a positive integer.')
  if (!Number.isSafeInteger(height) || height < 1) return fail('INVALID_IMAGE_DIMENSIONS', 'Image height must be a positive integer.')
}

const readOpenClaim = async (ctx: MutationCtx, ownerId: Id<'users'>, claimId: string, storageId: Id<'_storage'>) => {
  const claim = await ctx.db.query('postImages').withIndex('by_owner_claim', (q) => q.eq('ownerId', ownerId).eq('claimId', claimId)).unique()
  if (!claim) return fail('IMAGE_CLAIM_REQUIRED', 'Generate an authenticated image upload claim first.')
  if (claim.storageId === storageId) return { claim, registered: true }
  if (claim.storageId) return fail('IMAGE_CLAIM_USED', 'Image upload claim is already registered.')
  return { claim, registered: false }
}

const assertStorageAvailable = async (ctx: MutationCtx, storageId: Id<'_storage'>): Promise<void> => {
  const existing = await ctx.db.query('postImages').withIndex('by_storage_id', (q) => q.eq('storageId', storageId)).unique()
  if (existing) return fail('IMAGE_ALREADY_CLAIMED', 'Storage object is already registered.')
}

const readImageMetadata = async (ctx: MutationCtx, storageId: Id<'_storage'>, expectedMime: string, expectedSize: number) => {
  const metadata = await ctx.storage.getMetadata(storageId)
  if (!metadata) return fail('IMAGE_STORAGE_MISSING', 'Uploaded storage object not found.')
  return assertStoredImageMetadata(metadata.contentType ?? null, metadata.size, expectedMime, expectedSize)
}

const discardPendingImage = async (ctx: MutationCtx, image: Doc<'postImages'>, storageId: Id<'_storage'> | undefined): Promise<void> => {
  if (image.storageId && storageId && image.storageId !== storageId) return fail('IMAGE_STORAGE_MISMATCH', 'Storage object does not match the image claim.')
  if (!image.storageId && storageId) {
    const registered = await ctx.db.query('postImages').withIndex('by_storage_id', (q) => q.eq('storageId', storageId)).unique()
    if (registered) return fail('IMAGE_ALREADY_CLAIMED', 'Storage object is already registered to an image claim.')
    await ctx.storage.delete(storageId)
  }
  await removeImage(ctx, image)
}

const upsertPostCard = async (ctx: MutationCtx, post: Doc<'posts'>, active: boolean): Promise<void> => {
  const sourceKey = `post:${post._id}`
  const existing = await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', sourceKey)).unique()
  const fields = { visibility: post.visibility, active, updatedAt: post.updatedAt }
  if (existing) {
    await ctx.db.patch('feedCards', existing._id, fields)
    return
  }
  await ctx.db.insert('feedCards', {
    sourceKey, kind: 'post', userId: post.userId, sourceId: post._id,
    ...fields, orderKey: makeOrderKey(post.createdAt, sourceKey), occurredAt: post.createdAt,
  })
}

export const generateUploadUrl = mutation({
  args: { claimId: v.string() }, returns: v.object({ imageId: v.id('postImages'), uploadUrl: v.string() }),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    const claimId = assertRequestId(args.claimId)
    const existing = await ctx.db.query('postImages').withIndex('by_owner_claim', (q) => q.eq('ownerId', profile._id).eq('claimId', claimId)).unique()
    if (existing?.storageId) return fail('IMAGE_CLAIM_USED', 'Image upload claim is already registered.')
    const now = Date.now()
    const imageId = existing?._id ?? await ctx.db.insert('postImages', {
      ownerId: profile._id, claimId, mimeType: '', size: 0, width: 0, height: 0,
      state: 'pending', createdAt: now, updatedAt: now,
    })
    return { imageId, uploadUrl: await ctx.storage.generateUploadUrl() }
  },
})

export const registerImage = mutation({
  args: { claimId: v.string(), storageId: v.id('_storage'), mimeType: v.string(), size: v.number(), width: v.number(), height: v.number() },
  returns: v.id('postImages'),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    assertImageMetadata(args.mimeType, args.size)
    assertImageDimensions(args.width, args.height)
    const claimId = assertRequestId(args.claimId)
    const { claim, registered } = await readOpenClaim(ctx, profile._id, claimId, args.storageId)
    if (registered) return claim._id
    await assertStorageAvailable(ctx, args.storageId)
    const metadata = await readImageMetadata(ctx, args.storageId, args.mimeType, args.size)
    const now = Date.now()
    await ctx.db.patch('postImages', claim._id, { storageId: args.storageId, ...metadata, width: args.width, height: args.height, updatedAt: now })
    return claim._id
  },
})

export const discardImage = mutation({
  args: { imageId: v.id('postImages'), storageId: v.optional(v.id('_storage')) }, returns: v.null(),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    const image = await ctx.db.get('postImages', args.imageId)
    if (!image) return null
    if (image.ownerId !== profile._id) return fail('IMAGE_FORBIDDEN', 'Post image belongs to another user.')
    if (image.state !== 'pending') return fail('IMAGE_ATTACHED', 'Attached Post image cannot be discarded.')
    await discardPendingImage(ctx, image, args.storageId)
    return null
  },
})

export const create = mutation({
  args: postInput, returns: v.id('posts'),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    const normalized = normalizePostContent(args.text, args.imageIds)
    createPostInputSchema.parse({ ...args, imageIds: args.imageIds.map(String) })
    const requestId = assertRequestId(args.requestId)
    const previous = await ctx.db.query('posts').withIndex('by_user_request', (q) => q.eq('userId', profile._id).eq('requestId', requestId)).unique()
    if (previous) return previous._id
    const images = await readOwnedImages(ctx, args.imageIds, profile._id, null)
    const now = Date.now()
    const postId = await ctx.db.insert('posts', { userId: profile._id, requestId, text: normalized.text, imageIds: args.imageIds, hasSpoiler: args.hasSpoiler, visibility: args.visibility, createdAt: now, updatedAt: now })
    await Promise.all(images.map((image, order) => ctx.db.patch('postImages', image._id, { state: 'attached', postId, order, updatedAt: now })))
    const post = await ctx.db.get('posts', postId)
    if (!post) return fail('POST_WRITE_FAILED', 'Post was not saved.')
    await upsertPostCard(ctx, post, true)
    return postId
  },
})

export const update = mutation({
  args: { postId: v.id('posts'), ...postInput }, returns: v.id('posts'),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    const post = await readOwnedPost(ctx, args.postId, profile._id)
    const normalized = normalizePostContent(args.text, args.imageIds)
    updatePostInputSchema.parse({ ...args, postId: String(args.postId), imageIds: args.imageIds.map(String) })
    const images = await readOwnedImages(ctx, args.imageIds, profile._id, post._id)
    const retained = new Set(args.imageIds)
    const removedIds: Id<'postImages'>[] = []
    for (const imageId of post.imageIds) if (!retained.has(imageId)) removedIds.push(imageId)
    const removed = await Promise.all(removedIds.map((id) => ctx.db.get('postImages', id)))
    await Promise.all(removed.map(async (image) => { if (image) await removeImage(ctx, image) }))
    const now = Date.now()
    await Promise.all(images.map((image, order) => ctx.db.patch('postImages', image._id, { state: 'attached', postId: post._id, order, updatedAt: now })))
    await ctx.db.patch('posts', post._id, { requestId: assertRequestId(args.requestId), text: normalized.text, imageIds: args.imageIds, hasSpoiler: args.hasSpoiler, visibility: args.visibility, updatedAt: now })
    const updated = await ctx.db.get('posts', post._id)
    if (!updated) return fail('POST_WRITE_FAILED', 'Post update failed.')
    await upsertPostCard(ctx, updated, true)
    return post._id
  },
})

export const setVisibility = mutation({
  args: { postId: v.id('posts'), visibility: visibilityValidator }, returns: v.null(),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    const post = await readOwnedPost(ctx, args.postId, profile._id)
    await ctx.db.patch('posts', post._id, { visibility: args.visibility, updatedAt: Date.now() })
    const updated = await ctx.db.get('posts', post._id)
    if (updated) await upsertPostCard(ctx, updated, true)
    return null
  },
})

export const remove = mutation({
  args: { postId: v.id('posts') }, returns: v.null(),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    const post = await readOwnedPost(ctx, args.postId, profile._id)
    const images = await Promise.all(post.imageIds.map((id) => ctx.db.get('postImages', id)))
    await Promise.all(images.map(async (image) => { if (image) await removeImage(ctx, image) }))
    const card = await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', `post:${post._id}`)).unique()
    if (card) await ctx.db.delete('feedCards', card._id)
    await ctx.db.delete('posts', post._id)
    return null
  },
})
