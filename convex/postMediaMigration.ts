import { paginationOptsValidator, type PaginationOptions } from 'convex/server'
import { v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from './_generated/server'

const targetValidator = v.union(v.literal('posts'), v.literal('postImages'), v.literal('feedCards'))
const inspectionResultValidator = v.object({
  continueCursor: v.string(), isDone: v.boolean(), processedCount: v.number(),
  legacyPostIds: v.array(v.id('posts')), postImageIds: v.array(v.id('postImages')),
  orphanPostFeedCardIds: v.array(v.id('feedCards')),
})
const migrationResultValidator = v.object({
  continueCursor: v.string(), isDone: v.boolean(), processedCount: v.number(),
  deletedPostCount: v.number(), preservedPostCount: v.number(), deletedImageCount: v.number(),
  deletedFeedCardCount: v.number(), deletedStorageCount: v.number(),
})

type InspectionTarget = 'posts' | 'postImages' | 'feedCards'
type InspectionArgs = { target: InspectionTarget; paginationOpts: PaginationOptions }
type InspectionResult = {
  continueCursor: string
  isDone: boolean
  processedCount: number
  legacyPostIds: Id<'posts'>[]
  postImageIds: Id<'postImages'>[]
  orphanPostFeedCardIds: Id<'feedCards'>[]
}
type MigrationCounts = {
  deletedPostCount: number
  preservedPostCount: number
  deletedImageCount: number
  deletedFeedCardCount: number
  deletedStorageCount: number
}
type MigrationTarget = 'posts' | 'postImages' | 'feedCards'
type MigrationArgs = { target: MigrationTarget; paginationOpts: PaginationOptions }
type MigrationResult = MigrationCounts & { continueCursor: string; isDone: boolean; processedCount: number }

const emptyInspection = (continueCursor: string, isDone: boolean, processedCount: number): InspectionResult => ({
  continueCursor, isDone, processedCount, legacyPostIds: [], postImageIds: [], orphanPostFeedCardIds: [],
})

// A Post card is orphaned when its source is absent or its source identity is corrupt.
const isOrphanPostCard = async (ctx: QueryCtx, card: Doc<'feedCards'>): Promise<boolean> => {
  if (!card.sourceId) return true
  const postId = ctx.db.normalizeId('posts', card.sourceId)
  if (!postId) return true
  const post = await ctx.db.get('posts', postId)
  return !post
    || card.sourceKey !== `post:${post._id}`
    || card.sourceId !== post._id
    || card.userId !== post.userId
    || card.visibility !== post.visibility
}

// Read one indexed page so operators can inspect or verify without table scans.
const inspectPage = async (ctx: QueryCtx, args: InspectionArgs): Promise<InspectionResult> => {
  if (args.target === 'posts') {
    const page = await ctx.db.query('posts').withIndex('by_created_at').paginate(args.paginationOpts)
    return {
      ...emptyInspection(page.continueCursor, page.isDone, page.page.length),
      legacyPostIds: page.page.filter((post) => (post.imageIds?.length ?? 0) > 0).map((post) => post._id),
    }
  }
  if (args.target === 'postImages') {
    const page = await ctx.db.query('postImages').withIndex('by_created_at').paginate(args.paginationOpts)
    return {
      ...emptyInspection(page.continueCursor, page.isDone, page.page.length),
      postImageIds: page.page.map((image) => image._id),
    }
  }
  const page = await ctx.db.query('feedCards')
    .withIndex('by_kind_source', (query) => query.eq('kind', 'post'))
    .paginate(args.paginationOpts)
  const orphanPostFeedCardIds: Id<'feedCards'>[] = []
  for (const card of page.page) if (await isOrphanPostCard(ctx, card)) orphanPostFeedCardIds.push(card._id)
  return {
    ...emptyInspection(page.continueCursor, page.isDone, page.page.length),
    orphanPostFeedCardIds,
  }
}

export const inspectLegacyPostMedia = internalQuery({
  args: { target: targetValidator, paginationOpts: paginationOptsValidator },
  returns: inspectionResultValidator,
  handler: inspectPage,
})

export const verifyLegacyPostMedia = internalQuery({
  args: { target: targetValidator, paginationOpts: paginationOptsValidator },
  returns: inspectionResultValidator,
  handler: inspectPage,
})

// Storage references on attached legacy images must exist before destructive cleanup.
const requireLegacyStorage = async (ctx: MutationCtx, image: Doc<'postImages'>): Promise<Id<'_storage'>> => {
  if (!image.storageId) throw new Error(`Legacy Post image ${image._id} has no storage reference.`)
  if (!await ctx.db.system.get('_storage', image.storageId)) {
    throw new Error(`Legacy Post storage object is missing for image ${image._id}.`)
  }
  return image.storageId
}

// Validate all sources before deleting a legacy image Post.
const readLegacyImages = async (
  ctx: MutationCtx,
  post: Doc<'posts'>,
  imageIds: Id<'postImages'>[],
): Promise<Array<{ image: Doc<'postImages'>; storageId: Id<'_storage'> }>> => {
  const images: Array<{ image: Doc<'postImages'>; storageId: Id<'_storage'> }> = []
  for (const imageId of imageIds) {
    const image = await ctx.db.get('postImages', imageId)
    if (!image) throw new Error(`Legacy Post image source is missing for Post ${post._id}: ${imageId}.`)
    if (image.state !== 'attached' || image.postId !== post._id || image.ownerId !== post.userId) {
      throw new Error(`Legacy Post image source is invalid for Post ${post._id}: ${imageId}.`)
    }
    images.push({ image, storageId: await requireLegacyStorage(ctx, image) })
  }
  return images
}

// Delete one validated legacy Post and its owned projection/image/storage records.
const deleteLegacyPost = async (ctx: MutationCtx, post: Doc<'posts'>, counts: MigrationCounts): Promise<void> => {
  const imageIds = post.imageIds ?? []
  const images = await readLegacyImages(ctx, post, imageIds)
  const card = await ctx.db.query('feedCards')
    .withIndex('by_source_key', (query) => query.eq('sourceKey', `post:${post._id}`))
    .unique()
  if (card && (card.kind !== 'post' || card.sourceId !== post._id || card.userId !== post.userId)) {
    throw new Error(`Legacy Post feed projection is invalid for Post ${post._id}.`)
  }
  for (const { image, storageId } of images) {
    await ctx.storage.delete(storageId)
    await ctx.db.delete('postImages', image._id)
    counts.deletedStorageCount += 1
    counts.deletedImageCount += 1
  }
  if (card) {
    await ctx.db.delete('feedCards', card._id)
    counts.deletedFeedCardCount += 1
  }
  await ctx.db.delete('posts', post._id)
  counts.deletedPostCount += 1
}

// Remove one pending/orphan legacy image after Post cleanup has completed.
const deleteOrphanImage = async (ctx: MutationCtx, image: Doc<'postImages'>, counts: MigrationCounts): Promise<void> => {
  if (image.postId) {
    const post = await ctx.db.get('posts', image.postId)
    if (post && (post.imageIds ?? []).includes(image._id)) {
      throw new Error(`Legacy Post ${post._id} must be migrated before orphan image ${image._id}.`)
    }
  }
  if (image.storageId) {
    if (!await ctx.db.system.get('_storage', image.storageId)) {
      throw new Error(`Legacy Post storage object is missing for image ${image._id}.`)
    }
    await ctx.storage.delete(image.storageId)
    counts.deletedStorageCount += 1
  } else if (image.state === 'attached') {
    throw new Error(`Attached legacy Post image ${image._id} has no storage reference.`)
  }
  await ctx.db.delete('postImages', image._id)
  counts.deletedImageCount += 1
}

const createCounts = (): MigrationCounts => ({
  deletedPostCount: 0, preservedPostCount: 0, deletedImageCount: 0,
  deletedFeedCardCount: 0, deletedStorageCount: 0,
})

const createMigrationResult = (
  continueCursor: string,
  isDone: boolean,
  processedCount: number,
  counts: MigrationCounts,
): MigrationResult => ({ continueCursor, isDone, processedCount, ...counts })

// Process one indexed Posts page.
const migratePostPage = async (ctx: MutationCtx, paginationOpts: PaginationOptions): Promise<MigrationResult> => {
  const counts = createCounts()
  const page = await ctx.db.query('posts').withIndex('by_created_at').paginate(paginationOpts)
  for (const post of page.page) {
    if ((post.imageIds?.length ?? 0) > 0) await deleteLegacyPost(ctx, post, counts)
    else {
      if (post.media === undefined) await ctx.db.patch('posts', post._id, { media: null })
      counts.preservedPostCount += 1
    }
  }
  return createMigrationResult(page.continueCursor, page.isDone, page.page.length, counts)
}

// Process one indexed orphan-image page.
const migrateImagePage = async (ctx: MutationCtx, paginationOpts: PaginationOptions): Promise<MigrationResult> => {
  const counts = createCounts()
  const page = await ctx.db.query('postImages').withIndex('by_created_at').paginate(paginationOpts)
  for (const image of page.page) await deleteOrphanImage(ctx, image, counts)
  return createMigrationResult(page.continueCursor, page.isDone, page.page.length, counts)
}

// Process one indexed orphan-projection page.
const migrateFeedCardPage = async (ctx: MutationCtx, paginationOpts: PaginationOptions): Promise<MigrationResult> => {
  const counts = createCounts()
  const page = await ctx.db.query('feedCards')
    .withIndex('by_kind_source', (query) => query.eq('kind', 'post'))
    .paginate(paginationOpts)
  for (const card of page.page) {
    if (await isOrphanPostCard(ctx, card)) {
      await ctx.db.delete('feedCards', card._id)
      counts.deletedFeedCardCount += 1
    }
  }
  return createMigrationResult(page.continueCursor, page.isDone, page.page.length, counts)
}

const migratePage = async (ctx: MutationCtx, args: MigrationArgs): Promise<MigrationResult> => {
  if (args.target === 'posts') return await migratePostPage(ctx, args.paginationOpts)
  if (args.target === 'postImages') return await migrateImagePage(ctx, args.paginationOpts)
  return await migrateFeedCardPage(ctx, args.paginationOpts)
}

export const migrateLegacyPostMedia = internalMutation({
  args: { target: targetValidator, paginationOpts: paginationOptsValidator },
  returns: migrationResultValidator,
  handler: migratePage,
})
