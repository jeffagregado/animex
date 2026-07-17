/// <reference types="vite/client" />

import betterAuthTest from '@convex-dev/better-auth/test'
import { makeFunctionReference } from 'convex/server'
import { convexTest } from 'convex-test'
import { describe, expect, test, vi } from 'vitest'

import { api, components } from './_generated/api'
import type { Id } from './_generated/dataModel'
import schema from './schema'

const modules = import.meta.glob(['./_generated/**/*.*', './userAnime.ts'])
type Progress = { watching: number; completed: number; planned: number; dropped: number }
type PageArgs = { paginationOpts: { numItems: number; cursor: string | null } }
type BackfillPage = { continueCursor: string; isDone: boolean; processedCount: number; updatedCount: number }
type VerificationPage = { continueCursor: string; isDone: boolean; processedCount: number; mismatchUserIds: string[] }
const getMyProgress = makeFunctionReference<'query', Record<string, never>, Progress>('userAnime:getMyProgress')
const backfillProgress = makeFunctionReference<'mutation', PageArgs, BackfillPage>('userAnime:backfillProgress')
const verifyProgress = makeFunctionReference<'mutation', PageArgs, VerificationPage>('userAnime:verifyProgress')
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
    profileVisibility: 'public', visibility, createdAt: now, updatedAt: now,
  })
})

const insertAnime = async (t: ReturnType<typeof createHarness>, anilistId: number) => await t.run(async (ctx) => {
  await ctx.db.insert('animeSummaries', {
    anilistId, slug: `anime-${anilistId}`, titles: { display: `Anime ${anilistId}`, english: null, romaji: null, native: null },
    coverImageUrl: null, bannerImageUrl: null, format: 'TV', season: null, seasonYear: 2024, episodes: 12,
    genres: ['Fantasy'], popularity: 1, averageScore: 80, trending: 1, startDate: null, nextAiringAt: null, updatedAt: Date.now(),
  })
})

const deleteProgress = async (t: ReturnType<typeof createHarness>, userId: Id<'users'>) => await t.run(async (ctx) => {
  const progress = await ctx.db.query('userAnimeProgress').withIndex('by_user', (q) => q.eq('userId', userId)).unique()
  if (!progress) throw new Error('Expected List Progress row.')
  await ctx.db.delete('userAnimeProgress', progress._id)
})

