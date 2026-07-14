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
  await ctx.db.insert('animeSummaries', {
    anilistId, slug: `anime-${anilistId}`, titles: { display: `Anime ${anilistId}`, english: null, romaji: null, native: null },
    coverImageUrl: null, bannerImageUrl: null, format: 'TV', season: null, seasonYear: 2024, episodes: 12,
    genres: ['Fantasy'], popularity: 1, averageScore: 80, trending: 1, startDate: null, nextAiringAt: null, updatedAt: Date.now(),
  })
})

describe('feed milestone source integrity', () => {
  test('hydrates milestone fields from the authoritative source', async () => {
    const t = createHarness()
    await insertAnime(t, 1)
    const cardId = await t.run(async (ctx) => {
      const now = Date.now()
      const userId = await ctx.db.insert('users', {
        authId: 'milestone-owner', username: 'MilestoneOwner', usernameKey: 'milestoneowner', name: 'Milestone Owner',
        visibility: 'public', createdAt: now, updatedAt: now,
      })
      await ctx.db.insert('animeMilestones', {
        userId, anilistId: 1, kind: 'completed', visibility: 'public', occurredAt: 200, updatedAt: 200,
      })
      const sourceKey = `completed:${userId}:1`
      return await ctx.db.insert('feedCards', {
        sourceKey, kind: 'completed', userId, anilistId: 1, visibility: 'public', active: true,
        orderKey: makeOrderKey(100, sourceKey), occurredAt: 100, updatedAt: 100,
      })
    })

    const card = await t.query(feedApi.feed.getById, { cardId })

    expect(card).toMatchObject({ id: cardId, kind: 'completed', settledAt: 200, visibility: 'public' })
  })

  test('suppresses a milestone projection after its source is deleted', async () => {
    const t = createHarness()
    await insertAnime(t, 1)
    const cardId = await t.run(async (ctx) => {
      const now = Date.now()
      const userId = await ctx.db.insert('users', {
        authId: 'deleted-owner', username: 'DeletedOwner', usernameKey: 'deletedowner', name: 'Deleted Owner',
        visibility: 'public', createdAt: now, updatedAt: now,
      })
      const milestoneId = await ctx.db.insert('animeMilestones', {
        userId, anilistId: 1, kind: 'rewatched', visibility: 'public', occurredAt: now, updatedAt: now,
      })
      const sourceKey = `rewatched:${userId}:1`
      const id = await ctx.db.insert('feedCards', {
        sourceKey, kind: 'rewatched', userId, anilistId: 1, visibility: 'public', active: true,
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
    await insertAnime(t, 1)
    const cardId = await t.run(async (ctx) => {
      const now = Date.now()
      const userId = await ctx.db.insert('users', {
        authId: 'private-owner', username: 'PrivateOwner', usernameKey: 'privateowner', name: 'Private Owner',
        visibility: 'public', createdAt: now, updatedAt: now,
      })
      await ctx.db.insert('animeMilestones', {
        userId, anilistId: 1, kind: 'completed', visibility: 'private', occurredAt: now, updatedAt: now,
      })
      const sourceKey = `completed:${userId}:1`
      return await ctx.db.insert('feedCards', {
        sourceKey, kind: 'completed', userId, anilistId: 1, visibility: 'public', active: true,
        orderKey: makeOrderKey(now, sourceKey), occurredAt: now, updatedAt: now,
      })
    })

    expect(await t.query(feedApi.feed.getById, { cardId })).toBeNull()
    expect((await t.query(feedApi.feed.listGlobal, { cursor: null })).items).toEqual([])
  })

  test('suppresses a stale private projection for a public milestone source', async () => {
    const t = createHarness()
    await insertAnime(t, 1)
    const cardId = await t.run(async (ctx) => {
      const now = Date.now()
      const userId = await ctx.db.insert('users', {
        authId: 'public-source-owner', username: 'PublicSourceOwner', usernameKey: 'publicsourceowner', name: 'Public Source Owner',
        visibility: 'public', createdAt: now, updatedAt: now,
      })
      await ctx.db.insert('animeMilestones', {
        userId, anilistId: 1, kind: 'completed', visibility: 'public', occurredAt: now, updatedAt: now,
      })
      const sourceKey = `completed:${userId}:1`
      return await ctx.db.insert('feedCards', {
        sourceKey, kind: 'completed', userId, anilistId: 1, visibility: 'private', active: true,
        orderKey: makeOrderKey(now, sourceKey), occurredAt: now, updatedAt: now,
      })
    })

    expect(await t.query(feedApi.feed.getById, { cardId })).toBeNull()
    expect((await t.query(feedApi.feed.listGlobal, { cursor: null })).items).toEqual([])
  })

  test('suppresses a projection whose source key does not match its milestone identity', async () => {
    const t = createHarness()
    await insertAnime(t, 1)
    const cardId = await t.run(async (ctx) => {
      const now = Date.now()
      const userId = await ctx.db.insert('users', {
        authId: 'wrong-key-owner', username: 'WrongKeyOwner', usernameKey: 'wrongkeyowner', name: 'Wrong Key Owner',
        visibility: 'public', createdAt: now, updatedAt: now,
      })
      await ctx.db.insert('animeMilestones', {
        userId, anilistId: 1, kind: 'completed', visibility: 'public', occurredAt: now, updatedAt: now,
      })
      return await ctx.db.insert('feedCards', {
        sourceKey: `completed:${userId}:999`, kind: 'completed', userId, anilistId: 1, visibility: 'public', active: true,
        orderKey: makeOrderKey(now, `completed:${userId}:999`), occurredAt: now, updatedAt: now,
      })
    })

    expect(await t.query(feedApi.feed.getById, { cardId })).toBeNull()
  })

  test('reports exact source counts while backfilling repeated cursor pages', async () => {
    const t = createHarness()
    await insertAnime(t, 1)
    await t.run(async (ctx) => {
      const now = Date.now()
      const userId = await ctx.db.insert('users', {
        authId: 'backfill-owner', username: 'BackfillOwner', usernameKey: 'backfillowner', name: 'Backfill Owner',
        visibility: 'public', createdAt: now, updatedAt: now,
      })
      await ctx.db.insert('animeMilestones', { userId, anilistId: 1, kind: 'completed', visibility: 'public', occurredAt: now, updatedAt: now })
      await ctx.db.insert('animeMilestones', { userId, anilistId: 1, kind: 'rewatched', visibility: 'public', occurredAt: now + 1, updatedAt: now + 1 })
    })

    const first = await t.mutation(feedInternal.feed.projectMilestones, { paginationOpts: { numItems: 1, cursor: null } })
    const second = await t.mutation(feedInternal.feed.projectMilestones, { paginationOpts: { numItems: 1, cursor: first.continueCursor } })

    expect(first).toMatchObject({ processedCount: 1, verifiedCount: 1, isDone: false })
    expect(second).toMatchObject({ processedCount: 1, verifiedCount: 1, isDone: true })
  })
})
