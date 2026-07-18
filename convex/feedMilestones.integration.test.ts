/// <reference types="vite/client" />

import betterAuthTest from '@convex-dev/better-auth/test'
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'

import { api, internal } from './_generated/api'
import { makeOrderKey } from './feedPolicy'
import schema from './schema'

const modules = import.meta.glob(['./_generated/**/*.*', './feed.ts'])
const feedApi = api as any
const feedInternal = internal as any

const createHarness = () => {
  const t = convexTest(schema, modules)
  betterAuthTest.register(t)
  return t
}

const insertAnime = async (t: ReturnType<typeof createHarness>, anilistId: number) => await t.run(async (ctx) => {
  const now = Date.now()
  const animeId = await ctx.db.insert('catalogEntities', { kind: 'anime', createdAt: now, updatedAt: now })
  await ctx.db.insert('catalogProviderRefs', {
    entityId: animeId, provider: 'anilist', kind: 'anime', providerId: anilistId, createdAt: now, updatedAt: now,
  })
  await ctx.db.insert('animeSummaries', {
    anilistId, slug: `anime-${anilistId}`, titles: { display: `Anime ${anilistId}`, english: null, romaji: null, native: null },
    coverImageUrl: null, bannerImageUrl: null, format: 'TV', season: null, seasonYear: 2024, episodes: 12,
    genres: ['Fantasy'], popularity: 1, averageScore: 80, trending: 1, startDate: null, nextAiringAt: null, updatedAt: now,
  })
  return animeId
})

