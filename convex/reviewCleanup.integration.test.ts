/// <reference types="vite/client" />

import { convexTest } from 'convex-test'
import type { FunctionReference } from 'convex/server'
import { describe, expect, test } from 'vitest'

import { internal } from './_generated/api'
import type { Doc, Id, TableNames } from './_generated/dataModel'
import schema from './schema'

const modules = import.meta.glob(['./_generated/**/*.*', './reviewCleanup.ts'])
// Generated API is controller-owned and intentionally not regenerated in this worker commit.
const cleanup = (internal as any).reviewCleanup
const createHarness = () => convexTest(schema, modules)

const listTable = async <TableName extends TableNames>(
  t: ReturnType<typeof createHarness>,
  table: TableName,
): Promise<Array<Doc<TableName>>> => await t.run(async (ctx) => await ctx.db.query(table).collect())

type CleanupPageResult = { cursor: string; isDone: boolean; processedCount: number; deletedCount: number }
type CleanupFunction = FunctionReference<'mutation', 'internal', {
  paginationOpts: { numItems: number; cursor: string | null }
}, CleanupPageResult>

const reviewFields = (userId: Id<'users'>, anilistId: number, index: number, state: 'draft' | 'published') => ({
  userId, anilistId, requestId: `review-${index}`, state, rating: state === 'published' ? 80 + index : null,
  summary: `Review ${index}`, summaryHasSpoiler: false, bodyJson: `{"private":"body-${index}"}`,
  visibility: state === 'published' ? 'public' as const : 'private' as const,
  ...(state === 'published' ? { publishedAt: index } : {}),
  updatedAt: index, activityState: 'active' as const,
  newestOrderKey: `new-${index}`, highRatingOrderKey: `high-${index}`, lowRatingOrderKey: `low-${index}`,
  searchText: `review ${index}`, ratingBand: state === 'published' ? '80-89' as const : 'none' as const,
})

