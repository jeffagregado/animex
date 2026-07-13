/// <reference types="vite/client" />

import betterAuthTest from '@convex-dev/better-auth/test'
import { convexTest } from 'convex-test'
import { describe, expect, test, vi } from 'vitest'

import { api, components } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')
const createHarness = () => {
  const t = convexTest(schema, modules)
  betterAuthTest.register(t)
  return t
}

const createAuthUser = async (
  t: ReturnType<typeof createHarness>,
  emailVerified: boolean,
  label: string,
) => {
  const now = Date.now()
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: 'user', data: { name: label, email: `${label}@example.com`, emailVerified, createdAt: now, updatedAt: now } },
  })
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: { model: 'session', data: { userId: user._id, token: `${label}-token`, expiresAt: now + 60_000, createdAt: now, updatedAt: now } },
  })
  return {
    authId: user._id,
    client: t.withIdentity({ subject: user._id, sessionId: session._id } as never),
  }
}

const insertProfile = async (
  t: ReturnType<typeof createHarness>,
  authId: string,
  username: string,
  visibility: 'private' | 'followers' | 'public',
) => await t.run(async (ctx) => {
  const now = Date.now()
  return await ctx.db.insert('users', {
    authId, username, usernameKey: username.toLowerCase(), name: username,
    visibility, createdAt: now, updatedAt: now,
  })
})

const insertAnime = async (t: ReturnType<typeof createHarness>, anilistId: number) => await t.run(async (ctx) => {
  await ctx.db.insert('animeSummaries', {
    anilistId, slug: `anime-${anilistId}`, titles: { display: `Anime ${anilistId}`, english: null, romaji: null, native: null },
    coverImageUrl: null, bannerImageUrl: null, format: 'TV', season: null, seasonYear: 2024, episodes: 12,
    genres: ['Fantasy'], popularity: 1, averageScore: 80, trending: 1, startDate: null, nextAiringAt: null, updatedAt: Date.now(),
  })
})

