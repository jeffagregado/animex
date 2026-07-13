/// <reference types="vite/client" />

import betterAuthTest from '@convex-dev/better-auth/test'
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'

import { api, components } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob(['./_generated/**/*.*', './{feed,posts,reviews}.ts'])
// Generated API is controller-owned and intentionally not regenerated in this worker commit.
const socialApi = api as any
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

describe('social Convex integration', () => {
  test('resumes one Review, publishes idempotently, isolates visibility, and updates metrics', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'owner')
    const viewer = await createOwner(t, 'viewer')
    await insertAnime(t, 1)

    await expect(t.mutation(socialApi.reviews.saveDraft, {
      anilistId: 1, requestId: 'signed-out', rating: null, summary: '', summaryHasSpoiler: false,
      body, visibility: 'private',
    })).rejects.toThrow('Unauthenticated')
    await expect(owner.client.mutation(socialApi.reviews.saveDraft, {
      anilistId: 1, requestId: 'forged-owner', rating: null, summary: '', summaryHasSpoiler: false,
      body, visibility: 'private', userId: viewer.profileId,
    })).rejects.toThrow('Validator error')

    const draftId = await owner.client.mutation(socialApi.reviews.saveDraft, {
      anilistId: 1, requestId: 'draft-1', rating: null, summary: '', summaryHasSpoiler: false,
      body, visibility: 'private',
    })
    expect(await owner.client.mutation(socialApi.reviews.saveDraft, {
      anilistId: 1, requestId: 'draft-2', rating: 80, summary: 'Draft', summaryHasSpoiler: false,
      body, visibility: 'private',
    })).toBe(draftId)

    const publishedId = await owner.client.mutation(socialApi.reviews.publish, {
      anilistId: 1, requestId: 'publish-1', rating: 95, summary: 'Great', summaryHasSpoiler: false,
      body, visibility: 'public',
    })
    expect(publishedId).toBe(draftId)
    expect(await owner.client.mutation(socialApi.reviews.publish, {
      anilistId: 1, requestId: 'publish-1', rating: 95, summary: 'Great', summaryHasSpoiler: false,
      body, visibility: 'public',
    })).toBe(draftId)
    expect(await viewer.client.query(socialApi.reviews.getStats, { anilistId: 1 })).toMatchObject({ count: 1, average: 95, bands: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] })

    await owner.client.mutation(socialApi.reviews.setVisibility, { reviewId: draftId, visibility: 'followers' })
    expect(await viewer.client.query(socialApi.reviews.getById, { reviewId: draftId })).toBeNull()
    expect(await owner.client.query(socialApi.reviews.getById, { reviewId: draftId })).not.toBeNull()
    expect(await viewer.client.query(socialApi.reviews.getStats, { anilistId: 1 })).toMatchObject({ count: 0, average: null })
    expect(await owner.client.query(socialApi.reviews.getStats, { anilistId: 1 })).toMatchObject({ count: 1, average: 95 })

    await owner.client.mutation(socialApi.reviews.update, {
      reviewId: draftId, rating: 85, summary: 'Updated', summaryHasSpoiler: true, body, visibility: 'public',
    })
    expect(await viewer.client.query(socialApi.reviews.getStats, { anilistId: 1 })).toMatchObject({ count: 1, average: 85, bands: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0] })
    await owner.client.mutation(socialApi.reviews.removeActivity, { reviewId: draftId })
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
})