describe('user anime Convex integration', () => {
  test('returns authenticated zero progress without creating an aggregate row', async () => {
    const t = createHarness()
    await expect(t.query(getMyProgress, {})).rejects.toThrow('Unauthenticated')

    const owner = await createAuthUser(t, true, 'progress-zero')
    await expect(owner.client.query(getMyProgress, {})).rejects.toThrow('Complete your profile')
    await insertProfile(t, owner.authId, 'ProgressZero', 'private')

    expect(await owner.client.query(getMyProgress, {})).toEqual({ watching: 0, completed: 0, planned: 0, dropped: 0 })
    expect(await t.run(async (ctx) => await ctx.db.query('userAnimeProgress').collect())).toEqual([])
  })

  test('counts status transitions once and replaces prior status atomically', async () => {
    const t = createHarness()
    const owner = await createAuthUser(t, true, 'progress-status')
    await insertProfile(t, owner.authId, 'ProgressStatus', 'private')
    for (const anilistId of [1, 2, 3, 4, 5]) await insertAnime(t, anilistId)

    await owner.client.mutation(api.userAnime.setStatus, { anilistId: 1, status: 'watching' })
    await owner.client.mutation(api.userAnime.setStatus, { anilistId: 2, status: 'completed' })
    await owner.client.mutation(api.userAnime.setStatus, { anilistId: 3, status: 'planned' })
    await owner.client.mutation(api.userAnime.setStatus, { anilistId: 4, status: 'dropped' })
    await owner.client.mutation(api.userAnime.setStatus, { anilistId: 5, status: 'rewatched' })
    expect(await owner.client.query(getMyProgress, {})).toEqual({ watching: 1, completed: 1, planned: 1, dropped: 1 })

    await owner.client.mutation(api.userAnime.setStatus, { anilistId: 3, status: 'planned' })
    expect(await owner.client.query(getMyProgress, {})).toEqual({ watching: 1, completed: 1, planned: 1, dropped: 1 })

    await owner.client.mutation(api.userAnime.setStatus, { anilistId: 1, status: 'completed' })
    expect(await owner.client.query(getMyProgress, {})).toEqual({ watching: 0, completed: 2, planned: 1, dropped: 1 })

    await owner.client.mutation(api.userAnime.setStatus, { anilistId: 2, status: 'rewatched' })
    expect(await owner.client.query(getMyProgress, {})).toEqual({ watching: 0, completed: 1, planned: 1, dropped: 1 })
  })

  test('keeps one progress row when first status writes race', async () => {
    const t = createHarness()
    const owner = await createAuthUser(t, true, 'progress-concurrent')
    const ownerId = await insertProfile(t, owner.authId, 'ProgressConcurrent', 'private')
    await insertAnime(t, 1)
    await insertAnime(t, 2)

    await Promise.all([
      owner.client.mutation(api.userAnime.setStatus, { anilistId: 1, status: 'watching' }),
      owner.client.mutation(api.userAnime.setStatus, { anilistId: 2, status: 'completed' }),
    ])

    expect(await owner.client.query(getMyProgress, {})).toEqual({ watching: 1, completed: 1, planned: 0, dropped: 0 })
    const rows = await t.run(async (ctx) => await ctx.db.query('userAnimeProgress').withIndex('by_user', (q) => q.eq('userId', ownerId)).collect())
    expect(rows).toHaveLength(1)
  })

  test('fails loudly when stored progress contains a negative count', async () => {
    const t = createHarness()
    const owner = await createAuthUser(t, true, 'progress-negative')
    const ownerId = await insertProfile(t, owner.authId, 'ProgressNegative', 'private')
    await insertAnime(t, 1)
    await owner.client.mutation(api.userAnime.setStatus, { anilistId: 1, status: 'watching' })
    await t.run(async (ctx) => {
      const progress = await ctx.db.query('userAnimeProgress').withIndex('by_user', (q) => q.eq('userId', ownerId)).unique()
      if (!progress) throw new Error('Expected List Progress row.')
      await ctx.db.patch('userAnimeProgress', progress._id, { completed: -1 })
    })

    await expect(owner.client.query(getMyProgress, {})).rejects.toThrow('nonnegative')
    await expect(owner.client.mutation(api.userAnime.setStatus, { anilistId: 1, status: 'watching' })).rejects.toThrow('nonnegative')
  })

  test('rebuilds missing legacy progress before every status-changing mutation', async () => {
    const t = createHarness()
    const owner = await createAuthUser(t, true, 'progress-legacy')
    const ownerId = await insertProfile(t, owner.authId, 'ProgressLegacy', 'private')
    for (const anilistId of [1, 2, 3, 4]) await insertAnime(t, anilistId)
    await t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert('userAnimeEntries', {
        userId: ownerId, anilistId: 1, status: 'watching', score: null, favoriteAt: null,
        rewatchCount: 0, lastRewatchSequence: 0, createdAt: now, updatedAt: now,
      })
      await ctx.db.insert('userAnimeEntries', {
        userId: ownerId, anilistId: 2, status: null, score: null, favoriteAt: null,
        rewatchCount: 0, lastRewatchSequence: 0, createdAt: now, updatedAt: now,
      })
      await ctx.db.insert('userAnimeEntries', {
        userId: ownerId, anilistId: 3, status: 'completed', score: null, favoriteAt: null,
        rewatchCount: 0, lastRewatchSequence: 0, createdAt: now, updatedAt: now,
      })
      const rewatchEntryId = await ctx.db.insert('userAnimeEntries', {
        userId: ownerId, anilistId: 4, status: 'rewatched', score: null, favoriteAt: null,
        rewatchCount: 1, lastRewatchSequence: 1, createdAt: now, updatedAt: now,
      })
      await ctx.db.insert('animeRewatchEntries', {
        entryId: rewatchEntryId, userId: ownerId, anilistId: 4, completedAt: now, sequence: 1,
      })
    })

    await owner.client.mutation(api.userAnime.setStatus, { anilistId: 1, status: 'completed' })
    expect(await owner.client.query(getMyProgress, {})).toEqual({ watching: 0, completed: 2, planned: 0, dropped: 0 })

    await deleteProgress(t, ownerId)
    await owner.client.mutation(api.userAnime.setScore, { anilistId: 2, score: 8 })
    expect(await owner.client.query(getMyProgress, {})).toEqual({ watching: 1, completed: 2, planned: 0, dropped: 0 })

    await deleteProgress(t, ownerId)
    await owner.client.mutation(api.userAnime.recordRewatch, { anilistId: 3 })
    expect(await owner.client.query(getMyProgress, {})).toEqual({ watching: 1, completed: 1, planned: 0, dropped: 0 })

    await deleteProgress(t, ownerId)
    await owner.client.mutation(api.userAnime.removeLatestRewatch, { anilistId: 4 })
    expect(await owner.client.query(getMyProgress, {})).toEqual({ watching: 1, completed: 2, planned: 0, dropped: 0 })
  })

  test('backfills profile pages by replacement and verifies drift without zero rows', async () => {
    const t = createHarness()
    const active = await createAuthUser(t, true, 'progress-backfill-active')
    const activeId = await insertProfile(t, active.authId, 'ProgressBackfillActive', 'private')
    const untouched = await createAuthUser(t, true, 'progress-backfill-untouched')
    const untouchedId = await insertProfile(t, untouched.authId, 'ProgressBackfillUntouched', 'private')
    const drifted = await createAuthUser(t, true, 'progress-backfill-drifted')
    const driftedId = await insertProfile(t, drifted.authId, 'ProgressBackfillDrifted', 'private')

    await t.run(async (ctx) => {
      const now = Date.now()
      for (const [anilistId, status] of [[1, 'watching'], [2, 'completed'], [3, 'rewatched']] as const) {
        await ctx.db.insert('userAnimeEntries', {
          userId: activeId, anilistId, status, score: null, favoriteAt: null,
          rewatchCount: 0, lastRewatchSequence: 0, createdAt: now, updatedAt: now,
        })
      }
      await ctx.db.insert('userAnimeEntries', {
        userId: driftedId, anilistId: 4, status: 'dropped', score: null, favoriteAt: null,
        rewatchCount: 0, lastRewatchSequence: 0, createdAt: now, updatedAt: now,
      })
      await ctx.db.insert('userAnimeProgress', { userId: driftedId, watching: 8, completed: 7, planned: 6, dropped: 5 })
    })

    const first = await t.mutation(backfillProgress, { paginationOpts: { numItems: 2, cursor: null } })
    expect(first).toMatchObject({ isDone: false, processedCount: 2 })
    const second = await t.mutation(backfillProgress, { paginationOpts: { numItems: 2, cursor: first.continueCursor } })
    expect(second).toMatchObject({ isDone: true, processedCount: 1 })
    expect(await active.client.query(getMyProgress, {})).toEqual({ watching: 1, completed: 1, planned: 0, dropped: 0 })
    expect(await untouched.client.query(getMyProgress, {})).toEqual({ watching: 0, completed: 0, planned: 0, dropped: 0 })
    expect(await drifted.client.query(getMyProgress, {})).toEqual({ watching: 0, completed: 0, planned: 0, dropped: 1 })
    expect(await t.run(async (ctx) => await ctx.db.query('userAnimeProgress').collect())).toHaveLength(2)

    const repeatFirst = await t.mutation(backfillProgress, { paginationOpts: { numItems: 2, cursor: null } })
    const repeatSecond = await t.mutation(backfillProgress, { paginationOpts: { numItems: 2, cursor: repeatFirst.continueCursor } })
    expect(repeatFirst.updatedCount + repeatSecond.updatedCount).toBe(0)

    await t.run(async (ctx) => {
      const activeProgress = await ctx.db.query('userAnimeProgress').withIndex('by_user', (q) => q.eq('userId', activeId)).unique()
      if (!activeProgress) throw new Error('Expected active List Progress row.')
      await ctx.db.patch('userAnimeProgress', activeProgress._id, { completed: 99 })
      await ctx.db.insert('userAnimeProgress', { userId: untouchedId, watching: 0, completed: 0, planned: 0, dropped: 0 })
    })
    const verification = await t.mutation(verifyProgress, { paginationOpts: { numItems: 10, cursor: null } })
    expect(new Set(verification.mismatchUserIds)).toEqual(new Set([activeId, untouchedId]))
  })

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
    expect(await owner.client.query(getMyProgress, {})).toEqual({ watching: 0, completed: 0, planned: 0, dropped: 0 })
    expect(await t.run(async (ctx) => await ctx.db.query('userAnimeProgress').collect())).toEqual([])
    const milestones = await t.run(async (ctx) => await ctx.db.query('animeMilestones').collect())
    expect(milestones.map(({ kind, visibility }) => ({ kind, visibility }))).toEqual([
      { kind: 'completed', visibility: 'followers' },
      { kind: 'rewatched', visibility: 'followers' },
    ])
    expect(await owner.client.mutation(api.userAnime.removeLatestRewatch, { anilistId: 1 })).toMatchObject({
      status: 'saved', entry: { status: 'completed', rewatchCount: 0 },
    })
    expect(await owner.client.query(getMyProgress, {})).toEqual({ watching: 0, completed: 1, planned: 0, dropped: 0 })
    const afterRollback = await t.run(async (ctx) => ({
      completion: await ctx.db.query('animeMilestones').withIndex('by_user_anime_kind', (q) => q.eq('userId', ownerProfileId).eq('anilistId', 1).eq('kind', 'completed')).unique(),
      rewatch: await ctx.db.query('animeMilestones').withIndex('by_user_anime_kind', (q) => q.eq('userId', ownerProfileId).eq('anilistId', 1).eq('kind', 'rewatched')).unique(),
      completionCard: await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', `completed:${ownerProfileId}:1`)).unique(),
      rewatchCard: await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', `rewatched:${ownerProfileId}:1`)).unique(),
    }))
    expect(afterRollback.completion).not.toBeNull()
    expect(afterRollback.rewatch).toBeNull()
    expect(afterRollback.completionCard?.active).toBe(true)
    expect(afterRollback.rewatchCard?.active).toBe(false)

    await owner.client.mutation(api.userAnime.recordRewatch, { anilistId: 1 })
    expect(await owner.client.query(getMyProgress, {})).toEqual({ watching: 0, completed: 0, planned: 0, dropped: 0 })
    const bumpedCard = await t.run(async (ctx) => await ctx.db.query('feedCards')
      .withIndex('by_source_key', (q) => q.eq('sourceKey', `rewatched:${ownerProfileId}:1`)).unique())
    expect(bumpedCard?.active).toBe(true)
    expect(bumpedCard?.occurredAt).toBeGreaterThan(afterRollback.rewatchCard?.occurredAt ?? 0)

    const other = await createAuthUser(t, true, 'other')
    await insertProfile(t, other.authId, 'Other', 'private')
    expect(await other.client.query(api.userAnime.getMine, { anilistId: 1 })).toBeNull()
  }, 15_000)

  test('sets Watching only for the first non-null score on an unset entry', async () => {
    const t = createHarness()
    const owner = await createAuthUser(t, true, 'first-score')
    await insertProfile(t, owner.authId, 'FirstScore', 'private')
    await insertAnime(t, 1)
    await insertAnime(t, 2)

    expect(await owner.client.mutation(api.userAnime.setScore, { anilistId: 1, score: 8.1 })).toMatchObject({
      status: 'saved', entry: { anilistId: 1, score: 8.1, status: 'watching' },
    })
    expect(await owner.client.query(getMyProgress, {})).toEqual({ watching: 1, completed: 0, planned: 0, dropped: 0 })
    expect(await owner.client.mutation(api.userAnime.setScore, { anilistId: 1, score: 9 })).toMatchObject({
      status: 'saved', entry: { anilistId: 1, score: 9, status: 'watching' },
    })
    expect(await owner.client.query(getMyProgress, {})).toEqual({ watching: 1, completed: 0, planned: 0, dropped: 0 })

    await owner.client.mutation(api.userAnime.setStatus, { anilistId: 2, status: 'planned' })
    expect(await owner.client.mutation(api.userAnime.setScore, { anilistId: 2, score: 7.5 })).toMatchObject({
      status: 'saved', entry: { anilistId: 2, score: 7.5, status: 'planned' },
    })
    expect(await owner.client.query(getMyProgress, {})).toEqual({ watching: 1, completed: 0, planned: 1, dropped: 0 })
  })

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