describe('user anime Convex integration', () => {
  test('enforces auth, verification, profile, cache, envelopes, ownership, and milestone rollback', async () => {
    const t = createHarness()
    await expect(t.query(api.userAnime.getMine, { anilistId: 1 })).rejects.toThrow('Unauthenticated')

    const unverified = await createAuthUser(t, false, 'unverified')
    await expect(unverified.client.query(api.userAnime.getMine, { anilistId: 1 })).rejects.toThrow('Verify your email')

    const owner = await createAuthUser(t, true, 'owner')
    await expect(owner.client.query(api.userAnime.getMine, { anilistId: 1 })).rejects.toThrow('Complete your profile')
    const ownerProfileId = await insertProfile(t, owner.authId, 'Owner', 'followers')
    await expect(owner.client.query(api.userAnime.getMine, { anilistId: 1 })).rejects.toThrow('loaded before saving')
    await insertAnime(t, 1)

    expect(await owner.client.mutation(api.userAnime.setStatus, { anilistId: 1, status: 'completed' })).toMatchObject({
      status: 'saved', entry: { anilistId: 1, status: 'completed' },
    })
    expect(await owner.client.mutation(api.userAnime.recordRewatch, { anilistId: 1 })).toMatchObject({
      status: 'saved', entry: { status: 'rewatched', rewatchCount: 1 },
    })
    const milestones = await t.run(async (ctx) => await ctx.db.query('animeMilestones').collect())
    expect(milestones.map(({ kind, visibility }) => ({ kind, visibility }))).toEqual([
      { kind: 'completed', visibility: 'followers' },
      { kind: 'rewatched', visibility: 'followers' },
    ])
    expect(await owner.client.mutation(api.userAnime.removeLatestRewatch, { anilistId: 1 })).toMatchObject({
      status: 'saved', entry: { status: 'completed', rewatchCount: 0 },
    })
    const afterRollback = await t.run(async (ctx) => ({
      completion: await ctx.db.query('animeMilestones').withIndex('by_user_anime_kind', (q) => q.eq('userId', ownerProfileId).eq('anilistId', 1).eq('kind', 'completed')).unique(),
      rewatch: await ctx.db.query('animeMilestones').withIndex('by_user_anime_kind', (q) => q.eq('userId', ownerProfileId).eq('anilistId', 1).eq('kind', 'rewatched')).unique(),
    }))
    expect(afterRollback.completion).not.toBeNull()
    expect(afterRollback.rewatch).toBeNull()

    const other = await createAuthUser(t, true, 'other')
    await insertProfile(t, other.authId, 'Other', 'private')
    expect(await other.client.query(api.userAnime.getMine, { anilistId: 1 })).toBeNull()
  }, 15_000)

  test('pages 0, 20, 21, and 41 same-time rewatches without gaps', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    const t = createHarness()
    const owner = await createAuthUser(t, true, 'pager')
    await insertProfile(t, owner.authId, 'Pager', 'private')
    await insertAnime(t, 1)

    await expect(owner.client.query(api.userAnime.listMyRewatches, {
      anilistId: 1, paginationOpts: { numItems: 19, cursor: null },
    } as never)).rejects.toThrow('Validator error')
    await expect(owner.client.query(api.userAnime.listMyRewatches, {
      anilistId: 1, paginationOpts: { numItems: 20, cursor: null, extra: true },
    } as never)).rejects.toThrow('Validator error')

    expect(await owner.client.query(api.userAnime.listMyRewatches, { anilistId: 1, paginationOpts: { numItems: 20, cursor: null } })).toEqual({
      items: [], continueCursor: '', isDone: true, perPage: 20,
    })
    for (let index = 0; index < 20; index += 1) await owner.client.mutation(api.userAnime.recordRewatch, { anilistId: 1 })
    const twenty = await owner.client.query(api.userAnime.listMyRewatches, { anilistId: 1, paginationOpts: { numItems: 20, cursor: null } })
    expect(twenty.items).toHaveLength(20)
    expect(twenty.isDone).toBe(true)

    await owner.client.mutation(api.userAnime.recordRewatch, { anilistId: 1 })
    const first21 = await owner.client.query(api.userAnime.listMyRewatches, { anilistId: 1, paginationOpts: { numItems: 20, cursor: null } })
    await owner.client.mutation(api.userAnime.recordRewatch, { anilistId: 1 })
    const second21 = await owner.client.query(api.userAnime.listMyRewatches, { anilistId: 1, paginationOpts: { numItems: 20, cursor: first21.continueCursor } })
    expect([first21.items.length, second21.items.length]).toEqual([20, 1])
    expect(new Set([...first21.items, ...second21.items].map((item) => item.id)).size).toBe(21)

    for (let index = 22; index < 41; index += 1) await owner.client.mutation(api.userAnime.recordRewatch, { anilistId: 1 })
    const first41 = await owner.client.query(api.userAnime.listMyRewatches, { anilistId: 1, paginationOpts: { numItems: 20, cursor: null } })
    const second41 = await owner.client.query(api.userAnime.listMyRewatches, { anilistId: 1, paginationOpts: { numItems: 20, cursor: first41.continueCursor } })
    const third41 = await owner.client.query(api.userAnime.listMyRewatches, { anilistId: 1, paginationOpts: { numItems: 20, cursor: second41.continueCursor } })
    expect([first41.items.length, second41.items.length, third41.items.length]).toEqual([20, 20, 1])
    expect(new Set([...first41.items, ...second41.items, ...third41.items].map((item) => item.id)).size).toBe(41)
    expect(await t.run(async (ctx) => new Set((await ctx.db.query('animeRewatchEntries').collect()).map((item) => item.completedAt)).size)).toBe(1)
    await owner.client.mutation(api.userAnime.removeLatestRewatch, { anilistId: 1 })
    await owner.client.mutation(api.userAnime.recordRewatch, { anilistId: 1 })
    const replacementSequences = await t.run(async (ctx) => (await ctx.db.query('animeRewatchEntries').collect()).map((item) => item.sequence))
    expect(Math.max(...replacementSequences)).toBe(42)
    expect(replacementSequences).not.toContain(41)
    const replacementFirst = await owner.client.query(api.userAnime.listMyRewatches, { anilistId: 1, paginationOpts: { numItems: 20, cursor: null } })
    const replacementSecond = await owner.client.query(api.userAnime.listMyRewatches, { anilistId: 1, paginationOpts: { numItems: 20, cursor: replacementFirst.continueCursor } })
    const replacementThird = await owner.client.query(api.userAnime.listMyRewatches, { anilistId: 1, paginationOpts: { numItems: 20, cursor: replacementSecond.continueCursor } })
    expect(new Set([...replacementFirst.items, ...replacementSecond.items, ...replacementThird.items].map((item) => item.id)).size).toBe(41)
    await expect(owner.client.query(api.userAnime.listMyRewatches, { anilistId: 1, paginationOpts: { numItems: 20, cursor: 'forged' } })).rejects.toThrow('cursor')
    const other = await createAuthUser(t, true, 'cursor-owner')
    const otherProfileId = await insertProfile(t, other.authId, 'CursorOwner', 'private')
    await other.client.mutation(api.userAnime.recordRewatch, { anilistId: 1 })
    const foreignCursor = await t.run(async (ctx) => (await ctx.db.query('animeRewatchEntries').withIndex('by_user_anime_sequence', (q) => q.eq('userId', otherProfileId).eq('anilistId', 1)).unique())?._id)
    await expect(owner.client.query(api.userAnime.listMyRewatches, { anilistId: 1, paginationOpts: { numItems: 20, cursor: foreignCursor ?? '' } })).rejects.toThrow('owner')
    vi.useRealTimers()
  })
})
