/// <reference types="vite/client" />

import betterAuthTest from '@convex-dev/better-auth/test'
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'

import { api, components, internal } from './_generated/api'
import { makeOrderKey } from './feedPolicy'
import schema from './schema'

const modules = import.meta.glob(['./_generated/**/*.*', './{feed,posts,reviews}.ts'])
// Generated API is controller-owned and intentionally not regenerated in this worker commit.
const socialApi = api as any
const socialInternal = internal as any
const createHarness = () => {
  const t = convexTest(schema, modules)
  betterAuthTest.register(t)
  return t
}

const createOwner = async (t: ReturnType<typeof createHarness>, label: string) => {
  const now = Date.now()
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: 'user', data: { name: label, email: `${label}@example.com`, emailVerified: true, createdAt: now, updatedAt: now } },
  })
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: 'session', data: { userId: user._id, token: `${label}-token`, expiresAt: now + 60_000, createdAt: now, updatedAt: now } },
  })
  const profileId = await t.run(async (ctx) => await ctx.db.insert('users', {
    authId: user._id, username: label, usernameKey: label.toLowerCase(), name: label,
    visibility: 'public', createdAt: now, updatedAt: now,
  }))
  return { profileId, client: t.withIdentity({ subject: user._id, sessionId: session._id } as never) }
}

const insertAnime = async (t: ReturnType<typeof createHarness>, anilistId: number) => await t.run(async (ctx) => {
  await ctx.db.insert('animeSummaries', {
    anilistId, slug: `anime-${anilistId}`, titles: { display: `Anime ${anilistId}`, english: null, romaji: null, native: null },
    coverImageUrl: null, bannerImageUrl: null, format: 'TV', season: null, seasonYear: 2024, episodes: 12,
    genres: ['Fantasy'], popularity: 1, averageScore: 80, trending: 1, startDate: null, nextAiringAt: null, updatedAt: Date.now(),
  })
})

const body = {
  version: 1,
  editorState: { root: { type: 'root', version: 1, direction: null, format: '', indent: 0, children: [
    { type: 'paragraph', version: 1, direction: null, format: '', indent: 0, textFormat: 0, textStyle: '', children: [
      { type: 'text', version: 1, detail: 0, format: 0, mode: 'normal', style: '', text: 'Excellent.' },
    ] },
  ] } },
}
const bodyJson = JSON.stringify(body)

