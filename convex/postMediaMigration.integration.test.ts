/// <reference types="vite/client" />

import { convexTest } from 'convex-test'
import { makeFunctionReference } from 'convex/server'
import { describe, expect, test } from 'vitest'

import type { Id } from './_generated/dataModel'
import schema from './schema'

const modules = import.meta.glob(['./_generated/**/*.*', './postMediaMigration.ts'])
type Target = 'posts' | 'postImages' | 'feedCards'
type PageArgs = { target: Target; paginationOpts: { cursor: string | null; numItems: number } }
type InspectionResult = {
  continueCursor: string
  isDone: boolean
  processedCount: number
  legacyPostIds: Id<'posts'>[]
  postImageIds: Id<'postImages'>[]
  orphanPostFeedCardIds: Id<'feedCards'>[]
}
type MigrationResult = {
  continueCursor: string
  isDone: boolean
  processedCount: number
  deletedPostCount: number
  preservedPostCount: number
  deletedImageCount: number
  deletedFeedCardCount: number
  deletedStorageCount: number
}
const inspectLegacyPostMedia = makeFunctionReference<'query', PageArgs, InspectionResult>('postMediaMigration:inspectLegacyPostMedia')
const verifyLegacyPostMedia = makeFunctionReference<'query', PageArgs, InspectionResult>('postMediaMigration:verifyLegacyPostMedia')
const migrateLegacyPostMedia = makeFunctionReference<'mutation', PageArgs, MigrationResult>('postMediaMigration:migrateLegacyPostMedia')
const createHarness = () => convexTest(schema, modules)

const insertUser = async (t: ReturnType<typeof createHarness>, name: string) => await t.run(async (ctx) => await ctx.db.insert('users', {
  authId: `auth-${name}`, username: name, usernameKey: name, name,
  visibility: 'public', createdAt: Date.now(), updatedAt: Date.now(),
}))

const insertImage = async (
  t: ReturnType<typeof createHarness>,
  ownerId: Id<'users'>,
  claimId: string,
  state: 'pending' | 'attached',
  storageId: Id<'_storage'> | undefined,
) => await t.run(async (ctx) => await ctx.db.insert('postImages', {
  ownerId, claimId, storageId, mimeType: 'image/png', size: 5, width: 1, height: 1,
  state, createdAt: Date.now(), updatedAt: Date.now(),
}))

const insertPost = async (
  t: ReturnType<typeof createHarness>,
  userId: Id<'users'>,
  requestId: string,
  imageIds: Id<'postImages'>[],
) => await t.run(async (ctx) => await ctx.db.insert('posts', {
  userId, requestId, text: requestId, imageIds, hasSpoiler: false, visibility: 'public',
  createdAt: Date.now(), updatedAt: Date.now(),
}))

const runPage = async (
  t: ReturnType<typeof createHarness>,
  target: Target,
  cursor: string | null,
  numItems: number,
) => await t.mutation(migrateLegacyPostMedia, { target, paginationOpts: { cursor, numItems } })

