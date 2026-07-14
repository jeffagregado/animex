import { ConvexError, v } from 'convex/values'

import { createPostInputSchema, updatePostInputSchema } from '../src/features/social/shared/social-contracts'
import type { PostMedia } from '../src/features/social/shared/external-media'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, type MutationCtx } from './_generated/server'
import { makeOrderKey } from './feedPolicy'
import { assertRequestId, normalizePostContent } from './socialPolicy'
import { requireProfile } from './users'

const visibilityValidator = v.union(v.literal('private'), v.literal('followers'), v.literal('public'))
const postMediaValidator = v.union(
  v.object({ type: v.literal('image'), url: v.string(), description: v.union(v.string(), v.null()) }),
  v.object({
    type: v.literal('video'), url: v.string(),
    provider: v.union(v.literal('youtube'), v.literal('vimeo'), v.literal('external')),
    label: v.union(v.string(), v.null()),
  }),
)
const postInput = {
  requestId: v.string(), text: v.string(), media: v.union(postMediaValidator, v.null()),
  hasSpoiler: v.boolean(), visibility: visibilityValidator,
}

const fail = (code: string, message: string): never => { throw new ConvexError({ code, message }) }

type CreateIntent = {
  text: string
  media: PostMedia | null
  hasSpoiler: boolean
  visibility: Doc<'posts'>['visibility']
}

const mediaMatches = (left: PostMedia | null, right: PostMedia | null): boolean => JSON.stringify(left) === JSON.stringify(right)

const readMatchingCreateRequest = (post: Doc<'posts'> | null, intent: CreateIntent): Id<'posts'> | null => {
  if (!post) return null
  const differs = post.text !== intent.text
    || !mediaMatches(post.media, intent.media)
    || post.hasSpoiler !== intent.hasSpoiler
    || post.visibility !== intent.visibility
  if (differs) return fail('POST_REQUEST_COLLISION', 'Post request collision with a different create request.')
  return post._id
}

const readOwnedPost = async (ctx: MutationCtx, postId: Id<'posts'>, userId: Id<'users'>) => {
  const post = await ctx.db.get('posts', postId)
  if (!post) return fail('POST_NOT_FOUND', 'Post not found.')
  if (post.userId !== userId) return fail('POST_FORBIDDEN', 'Only the Post owner can change it.')
  return post
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

export const create = mutation({
  args: postInput, returns: v.id('posts'),
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx)
    const parsed = createPostInputSchema.parse(args)
    const normalized = normalizePostContent(parsed.text, parsed.media)
    const requestId = assertRequestId(parsed.requestId)
    const previous = await ctx.db.query('posts').withIndex('by_user_request', (q) => q.eq('userId', profile._id).eq('requestId', requestId)).unique()
    const repeatedId = readMatchingCreateRequest(previous, {
      text: normalized.text, media: normalized.media, hasSpoiler: parsed.hasSpoiler, visibility: parsed.visibility,
    })
    if (repeatedId) return repeatedId
    const now = Date.now()
    const postId = await ctx.db.insert('posts', {
      userId: profile._id, requestId, text: normalized.text, media: normalized.media,
      hasSpoiler: parsed.hasSpoiler, visibility: parsed.visibility, createdAt: now, updatedAt: now,
    })
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
    const parsed = updatePostInputSchema.parse({ ...args, postId: String(args.postId) })
    const requestId = assertRequestId(parsed.requestId)
    const requestMatches = await ctx.db.query('posts').withIndex('by_user_request', (q) => q.eq('userId', profile._id).eq('requestId', requestId)).take(2)
    if (requestMatches.length > 1 || (requestMatches[0] && requestMatches[0]._id !== post._id)) return fail('POST_REQUEST_COLLISION', 'Post request collision with another Post.')
    const normalized = normalizePostContent(parsed.text, parsed.media)
    const now = Date.now()
    await ctx.db.patch('posts', post._id, {
      requestId, text: normalized.text, media: normalized.media,
      hasSpoiler: parsed.hasSpoiler, visibility: parsed.visibility, updatedAt: now,
    })
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
    const card = await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', `post:${post._id}`)).unique()
    if (card) await ctx.db.delete('feedCards', card._id)
    await ctx.db.delete('posts', post._id)
    return null
  },
})