describe('feed milestone source integrity', () => {
  test('hydrates milestone fields from the authoritative source', async () => {
    const t = createHarness()
    const animeId = await insertAnime(t, 1)
    const cardId = await t.run(async (ctx) => {
      const now = Date.now()
      const userId = await ctx.db.insert('users', {
        authId: 'milestone-owner', username: 'MilestoneOwner', usernameKey: 'milestoneowner', name: 'Milestone Owner',
        profileVisibility: 'public', visibility: 'public', createdAt: now, updatedAt: now,
      })
      await ctx.db.insert('animeMilestones', {
        userId, anilistId: 1, animeId, kind: 'completed', visibility: 'public', occurredAt: 200, updatedAt: 200,
      })
      const sourceKey = `completed:${userId}:${animeId}`
      return await ctx.db.insert('feedCards', {
        sourceKey, kind: 'completed', userId, anilistId: 1, animeId, visibility: 'public', active: true,
        orderKey: makeOrderKey(100, sourceKey), occurredAt: 100, updatedAt: 100,
      })
    })

    const card = await t.query(feedApi.feed.getById, { cardId })

    expect(card).toMatchObject({
      id: cardId,
      kind: 'completed',
      settledAt: 200,
      visibility: 'public',
      anime: { publicId: animeId, seasonYear: 2024, format: 'TV' },
    })
    expect(JSON.stringify(card)).not.toContain('anilistId')
  })

  test('suppresses a milestone projection after its source is deleted', async () => {
    const t = createHarness()
    const animeId = await insertAnime(t, 1)
    const cardId = await t.run(async (ctx) => {
      const now = Date.now()
      const userId = await ctx.db.insert('users', {
        authId: 'deleted-owner', username: 'DeletedOwner', usernameKey: 'deletedowner', name: 'Deleted Owner',
        profileVisibility: 'public', visibility: 'public', createdAt: now, updatedAt: now,
      })
      const milestoneId = await ctx.db.insert('animeMilestones', {
        userId, anilistId: 1, animeId, kind: 'rewatched', visibility: 'public', occurredAt: now, updatedAt: now,
      })
      const sourceKey = `rewatched:${userId}:${animeId}`
      const id = await ctx.db.insert('feedCards', {
        sourceKey, kind: 'rewatched', userId, anilistId: 1, animeId, visibility: 'public', active: true,
        orderKey: makeOrderKey(now, sourceKey), occurredAt: now, updatedAt: now,
      })
      await ctx.db.delete('animeMilestones', milestoneId)
      return id
    })

    expect(await t.query(feedApi.feed.getById, { cardId })).toBeNull()
    expect((await t.query(feedApi.feed.listGlobal, { cursor: null })).items).toEqual([])
  })

  test('does not expose a private source through a stale public projection', async () => {
    const t = createHarness()
    const animeId = await insertAnime(t, 1)
    const cardId = await t.run(async (ctx) => {
      const now = Date.now()
      const userId = await ctx.db.insert('users', {
        authId: 'private-owner', username: 'PrivateOwner', usernameKey: 'privateowner', name: 'Private Owner',
        profileVisibility: 'public', visibility: 'public', createdAt: now, updatedAt: now,
      })
      await ctx.db.insert('animeMilestones', {
        userId, anilistId: 1, animeId, kind: 'completed', visibility: 'private', occurredAt: now, updatedAt: now,
      })
      const sourceKey = `completed:${userId}:${animeId}`
      return await ctx.db.insert('feedCards', {
        sourceKey, kind: 'completed', userId, anilistId: 1, animeId, visibility: 'public', active: true,
        orderKey: makeOrderKey(now, sourceKey), occurredAt: now, updatedAt: now,
      })
    })

    expect(await t.query(feedApi.feed.getById, { cardId })).toBeNull()
    expect((await t.query(feedApi.feed.listGlobal, { cursor: null })).items).toEqual([])
  })

  test('suppresses a stale private projection for a public milestone source', async () => {
    const t = createHarness()
    const animeId = await insertAnime(t, 1)
    const cardId = await t.run(async (ctx) => {
      const now = Date.now()
      const userId = await ctx.db.insert('users', {
        authId: 'public-source-owner', username: 'PublicSourceOwner', usernameKey: 'publicsourceowner', name: 'Public Source Owner',
        profileVisibility: 'public', visibility: 'public', createdAt: now, updatedAt: now,
      })
      await ctx.db.insert('animeMilestones', {
        userId, anilistId: 1, animeId, kind: 'completed', visibility: 'public', occurredAt: now, updatedAt: now,
      })
      const sourceKey = `completed:${userId}:${animeId}`
      return await ctx.db.insert('feedCards', {
        sourceKey, kind: 'completed', userId, anilistId: 1, animeId, visibility: 'private', active: true,
        orderKey: makeOrderKey(now, sourceKey), occurredAt: now, updatedAt: now,
      })
    })

    expect(await t.query(feedApi.feed.getById, { cardId })).toBeNull()
    expect((await t.query(feedApi.feed.listGlobal, { cursor: null })).items).toEqual([])
  })

  test('suppresses a projection whose source key does not match its milestone identity', async () => {
    const t = createHarness()
    const animeId = await insertAnime(t, 1)
    const cardId = await t.run(async (ctx) => {
      const now = Date.now()
      const userId = await ctx.db.insert('users', {
        authId: 'wrong-key-owner', username: 'WrongKeyOwner', usernameKey: 'wrongkeyowner', name: 'Wrong Key Owner',
        profileVisibility: 'public', visibility: 'public', createdAt: now, updatedAt: now,
      })
      await ctx.db.insert('animeMilestones', {
        userId, anilistId: 1, animeId, kind: 'completed', visibility: 'public', occurredAt: now, updatedAt: now,
      })
      return await ctx.db.insert('feedCards', {
        sourceKey: `completed:${userId}:wrong`, kind: 'completed', userId, anilistId: 1, animeId, visibility: 'public', active: true,
        orderKey: makeOrderKey(now, `completed:${userId}:999`), occurredAt: now, updatedAt: now,
      })
    })

    expect(await t.query(feedApi.feed.getById, { cardId })).toBeNull()
  })

  test('rejects missing and conflicting milestone entity links without repairing rows', async () => {
    const t = createHarness()
    const animeId = await insertAnime(t, 1)
    const conflictingAnimeId = await insertAnime(t, 2)
    const rows = await t.run(async (ctx) => {
      const now = Date.now()
      const userId = await ctx.db.insert('users', {
        authId: 'identity-owner', username: 'IdentityOwner', usernameKey: 'identityowner', name: 'Identity Owner',
        profileVisibility: 'public', visibility: 'public', createdAt: now, updatedAt: now,
      })
      const missingMilestoneId = await ctx.db.insert('animeMilestones', {
        userId, anilistId: 1, kind: 'completed', visibility: 'public', occurredAt: now, updatedAt: now,
      })
      const missingKey = `completed:${userId}:${animeId}`
      const missingCardId = await ctx.db.insert('feedCards', {
        sourceKey: missingKey, kind: 'completed', userId, anilistId: 1, visibility: 'public', active: true,
        orderKey: makeOrderKey(now, missingKey), occurredAt: now, updatedAt: now,
      })
      const conflictMilestoneId = await ctx.db.insert('animeMilestones', {
        userId, anilistId: 1, animeId: conflictingAnimeId, kind: 'rewatched', visibility: 'public', occurredAt: now + 1, updatedAt: now + 1,
      })
      const conflictKey = `rewatched:${userId}:${conflictingAnimeId}`
      const conflictCardId = await ctx.db.insert('feedCards', {
        sourceKey: conflictKey, kind: 'rewatched', userId, anilistId: 1, animeId: conflictingAnimeId, visibility: 'public', active: true,
        orderKey: makeOrderKey(now + 1, conflictKey), occurredAt: now + 1, updatedAt: now + 1,
      })
      return { missingMilestoneId, missingCardId, conflictMilestoneId, conflictCardId }
    })

    await expect(t.query(feedApi.feed.getById, { cardId: rows.missingCardId }))
      .rejects.toThrow('CATALOG_PROVIDER_REF_MISSING')
    await expect(t.query(feedApi.feed.getById, { cardId: rows.conflictCardId }))
      .rejects.toThrow('CATALOG_PROVIDER_REF_CONFLICT')
    await expect(t.mutation(feedInternal.feed.projectMilestones, {
      paginationOpts: { numItems: 10, cursor: null },
    })).rejects.toThrow('CATALOG_PROVIDER_REF_MISSING')
    const stored = await t.run(async (ctx) => ({
      milestone: await ctx.db.get('animeMilestones', rows.missingMilestoneId),
      card: await ctx.db.get('feedCards', rows.missingCardId),
    }))
    expect(stored.milestone?.animeId).toBeUndefined()
    expect(stored.card?.animeId).toBeUndefined()
  })

  test('rejects legacy milestone source keys without inserting or patching projections', async () => {
    const t = createHarness()
    const animeId = await insertAnime(t, 1)
    const rows = await t.run(async (ctx) => {
      const now = Date.now()
      const userId = await ctx.db.insert('users', {
        authId: 'legacy-owner', username: 'LegacyOwner', usernameKey: 'legacyowner', name: 'Legacy Owner',
        profileVisibility: 'public', visibility: 'public', createdAt: now, updatedAt: now,
      })
      const milestoneId = await ctx.db.insert('animeMilestones', {
        userId, anilistId: 1, animeId, kind: 'completed', visibility: 'public', occurredAt: now, updatedAt: now,
      })
      const legacyKey = `completed:${userId}:1`
      const cardId = await ctx.db.insert('feedCards', {
        sourceKey: legacyKey, kind: 'completed', userId, anilistId: 1, visibility: 'public', active: true,
        orderKey: makeOrderKey(now - 1, legacyKey), occurredAt: now - 1, updatedAt: now - 1,
      })
      return { milestoneId, cardId, userId, legacyKey, entityKey: `completed:${userId}:${animeId}` }
    })

    await expect(t.mutation(feedInternal.feed.projectMilestones, {
      paginationOpts: { numItems: 10, cursor: null },
    })).rejects.toThrow('MILESTONE_SOURCE_CONFLICT')
    const stored = await t.run(async (ctx) => ({
      milestone: await ctx.db.get('animeMilestones', rows.milestoneId),
      legacyCard: await ctx.db.get('feedCards', rows.cardId),
      entityCard: await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', rows.entityKey)).unique(),
    }))
    expect(stored.milestone).toMatchObject({ animeId })
    expect(stored.legacyCard).toMatchObject({
      sourceKey: rows.legacyKey,
      active: true,
    })
    expect(stored.legacyCard).not.toHaveProperty('animeId')
    expect(stored.entityCard).toBeNull()
  })

  test('rejects dual milestone source keys without patching either projection', async () => {
    const t = createHarness()
    const animeId = await insertAnime(t, 1)
    const rows = await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {
        authId: 'dual-owner', username: 'DualOwner', usernameKey: 'dualowner', name: 'Dual Owner',
        profileVisibility: 'public', visibility: 'public', createdAt: 1, updatedAt: 1,
      })
      await ctx.db.insert('animeMilestones', {
        userId, anilistId: 1, animeId, kind: 'rewatched', visibility: 'public', occurredAt: 500, updatedAt: 500,
      })
      const entityKey = `rewatched:${userId}:${animeId}`
      const legacyKey = `rewatched:${userId}:1`
      const entityCardId = await ctx.db.insert('feedCards', {
        sourceKey: entityKey, kind: 'rewatched', userId, anilistId: 1, animeId, visibility: 'private', active: false,
        orderKey: makeOrderKey(100, entityKey), occurredAt: 100, updatedAt: 100,
      })
      const legacyCardId = await ctx.db.insert('feedCards', {
        sourceKey: legacyKey, kind: 'rewatched', userId, anilistId: 1, visibility: 'public', active: true,
        orderKey: makeOrderKey(200, legacyKey), occurredAt: 200, updatedAt: 200,
      })
      return { entityCardId, legacyCardId }
    })

    await expect(t.mutation(feedInternal.feed.projectMilestones, {
      paginationOpts: { numItems: 10, cursor: null },
    })).rejects.toThrow('MILESTONE_SOURCE_CONFLICT')
    const stored = await t.run(async (ctx) => ({
      entityCard: await ctx.db.get('feedCards', rows.entityCardId),
      legacyCard: await ctx.db.get('feedCards', rows.legacyCardId),
    }))
    expect(stored.entityCard).toMatchObject({
      visibility: 'private',
      active: false,
      occurredAt: 100,
      updatedAt: 100,
    })
    expect(stored.legacyCard).toMatchObject({
      visibility: 'public',
      active: true,
      occurredAt: 200,
      updatedAt: 200,
    })
    expect(stored.legacyCard).not.toHaveProperty('animeId')
  })

  test('reports exact source counts while projecting repeated cursor pages', async () => {
    const t = createHarness()
    const animeId = await insertAnime(t, 1)
    await t.run(async (ctx) => {
      const now = Date.now()
      const userId = await ctx.db.insert('users', {
        authId: 'backfill-owner', username: 'BackfillOwner', usernameKey: 'backfillowner', name: 'Backfill Owner',
        profileVisibility: 'public', visibility: 'public', createdAt: now, updatedAt: now,
      })
      await ctx.db.insert('animeMilestones', { userId, anilistId: 1, animeId, kind: 'completed', visibility: 'public', occurredAt: now, updatedAt: now })
      await ctx.db.insert('animeMilestones', { userId, anilistId: 1, animeId, kind: 'rewatched', visibility: 'public', occurredAt: now + 1, updatedAt: now + 1 })
    })

    const first = await t.mutation(feedInternal.feed.projectMilestones, { paginationOpts: { numItems: 1, cursor: null } })
    const second = await t.mutation(feedInternal.feed.projectMilestones, { paginationOpts: { numItems: 1, cursor: first.continueCursor } })

    expect(first).toMatchObject({ processedCount: 1, verifiedCount: 1, isDone: false })
    expect(second).toMatchObject({ processedCount: 1, verifiedCount: 1, isDone: true })
  })
})