describe('social Convex integration', () => {
  test('resumes one Review, publishes idempotently, isolates visibility, and updates metrics', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'owner')
    const viewer = await createOwner(t, 'viewer')
    await insertAnime(t, 1)

    await expect(t.mutation(socialApi.reviews.saveDraft, {
      anilistId: 1, requestId: 'signed-out', rating: null, summary: '', summaryHasSpoiler: false,
      bodyJson, visibility: 'private',
    })).rejects.toThrow('Unauthenticated')
    await expect(owner.client.mutation(socialApi.reviews.saveDraft, {
      anilistId: 1, requestId: 'forged-owner', rating: null, summary: '', summaryHasSpoiler: false,
      bodyJson, visibility: 'private', userId: viewer.profileId,
    })).rejects.toThrow('Validator error')

    const draftId = await owner.client.mutation(socialApi.reviews.saveDraft, {
      anilistId: 1, requestId: 'draft-1', rating: null, summary: '', summaryHasSpoiler: false,
      bodyJson, visibility: 'private',
    })
    expect(await owner.client.query(socialApi.reviews.getById, { reviewId: draftId })).toMatchObject({ id: draftId, state: 'draft', bodyJson })
    expect(await viewer.client.query(socialApi.reviews.getById, { reviewId: draftId })).toBeNull()
    expect(await owner.client.mutation(socialApi.reviews.saveDraft, {
      anilistId: 1, requestId: 'draft-2', rating: 80, summary: 'Draft', summaryHasSpoiler: false,
      bodyJson, visibility: 'private',
    })).toBe(draftId)

    const publishedId = await owner.client.mutation(socialApi.reviews.publish, {
      anilistId: 1, requestId: 'publish-1', rating: 95, summary: 'Great', summaryHasSpoiler: false,
      bodyJson, visibility: 'public',
    })
    expect(publishedId).toBe(draftId)
    const reviewFeed = await viewer.client.query(socialApi.feed.listGlobal, { cursor: null })
    expect(reviewFeed.items).toContainEqual(expect.objectContaining({ kind: 'review', reviewId: draftId }))
    expect(await owner.client.mutation(socialApi.reviews.publish, {
      anilistId: 1, requestId: 'publish-1', rating: 95, summary: 'Great', summaryHasSpoiler: false,
      bodyJson, visibility: 'public',
    })).toBe(draftId)
    expect(await viewer.client.query(socialApi.reviews.getStats, { anilistId: 1 })).toMatchObject({ count: 1, average: 95, bands: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] })

    await owner.client.mutation(socialApi.reviews.setVisibility, { reviewId: draftId, visibility: 'followers' })
    expect(await viewer.client.query(socialApi.reviews.getById, { reviewId: draftId })).toBeNull()
    expect(await owner.client.query(socialApi.reviews.getById, { reviewId: draftId })).not.toBeNull()
    expect(await viewer.client.query(socialApi.reviews.getStats, { anilistId: 1 })).toMatchObject({ count: 0, average: null })
    expect(await owner.client.query(socialApi.reviews.getStats, { anilistId: 1 })).toMatchObject({ count: 1, average: 95 })

    await owner.client.mutation(socialApi.reviews.update, {
      reviewId: draftId, rating: 85, summary: 'Updated', summaryHasSpoiler: true, bodyJson, visibility: 'public',
    })
    expect(await viewer.client.query(socialApi.reviews.getStats, { anilistId: 1 })).toMatchObject({ count: 1, average: 85, bands: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0] })
    await owner.client.mutation(socialApi.reviews.removeActivity, { reviewId: draftId })
    expect(await t.run(async (ctx) => (await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', `review:${draftId}`)).unique())?.active)).toBe(false)
    await owner.client.mutation(socialApi.reviews.update, {
      reviewId: draftId, rating: 80, summary: 'Still hidden', summaryHasSpoiler: false, bodyJson, visibility: 'public',
    })
    expect(await t.run(async (ctx) => (await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', `review:${draftId}`)).unique())?.active)).toBe(false)
    await owner.client.mutation(socialApi.reviews.remove, { reviewId: draftId })
    expect(await owner.client.query(socialApi.reviews.getMineForAnime, { anilistId: 1 })).toBeNull()
    expect(await viewer.client.query(socialApi.reviews.getStats, { anilistId: 1 })).toMatchObject({ count: 0, average: null })
  }, 20_000)

  test('creates, edits, and removes an image Post with owned storage cleanup', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'poster')
    const storageId = await t.run(async (ctx) => await ctx.storage.store(new Blob(['image'], { type: 'image/png' })))
    const imageId = await t.run(async (ctx) => await ctx.db.insert('postImages', {
      ownerId: owner.profileId, claimId: 'claim-1', storageId, mimeType: 'image/png', size: 5,
      width: 1, height: 1, state: 'pending', createdAt: Date.now(), updatedAt: Date.now(),
    }))
    const postId = await owner.client.mutation(socialApi.posts.create, {
      requestId: 'post-1', text: '', imageIds: [imageId], hasSpoiler: false, visibility: 'public',
    })
    await owner.client.mutation(socialApi.posts.update, {
      postId, requestId: 'post-update-1', text: 'edited', imageIds: [imageId], hasSpoiler: true, visibility: 'followers',
    })
    await owner.client.mutation(socialApi.posts.remove, { postId })
    expect(await t.run(async (ctx) => await ctx.db.get('postImages', imageId))).toBeNull()
    expect(await t.run(async (ctx) => await ctx.storage.get(storageId))).toBeNull()
    expect(await t.run(async (ctx) => await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', `post:${postId}`)).unique())).toBeNull()
  }, 20_000)

  test('shows public Global cards and dedupes owner-prioritized Home cards', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'feed-owner')
    const other = await createOwner(t, 'feed-other')
    for (const requestId of ['owner-1', 'owner-2']) {
      await owner.client.mutation(socialApi.posts.create, {
        requestId, text: requestId, imageIds: [], hasSpoiler: false, visibility: 'public',
      })
    }
    await other.client.mutation(socialApi.posts.create, {
      requestId: 'global-1', text: 'global', imageIds: [], hasSpoiler: false, visibility: 'public',
    })

    const global = await t.query(socialApi.feed.listGlobal, { cursor: null })
    expect(global.items).toHaveLength(3)
    const home = await owner.client.query(socialApi.feed.listHome, { cursor: null })
    expect(home.items).toHaveLength(3)
    expect(new Set(home.items.map((item: { id: string }) => item.id)).size).toBe(3)
    expect(home.items.slice(0, 2).every((item: { author: { username: string } }) => item.author.username === 'feed-owner')).toBe(true)
  }, 20_000)

  test('rejects publish request collisions across anime and Draft intent', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'collision-owner')
    await insertAnime(t, 1)
    await insertAnime(t, 2)
    await owner.client.mutation(socialApi.reviews.saveDraft, {
      anilistId: 2, requestId: 'collision', rating: null, summary: '', summaryHasSpoiler: false, bodyJson, visibility: 'private',
    })
    await expect(owner.client.mutation(socialApi.reviews.saveDraft, {
      anilistId: 1, requestId: 'collision', rating: null, summary: '', summaryHasSpoiler: false, bodyJson, visibility: 'private',
    })).rejects.toThrow('collision')
    await expect(owner.client.mutation(socialApi.reviews.publish, {
      anilistId: 1, requestId: 'collision', rating: 90, summary: 'Collision', summaryHasSpoiler: false, bodyJson, visibility: 'public',
    })).rejects.toThrow('collision')
  }, 20_000)

  test('rejects Post update request collisions across owned Posts', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'post-collision-owner')
    const firstId = await owner.client.mutation(socialApi.posts.create, {
      requestId: 'post-request-a', text: 'First', imageIds: [], hasSpoiler: false, visibility: 'public',
    })
    const secondId = await owner.client.mutation(socialApi.posts.create, {
      requestId: 'post-request-b', text: 'Second', imageIds: [], hasSpoiler: false, visibility: 'public',
    })
    await expect(owner.client.mutation(socialApi.posts.update, {
      postId: secondId, requestId: 'post-request-a', text: 'Collision', imageIds: [], hasSpoiler: false, visibility: 'public',
    })).rejects.toThrow('collision')
    expect(await t.run(async (ctx) => await ctx.db.get('posts', firstId))).not.toBeNull()
  }, 20_000)

  test('requires cached anime for every Review lifecycle mutation', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'cache-owner')
    await insertAnime(t, 1)
    const reviewId = await owner.client.mutation(socialApi.reviews.publish, {
      anilistId: 1, requestId: 'cache-review', rating: 90, summary: 'Cached', summaryHasSpoiler: false, bodyJson, visibility: 'public',
    })
    await t.run(async (ctx) => {
      const anime = await ctx.db.query('animeSummaries').withIndex('by_anilist_id', (q) => q.eq('anilistId', 1)).unique()
      if (anime) await ctx.db.delete('animeSummaries', anime._id)
    })
    await expect(owner.client.mutation(socialApi.reviews.update, { reviewId, rating: 80, summary: 'No cache', summaryHasSpoiler: false, bodyJson, visibility: 'public' })).rejects.toThrow('loaded')
    await expect(owner.client.mutation(socialApi.reviews.setVisibility, { reviewId, visibility: 'private' })).rejects.toThrow('loaded')
    await expect(owner.client.mutation(socialApi.reviews.removeActivity, { reviewId })).rejects.toThrow('loaded')
    await expect(owner.client.mutation(socialApi.reviews.remove, { reviewId })).rejects.toThrow('loaded')
  }, 20_000)

  test('discards an unregistered signed upload using its owned pending claim', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'discard-owner')
    const storageId = await t.run(async (ctx) => await ctx.storage.store(new Blob(['pending'], { type: 'image/png' })))
    const imageId = await t.run(async (ctx) => await ctx.db.insert('postImages', {
      ownerId: owner.profileId, claimId: 'pending-claim', mimeType: '', size: 0, width: 0, height: 0,
      state: 'pending', createdAt: Date.now(), updatedAt: Date.now(),
    }))
    await owner.client.mutation(socialApi.posts.discardImage, { imageId, storageId })
    expect(await t.run(async (ctx) => await ctx.db.get('postImages', imageId))).toBeNull()
    expect(await t.run(async (ctx) => await ctx.storage.get(storageId))).toBeNull()
  }, 20_000)

  test('continues Home two-to-one ranking across same-time pages without own/global duplication', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'paged-owner')
    const other = await createOwner(t, 'paged-global')
    const occurredAt = 1_000
    await t.run(async (ctx) => {
      for (let index = 1; index <= 25; index += 1) {
        for (const [profileId, prefix] of [[owner.profileId, 'own'], [other.profileId, 'global']] as const) {
          const postId = await ctx.db.insert('posts', {
            userId: profileId, requestId: `${prefix}-${index}`, text: `${prefix}-${index}`, hasSpoiler: false,
            visibility: 'public', imageIds: [], createdAt: occurredAt, updatedAt: occurredAt,
          })
          const sourceKey = `post:${postId}`
          await ctx.db.insert('feedCards', {
            sourceKey, kind: 'post', userId: profileId, sourceId: postId, visibility: 'public', active: true,
            orderKey: makeOrderKey(occurredAt, sourceKey), occurredAt, updatedAt: occurredAt,
          })
        }
      }
    })

    const global = await t.query(socialApi.feed.listGlobal, { cursor: null })
    expect(global.items.some((item: { author: { username: string } }) => item.author.username === 'paged-owner')).toBe(true)

    const items: Array<{ id: string; author: { username: string } }> = []
    let cursor: string | null = null
    do {
      const page: { items: Array<{ id: string; author: { username: string } }>; cursor: string | null } = await owner.client.query(socialApi.feed.listHome, { cursor })
      items.push(...page.items)
      cursor = page.cursor
    } while (cursor !== null)

    expect(items).toHaveLength(50)
    expect(new Set(items.map((item) => item.id)).size).toBe(50)
    for (let index = 0; index < 36; index += 1) {
      const expected = index % 3 === 2 ? 'paged-global' : 'paged-owner'
      expect(items[index]?.author.username).toBe(expected)
    }
  }, 30_000)

  test('advances Home through an all-owner raw batch and continues with later Global cards', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'prefix-owner')
    const other = await createOwner(t, 'prefix-global')
    await t.run(async (ctx) => {
      for (let index = 1; index <= 25; index += 1) {
        const postId = await ctx.db.insert('posts', {
          userId: owner.profileId, requestId: `prefix-own-${index}`, text: `own-${index}`, hasSpoiler: false,
          visibility: 'public', imageIds: [], createdAt: index, updatedAt: index,
        })
        await ctx.db.insert('feedCards', {
          sourceKey: `post:${postId}`, kind: 'post', userId: owner.profileId, sourceId: postId,
          visibility: 'public', active: true, orderKey: String(index).padStart(4, '0'), occurredAt: index, updatedAt: index,
        })
      }
      for (let index = 26; index <= 28; index += 1) {
        const postId = await ctx.db.insert('posts', {
          userId: other.profileId, requestId: `prefix-global-${index}`, text: `global-${index}`, hasSpoiler: false,
          visibility: 'public', imageIds: [], createdAt: index, updatedAt: index,
        })
        await ctx.db.insert('feedCards', {
          sourceKey: `post:${postId}`, kind: 'post', userId: other.profileId, sourceId: postId,
          visibility: 'public', active: true, orderKey: String(index).padStart(4, '0'), occurredAt: index, updatedAt: index,
        })
      }
    })

    const first = await owner.client.query(socialApi.feed.listHome, { cursor: null })
    expect(first.items).toHaveLength(20)
    expect(first.items.every((item: { author: { username: string } }) => item.author.username === 'prefix-owner')).toBe(true)
    const second = await owner.client.query(socialApi.feed.listHome, { cursor: first.cursor })
    expect(second.items.some((item: { author: { username: string } }) => item.author.username === 'prefix-global')).toBe(true)
    expect(new Set([...first.items, ...second.items].map((item: { id: string }) => item.id)).size).toBe(first.items.length + second.items.length)
  }, 30_000)

  test('rejects malformed stored Review stats before returning them', async () => {
    const t = createHarness()
    await insertAnime(t, 1)
    await t.run(async (ctx) => {
      await ctx.db.insert('animeReviewStats', { anilistId: 1, count: 1, ratingSum: 90, bands: [1, 0, 0, 0, 0, 0, 0, 0, 0], updatedAt: Date.now() })
    })
    await expect(t.query(socialApi.reviews.getStats, { anilistId: 1 })).rejects.toThrow()
  })

  test('paginates 25 public Reviews plus one private owner Review exactly once', async () => {
    const t = createHarness()
    const viewer = await createOwner(t, 'review-pager')
    await insertAnime(t, 1)
    await t.run(async (ctx) => {
      for (let index = 1; index <= 25; index += 1) {
        const now = index
        const userId = await ctx.db.insert('users', {
          authId: `review-author-${index}`, username: `Author${index}`, usernameKey: `author${index}`,
          name: `Author ${index}`, visibility: 'public', createdAt: now, updatedAt: now,
        })
        const key = String(index * 2).padStart(4, '0')
        await ctx.db.insert('reviews', {
          userId, anilistId: 1, requestId: `public-${index}`, state: 'published', rating: 50,
          summary: `Public ${index}`, summaryHasSpoiler: false, bodyJson, visibility: 'public',
          publishedAt: now, updatedAt: now, activityState: 'active', newestOrderKey: key,
          highRatingOrderKey: key, lowRatingOrderKey: key,
        })
      }
      await ctx.db.insert('reviews', {
        userId: viewer.profileId, anilistId: 1, requestId: 'private-own', state: 'published', rating: 50,
        summary: 'Private own', summaryHasSpoiler: false, bodyJson, visibility: 'private',
        publishedAt: 13, updatedAt: 13, activityState: 'active', newestOrderKey: '0025',
        highRatingOrderKey: '0025', lowRatingOrderKey: '0025',
      })
    })

    const items: Array<Record<string, unknown>> = []
    let cursor: string | null = null
    do {
      const page: { items: Array<Record<string, unknown>>; cursor: string | null } = await viewer.client.query(socialApi.reviews.listForAnime, { anilistId: 1, sort: 'newest', cursor })
      items.push(...page.items)
      cursor = page.cursor
    } while (cursor !== null)

    expect(items).toHaveLength(26)
    expect(items.filter((item) => item.summary === 'Private own')).toHaveLength(1)
    expect(new Set(items.map((item) => item.id)).size).toBe(26)
    expect(items[0]).not.toHaveProperty('body')
    expect(items[0]).not.toHaveProperty('bodyJson')
    expect(items[0]?.anime).not.toHaveProperty('id')
  }, 30_000)

  test('backfills milestone cards idempotently without reactivating removed activity', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'backfill-owner')
    await insertAnime(t, 1)
    await t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert('animeMilestones', {
        userId: owner.profileId, anilistId: 1, kind: 'completed', visibility: 'public', occurredAt: now, updatedAt: now,
      })
    })
    await t.mutation(socialInternal.feed.projectMilestones, { paginationOpts: { numItems: 10, cursor: null } })
    const cardId = await t.run(async (ctx) => {
      const card = await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', `completed:${owner.profileId}:1`)).unique()
      if (!card) throw new Error('Backfilled milestone card missing.')
      return card._id
    })
    await owner.client.mutation(socialApi.feed.removeActivity, { cardId })
    await t.mutation(socialInternal.feed.projectMilestones, { paginationOpts: { numItems: 10, cursor: null } })
    const cards = await t.run(async (ctx) => await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', `completed:${owner.profileId}:1`)).collect())
    expect(cards).toHaveLength(1)
    expect(cards[0]?.active).toBe(false)
  }, 20_000)
})