describe('bounded Review cleanup', () => {
  test('inspects only aggregate page counts', async () => {
    const t = createHarness()
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {
        authId: 'inspect-owner', username: 'InspectOwner', usernameKey: 'inspectowner', name: 'Inspect Owner',
        visibility: 'private', createdAt: 1, updatedAt: 1,
      })
      await ctx.db.insert('reviews', reviewFields(userId, 1, 1, 'draft'))
      await ctx.db.insert('reviews', reviewFields(userId, 2, 2, 'published'))
      await ctx.db.insert('feedCards', {
        sourceKey: 'review:orphan', kind: 'review', userId, sourceId: 'orphan', anilistId: 1,
        visibility: 'private', active: true, orderKey: 'review-orphan', occurredAt: 1, updatedAt: 1,
      })
      await ctx.db.insert('animeReviewStats', { anilistId: 1, count: 1, ratingSum: 90, bands: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0], updatedAt: 1 })
    })

    const inspect = async (target: 'reviews' | 'reviewCards' | 'reviewStats') => await t.query(cleanup.inspectReviewDataPage, {
      target, paginationOpts: { numItems: 1, cursor: null },
    })

    expect(await inspect('reviews')).toMatchObject({ isDone: false, processedCount: 1 })
    expect(await inspect('reviewCards')).toMatchObject({ isDone: true, processedCount: 1 })
    expect(await inspect('reviewStats')).toMatchObject({ isDone: true, processedCount: 1 })
    expect(JSON.stringify(await inspect('reviews'))).not.toContain('private')
  })

  test('deletes Review data in resumable pages and preserves every unrelated document', async () => {
    const t = createHarness()
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {
        authId: 'cleanup-owner', username: 'CleanupOwner', usernameKey: 'cleanupowner', name: 'Cleanup Owner',
        visibility: 'public', createdAt: 1, updatedAt: 2,
      })
      await ctx.db.insert('animeSummaries', {
        anilistId: 1, slug: 'anime-1', titles: { display: 'Anime 1', english: null, romaji: null, native: null },
        coverImageUrl: null, bannerImageUrl: null, format: 'TV', season: null, seasonYear: 2024, episodes: 12,
        genres: ['Fantasy'], popularity: 1, averageScore: 80, trending: 1, startDate: null, nextAiringAt: null, updatedAt: 3,
      })
      const entryId = await ctx.db.insert('userAnimeEntries', {
        userId, anilistId: 1, status: 'rewatched', score: 9, favoriteAt: 4,
        rewatchCount: 1, lastRewatchSequence: 1, createdAt: 4, updatedAt: 4,
      })
      await ctx.db.insert('animeRewatchEntries', { entryId, userId, anilistId: 1, completedAt: 5, sequence: 1 })
      await ctx.db.insert('animeMilestones', { userId, anilistId: 1, kind: 'completed', visibility: 'public', occurredAt: 6, updatedAt: 6 })
      await ctx.db.insert('animeMilestones', { userId, anilistId: 1, kind: 'rewatched', visibility: 'public', occurredAt: 7, updatedAt: 7 })
      const postId = await ctx.db.insert('posts', {
        userId, requestId: 'post-1', text: 'Keep post', hasSpoiler: false, visibility: 'public', media: null, createdAt: 8, updatedAt: 8,
      })
      for (const kind of ['post', 'completed', 'rewatched'] as const) {
        await ctx.db.insert('feedCards', {
          sourceKey: `${kind}:keep`, kind, userId, sourceId: kind === 'post' ? postId : undefined, anilistId: kind === 'post' ? undefined : 1,
          visibility: 'public', active: true, orderKey: `${kind}-keep`, occurredAt: 9, updatedAt: 9,
        })
      }
      const linkedIds: Id<'reviews'>[] = []
      for (let index = 1; index <= 3; index += 1) {
        const reviewId = await ctx.db.insert('reviews', reviewFields(userId, index, index, index === 3 ? 'draft' : 'published'))
        linkedIds.push(reviewId)
      }
      for (const reviewId of linkedIds.slice(0, 2)) {
        await ctx.db.insert('feedCards', {
          sourceKey: `review:${reviewId}`, kind: 'review', userId, sourceId: reviewId, anilistId: 1,
          visibility: 'public', active: true, orderKey: `review-${reviewId}`, occurredAt: 10, updatedAt: 10,
        })
      }
      await ctx.db.insert('feedCards', {
        sourceKey: 'review:orphan', kind: 'review', userId, sourceId: 'orphan', anilistId: 1,
        visibility: 'public', active: true, orderKey: 'review-orphan', occurredAt: 11, updatedAt: 11,
      })
      await ctx.db.insert('animeReviewStats', { anilistId: 1, count: 2, ratingSum: 163, bands: [0, 2, 0, 0, 0, 0, 0, 0, 0, 0], updatedAt: 12 })
      await ctx.db.insert('animeReviewStats', { anilistId: 2, count: 0, ratingSum: 0, bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], updatedAt: 13 })
    })

    const preservedTables = ['users', 'animeSummaries', 'userAnimeEntries', 'animeRewatchEntries', 'animeMilestones', 'posts'] as const
    const before = Object.fromEntries(await Promise.all(preservedTables.map(async (table) => [table, await listTable(t, table)])))
    const nonReviewCardsBefore = (await listTable(t, 'feedCards')).filter((card) => card.kind !== 'review')

    const runPages = async (fn: CleanupFunction, pageSize: number) => {
      const results: CleanupPageResult[] = []
      let cursor: string | null = null
      do {
        const result: CleanupPageResult = await t.mutation(fn, { paginationOpts: { numItems: pageSize, cursor } })
        results.push(result)
        cursor = result.cursor
      } while (!results.at(-1)?.isDone)
      return results
    }

    const reviewPages = await runPages(cleanup.cleanupReviewsPage, 2)
    expect(reviewPages.map((page) => page.processedCount)).toEqual([2, 1])
    expect(reviewPages.reduce((sum, page) => sum + page.deletedCount, 0)).toBe(3)
    const orphanPages = await runPages(cleanup.cleanupOrphanReviewCardsPage, 1)
    expect(orphanPages.reduce((sum, page) => sum + page.deletedCount, 0)).toBe(1)
    const statPages = await runPages(cleanup.cleanupReviewStatsPage, 1)
    expect(statPages.map((page) => page.deletedCount)).toEqual([1, 1])

    expect(await listTable(t, 'reviews')).toEqual([])
    expect((await listTable(t, 'feedCards')).filter((card) => card.kind === 'review')).toEqual([])
    expect(await listTable(t, 'animeReviewStats')).toEqual([])
    expect((await listTable(t, 'feedCards')).filter((card) => card.kind !== 'review')).toEqual(nonReviewCardsBefore)
    for (const table of preservedTables) expect(await listTable(t, table)).toEqual(before[table])

    expect(await runPages(cleanup.cleanupReviewsPage, 2)).toEqual([expect.objectContaining({ isDone: true, processedCount: 0, deletedCount: 0 })])
    expect(await runPages(cleanup.cleanupOrphanReviewCardsPage, 2)).toEqual([expect.objectContaining({ isDone: true, processedCount: 0, deletedCount: 0 })])
    expect(await runPages(cleanup.cleanupReviewStatsPage, 2)).toEqual([expect.objectContaining({ isDone: true, processedCount: 0, deletedCount: 0 })])
  })
})