describe('legacy Post media migration', () => {
  test('deletes only image Posts, their projection, image rows, and owned storage', async () => {
    const t = createHarness()
    const ownerId = await insertUser(t, 'migration-owner')
    const legacyStorageId = await t.run(async (ctx) => await ctx.storage.store(new Blob(['legacy'])))
    const unrelatedStorageId = await t.run(async (ctx) => await ctx.storage.store(new Blob(['unrelated'])))
    const imageId = await insertImage(t, ownerId, 'legacy', 'attached', legacyStorageId)
    const legacyPostId = await insertPost(t, ownerId, 'legacy-post', [imageId])
    await t.run(async (ctx) => await ctx.db.patch('postImages', imageId, { postId: legacyPostId, order: 0 }))
    const textPostId = await insertPost(t, ownerId, 'text-post', [])
    const [legacyCardId, unrelatedCardId] = await t.run(async (ctx) => {
      const now = Date.now()
      const legacyCard = await ctx.db.insert('feedCards', {
        sourceKey: `post:${legacyPostId}`, kind: 'post', userId: ownerId, sourceId: legacyPostId,
        visibility: 'public', active: true, orderKey: 'legacy', occurredAt: now, updatedAt: now,
      })
      const unrelatedCard = await ctx.db.insert('feedCards', {
        sourceKey: 'completed:unrelated', kind: 'completed', userId: ownerId, anilistId: 1,
        visibility: 'public', active: true, orderKey: 'unrelated', occurredAt: now, updatedAt: now,
      })
      return [legacyCard, unrelatedCard]
    })

    const result = await runPage(t, 'posts', null, 10)

    expect(result).toMatchObject({
      isDone: true, processedCount: 2, deletedPostCount: 1, preservedPostCount: 1,
      deletedImageCount: 1, deletedFeedCardCount: 1, deletedStorageCount: 1,
    })
    expect(await t.run(async (ctx) => await ctx.db.get('posts', legacyPostId))).toBeNull()
    expect(await t.run(async (ctx) => await ctx.db.get('postImages', imageId))).toBeNull()
    expect(await t.run(async (ctx) => await ctx.db.get('feedCards', legacyCardId))).toBeNull()
    expect(await t.run(async (ctx) => await ctx.storage.get(legacyStorageId))).toBeNull()
    expect(await t.run(async (ctx) => await ctx.db.get('posts', textPostId))).toMatchObject({ media: null })
    expect(await t.run(async (ctx) => await ctx.db.get('feedCards', unrelatedCardId))).not.toBeNull()
    expect(await t.run(async (ctx) => (await ctx.storage.get(unrelatedStorageId)) !== null)).toBe(true)
  })

  test('cleans pending and orphan image rows across resumable, repeatable pages', async () => {
    const t = createHarness()
    const ownerId = await insertUser(t, 'orphan-owner')
    const firstStorageId = await t.run(async (ctx) => await ctx.storage.store(new Blob(['first'])))
    const secondStorageId = await t.run(async (ctx) => await ctx.storage.store(new Blob(['second'])))
    const pendingId = await insertImage(t, ownerId, 'pending', 'pending', firstStorageId)
    const orphanId = await insertImage(t, ownerId, 'orphan', 'attached', secondStorageId)

    const first = await runPage(t, 'postImages', null, 1)
    const second = await runPage(t, 'postImages', first.continueCursor, 1)
    const repeated = await runPage(t, 'postImages', null, 10)

    expect(first).toMatchObject({ processedCount: 1, deletedImageCount: 1, deletedStorageCount: 1 })
    expect(second).toMatchObject({ isDone: true, processedCount: 1, deletedImageCount: 1, deletedStorageCount: 1 })
    expect(repeated).toMatchObject({ isDone: true, processedCount: 0, deletedImageCount: 0, deletedStorageCount: 0 })
    expect(await t.run(async (ctx) => await ctx.db.get('postImages', pendingId))).toBeNull()
    expect(await t.run(async (ctx) => await ctx.db.get('postImages', orphanId))).toBeNull()
  })

  test('fails explicitly before deleting when a legacy image source or storage object is missing', async () => {
    const missingSource = createHarness()
    const sourceOwnerId = await insertUser(missingSource, 'missing-source-owner')
    const transientImageId = await insertImage(missingSource, sourceOwnerId, 'transient', 'attached', undefined)
    await missingSource.run(async (ctx) => await ctx.db.delete('postImages', transientImageId))
    const sourcePostId = await insertPost(missingSource, sourceOwnerId, 'missing-source', [transientImageId])
    await expect(runPage(missingSource, 'posts', null, 10)).rejects.toThrow('Legacy Post image source is missing')
    expect(await missingSource.run(async (ctx) => await ctx.db.get('posts', sourcePostId))).not.toBeNull()

    const missingStorage = createHarness()
    const storageOwnerId = await insertUser(missingStorage, 'missing-storage-owner')
    const absentStorageId = await missingStorage.run(async (ctx) => await ctx.storage.store(new Blob(['gone'])))
    const absentImageId = await insertImage(missingStorage, storageOwnerId, 'absent-storage', 'attached', absentStorageId)
    const storagePostId = await insertPost(missingStorage, storageOwnerId, 'missing-storage', [absentImageId])
    await missingStorage.run(async (ctx) => {
      await ctx.db.patch('postImages', absentImageId, { postId: storagePostId, order: 0 })
      await ctx.storage.delete(absentStorageId)
    })
    await expect(runPage(missingStorage, 'posts', null, 10)).rejects.toThrow('Legacy Post storage object is missing')
    expect(await missingStorage.run(async (ctx) => await ctx.db.get('posts', storagePostId))).not.toBeNull()
  })

  test('inspects and verifies remaining legacy rows and orphan Post projections by indexed pages', async () => {
    const t = createHarness()
    const ownerId = await insertUser(t, 'verify-owner')
    const storageId = await t.run(async (ctx) => await ctx.storage.store(new Blob(['legacy'])))
    const imageId = await insertImage(t, ownerId, 'verify-image', 'attached', storageId)
    const postId = await insertPost(t, ownerId, 'verify-post', [imageId])
    const orphanCardId = await t.run(async (ctx) => await ctx.db.insert('feedCards', {
      sourceKey: 'post:missing', kind: 'post', userId: ownerId, sourceId: 'missing', visibility: 'public',
      active: true, orderKey: 'orphan', occurredAt: Date.now(), updatedAt: Date.now(),
    }))

    expect(await t.query(inspectLegacyPostMedia, {
      target: 'posts', paginationOpts: { cursor: null, numItems: 10 },
    })).toMatchObject({ legacyPostIds: [postId], postImageIds: [], orphanPostFeedCardIds: [] })
    expect(await t.query(verifyLegacyPostMedia, {
      target: 'postImages', paginationOpts: { cursor: null, numItems: 10 },
    })).toMatchObject({ legacyPostIds: [], postImageIds: [imageId], orphanPostFeedCardIds: [] })
    expect(await t.query(verifyLegacyPostMedia, {
      target: 'feedCards', paginationOpts: { cursor: null, numItems: 10 },
    })).toMatchObject({ legacyPostIds: [], postImageIds: [], orphanPostFeedCardIds: [orphanCardId] })
    expect(await runPage(t, 'feedCards', null, 10)).toMatchObject({
      isDone: true, processedCount: 1, deletedFeedCardCount: 1,
    })
    expect(await t.query(verifyLegacyPostMedia, {
      target: 'feedCards', paginationOpts: { cursor: null, numItems: 10 },
    })).toMatchObject({ orphanPostFeedCardIds: [] })
  })

  test('flags Post projections with corrupt owner or visibility source truth', async () => {
    const t = createHarness()
    const ownerId = await insertUser(t, 'card-owner')
    const otherId = await insertUser(t, 'card-other')
    const ownerPostId = await insertPost(t, ownerId, 'owner-corrupt', [])
    const visibilityPostId = await insertPost(t, ownerId, 'visibility-corrupt', [])
    const [ownerCardId, visibilityCardId] = await t.run(async (ctx) => {
      const now = Date.now()
      return await Promise.all([
        ctx.db.insert('feedCards', {
          sourceKey: `post:${ownerPostId}`, kind: 'post', userId: otherId, sourceId: ownerPostId,
          visibility: 'public', active: true, orderKey: 'owner-corrupt', occurredAt: now, updatedAt: now,
        }),
        ctx.db.insert('feedCards', {
          sourceKey: `post:${visibilityPostId}`, kind: 'post', userId: ownerId, sourceId: visibilityPostId,
          visibility: 'private', active: true, orderKey: 'visibility-corrupt', occurredAt: now, updatedAt: now,
        }),
      ])
    })

    const result = await t.query(verifyLegacyPostMedia, {
      target: 'feedCards', paginationOpts: { cursor: null, numItems: 10 },
    })
    expect(new Set(result.orphanPostFeedCardIds)).toEqual(new Set([ownerCardId, visibilityCardId]))
  })

  test('resumes destructive Post pages and repeats cleanly', async () => {
    const t = createHarness()
    const ownerId = await insertUser(t, 'post-page-owner')
    const firstStorageId = await t.run(async (ctx) => await ctx.storage.store(new Blob(['first-post'])))
    const secondStorageId = await t.run(async (ctx) => await ctx.storage.store(new Blob(['second-post'])))
    const firstImageId = await insertImage(t, ownerId, 'first-post-image', 'attached', firstStorageId)
    const secondImageId = await insertImage(t, ownerId, 'second-post-image', 'attached', secondStorageId)
    const firstPostId = await insertPost(t, ownerId, 'first-image-post', [firstImageId])
    const secondPostId = await insertPost(t, ownerId, 'second-image-post', [secondImageId])
    await t.run(async (ctx) => {
      await ctx.db.patch('posts', firstPostId, { createdAt: 1 })
      await ctx.db.patch('posts', secondPostId, { createdAt: 2 })
      await ctx.db.patch('postImages', firstImageId, { postId: firstPostId, order: 0 })
      await ctx.db.patch('postImages', secondImageId, { postId: secondPostId, order: 0 })
    })

    const first = await runPage(t, 'posts', null, 1)
    const second = await runPage(t, 'posts', first.continueCursor, 1)
    const repeated = await runPage(t, 'posts', null, 10)

    expect(first).toMatchObject({ processedCount: 1, deletedPostCount: 1, deletedImageCount: 1, deletedStorageCount: 1 })
    expect(second).toMatchObject({ isDone: true, processedCount: 1, deletedPostCount: 1, deletedImageCount: 1, deletedStorageCount: 1 })
    expect(repeated).toMatchObject({ isDone: true, processedCount: 0, deletedPostCount: 0, deletedImageCount: 0, deletedStorageCount: 0 })
  })

  test('rolls back earlier same-page deletions when a later Post is corrupt', async () => {
    const t = createHarness()
    const ownerId = await insertUser(t, 'rollback-owner')
    const firstStorageId = await t.run(async (ctx) => await ctx.storage.store(new Blob(['rollback-first'])))
    const secondStorageId = await t.run(async (ctx) => await ctx.storage.store(new Blob(['rollback-second'])))
    const firstImageId = await insertImage(t, ownerId, 'rollback-first-image', 'attached', firstStorageId)
    const secondImageId = await insertImage(t, ownerId, 'rollback-second-image', 'attached', secondStorageId)
    const firstPostId = await insertPost(t, ownerId, 'rollback-first-post', [firstImageId])
    const secondPostId = await insertPost(t, ownerId, 'rollback-second-post', [secondImageId])
    const firstCardId = await t.run(async (ctx) => {
      await ctx.db.patch('posts', firstPostId, { createdAt: 1 })
      await ctx.db.patch('posts', secondPostId, { createdAt: 2 })
      await ctx.db.patch('postImages', firstImageId, { postId: firstPostId, order: 0 })
      await ctx.db.patch('postImages', secondImageId, { postId: secondPostId, order: 0 })
      await ctx.storage.delete(secondStorageId)
      return await ctx.db.insert('feedCards', {
        sourceKey: `post:${firstPostId}`, kind: 'post', userId: ownerId, sourceId: firstPostId,
        visibility: 'public', active: true, orderKey: 'rollback-first', occurredAt: 1, updatedAt: 1,
      })
    })

    await expect(runPage(t, 'posts', null, 10)).rejects.toThrow('Legacy Post storage object is missing')
    expect(await t.run(async (ctx) => await ctx.db.get('posts', firstPostId))).not.toBeNull()
    expect(await t.run(async (ctx) => await ctx.db.get('postImages', firstImageId))).not.toBeNull()
    expect(await t.run(async (ctx) => await ctx.db.get('feedCards', firstCardId))).not.toBeNull()
    expect(await t.run(async (ctx) => (await ctx.storage.get(firstStorageId)) !== null)).toBe(true)
  })
})
