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
    profileVisibility: 'public', visibility: 'public', createdAt: now, updatedAt: now,
  }))
  return { profileId, client: t.withIdentity({ subject: user._id, sessionId: session._id } as never) }
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
  test('rejects missing or conflicting Review aggregate entity refs', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'aggregate-identity')
    const animeId = await insertAnime(t, 701)
    const reviewId = await owner.client.mutation(socialApi.reviews.publish, {
      animeId, requestId: 'aggregate-identity', rating: 90,
      summary: 'Aggregate identity', containsSpoiler: false, bodyJson, visibility: 'public',
    })
    const ids = await t.run(async (ctx) => {
      const stats = await ctx.db.query('animeReviewStats').withIndex('by_anilist_id', (q) => q.eq('anilistId', 701)).unique()
      if (!stats) throw new Error('Expected Review aggregate.')
      await ctx.db.patch('animeReviewStats', stats._id, { animeId: undefined })
      const conflictId = await ctx.db.insert('catalogEntities', { kind: 'anime', createdAt: 1, updatedAt: 1 })
      return { statsId: stats._id, conflictId }
    })
    const repeated = {
      animeId, requestId: 'aggregate-identity', rating: 90,
      summary: 'Aggregate identity', containsSpoiler: false, bodyJson, visibility: 'public',
    }
    await expect(owner.client.mutation(socialApi.reviews.publish, repeated)).rejects.toThrow()
    expect((await t.run(async (ctx) => await ctx.db.get('animeReviewStats', ids.statsId)))?.animeId).toBeUndefined()
    await t.run(async (ctx) => await ctx.db.patch('animeReviewStats', ids.statsId, { animeId }))
    expect(await owner.client.mutation(socialApi.reviews.publish, repeated)).toBe(reviewId)
    await t.run(async (ctx) => await ctx.db.patch('animeReviewStats', ids.statsId, { animeId: ids.conflictId }))
    await expect(owner.client.mutation(socialApi.reviews.publish, repeated)).rejects.toThrow('conflicts with provider mapping')
  })

  test('rejects legacy milestone and card refs without runtime repair', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'legacy-milestone-update')
    const animeId = await insertAnime(t, 702)
    const cardId = await t.run(async (ctx) => {
      const milestoneId = await ctx.db.insert('animeMilestones', {
        userId: owner.profileId, anilistId: 702, kind: 'completed',
        visibility: 'public', occurredAt: 10, updatedAt: 10,
      })
      const sourceKey = `completed:${owner.profileId}:702`
      const cardId = await ctx.db.insert('feedCards', {
        sourceKey, kind: 'completed', userId: owner.profileId, anilistId: 702,
        visibility: 'public', active: true, orderKey: makeOrderKey(10, sourceKey),
        occurredAt: 10, updatedAt: 10,
      })
      return { milestoneId, cardId }
    })
    await expect(owner.client.mutation(socialApi.feed.setActivityVisibility, {
      cardId: cardId.cardId,
      visibility: 'private',
    })).rejects.toThrow()
    const rows = await t.run(async (ctx) => ({
      milestone: await ctx.db.get('animeMilestones', cardId.milestoneId),
      card: await ctx.db.get('feedCards', cardId.cardId),
    }))
    expect(rows.milestone).toMatchObject({ visibility: 'public' })
    expect(rows.milestone).not.toHaveProperty('animeId')
    expect(rows.card).toMatchObject({ visibility: 'public', active: true })
    expect(rows.card).not.toHaveProperty('animeId')
    await expect(owner.client.mutation(socialApi.feed.removeActivity, { cardId: cardId.cardId })).rejects.toThrow()
    expect((await t.run(async (ctx) => await ctx.db.get('feedCards', cardId.cardId)))?.active).toBe(true)
    expect(animeId).toBeDefined()
  })

  test('rejects conflicting milestone cards and preserves stable order keys', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'milestone-card-conflict')
    const animeId = await insertAnime(t, 703)
    const rows = await t.run(async (ctx) => {
      const otherAnimeId = await ctx.db.insert('catalogEntities', { kind: 'anime', createdAt: 1, updatedAt: 1 })
      const milestoneId = await ctx.db.insert('animeMilestones', {
        userId: owner.profileId, anilistId: 703, animeId, kind: 'completed',
        visibility: 'public', occurredAt: 20, updatedAt: 20,
      })
      const sourceKey = `completed:${owner.profileId}:${animeId}`
      const cardId = await ctx.db.insert('feedCards', {
        sourceKey, kind: 'completed', userId: owner.profileId, anilistId: 703,
        animeId: otherAnimeId, visibility: 'public', active: true,
        orderKey: 'preserved-order', occurredAt: 20, updatedAt: 20,
      })
      return { milestoneId, cardId, otherAnimeId }
    })
    await expect(t.mutation(socialInternal.feed.projectMilestones, {
      paginationOpts: { numItems: 10, cursor: null },
    })).rejects.toThrow('conflicts with milestone')
    await t.run(async (ctx) => await ctx.db.patch('feedCards', rows.cardId, { animeId: undefined }))
    await expect(t.mutation(socialInternal.feed.projectMilestones, {
      paginationOpts: { numItems: 10, cursor: null },
    })).rejects.toThrow()
    expect((await t.run(async (ctx) => await ctx.db.get('feedCards', rows.cardId)))?.orderKey).toBe('preserved-order')
  })

  test('dual-writes one existing Anime entity to Review, aggregate, and Review feed card', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'review-entity-write')
    const animeId = await insertAnime(t, 601)
    const reviewId = await owner.client.mutation(socialApi.reviews.publish, {
      animeId,
      requestId: 'review-entity-write',
      rating: 91,
      summary: 'Entity linked Review',
      containsSpoiler: false,
      bodyJson,
      visibility: 'public',
    })

    const rows = await t.run(async (ctx) => ({
      review: await ctx.db.get('reviews', reviewId),
      stats: await ctx.db.query('animeReviewStats').withIndex('by_anilist_id', (q) => q.eq('anilistId', 601)).unique(),
      card: await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', `review:${reviewId}`)).unique(),
      entities: await ctx.db.query('catalogEntities').collect(),
    }))
    expect(rows.review?.animeId).toBe(animeId)
    expect(rows.stats?.animeId).toBe(animeId)
    expect(rows.card?.animeId).toBe(animeId)
    expect(rows.entities).toHaveLength(1)
  })

  test('discovers latest Public Reviews without leaking viewer-owned visibility', async () => {
    const t = createHarness()
    const viewer = await createOwner(t, 'discovery-viewer')
    const authors = await Promise.all(Array.from({ length: 7 }, (_, index) => createOwner(t, `latest-${index}`)))
    const animeIds = await Promise.all(Array.from({ length: 10 }, (_, index) => insertAnime(t, index + 1)))

    for (let index = 0; index < authors.length; index += 1) {
      await authors[index]!.client.mutation(socialApi.reviews.publish, {
        animeId: animeIds[index]!, requestId: `latest-${index}`, rating: 50 + index,
        summary: `Latest ${index}`, containsSpoiler: false, bodyJson, visibility: 'public',
      })
    }
    const followersId = await viewer.client.mutation(socialApi.reviews.publish, {
      animeId: animeIds[7]!, requestId: 'own-followers', rating: 88,
      summary: 'Own Followers', containsSpoiler: false, bodyJson, visibility: 'followers',
    })
    const privateId = await viewer.client.mutation(socialApi.reviews.publish, {
      animeId: animeIds[8]!, requestId: 'own-private', rating: 77,
      summary: 'Own Private', containsSpoiler: false, bodyJson, visibility: 'private',
    })

    const latest = await t.query(socialApi.reviews.listLatestPublic, { limit: 99 })
    expect(latest).toHaveLength(5)
    expect(latest.map((review: { summary: string }) => review.summary)).toEqual(['Latest 6', 'Latest 5', 'Latest 4', 'Latest 3', 'Latest 2'])

    const publicPage = await t.query(socialApi.reviews.listDiscovery, {
      query: null, sort: 'newest', ratingBand: null, visibility: 'all', cursor: null,
    })
    expect(publicPage.items).toHaveLength(7)
    expect(publicPage.items.map((review: { id: string }) => review.id)).not.toContain(followersId)
    expect(publicPage.items.map((review: { id: string }) => review.id)).not.toContain(privateId)

    const ownPage = await viewer.client.query(socialApi.reviews.listDiscovery, {
      query: null, sort: 'newest', ratingBand: null, visibility: 'all', cursor: null,
    })
    expect(ownPage.items.map((review: { id: string }) => review.id)).toEqual(expect.arrayContaining([followersId, privateId]))

    await viewer.client.mutation(socialApi.reviews.setVisibility, { reviewId: followersId, visibility: 'public' })
    expect((await t.query(socialApi.reviews.listDiscovery, {
      query: null, sort: 'newest', ratingBand: null, visibility: 'public', cursor: null,
    })).items.map((review: { id: string }) => review.id)).toContain(followersId)
    await viewer.client.mutation(socialApi.reviews.remove, { reviewId: privateId })
    expect((await viewer.client.query(socialApi.reviews.listDiscovery, {
      query: null, sort: 'newest', ratingBand: null, visibility: 'all', cursor: null,
    })).items.map((review: { id: string }) => review.id)).not.toContain(privateId)
  }, 30_000)

  test('sorts, filters every decimal Rating-band boundary, and searches indexed Review metadata', async () => {
    const t = createHarness()
    const ratings = [100, 90, 89.9, 80, 79.9, 70, 69.9, 60, 59.9, 50, 49.9, 40, 39.9, 30, 29.9, 20, 19.9, 10, 9.9, 0]
    const authors = await Promise.all(ratings.map((_, index) => createOwner(t, `band-user-${index}`)))
    const animeIds = await Promise.all(ratings.map((_, index) => insertAnime(t, index + 1)))
    await t.run(async (ctx) => {
      await ctx.db.patch('users', authors[4]!.profileId, { name: 'Search Display', username: 'SearchHandle', usernameKey: 'searchhandle' })
      const anime = await ctx.db.query('animeSummaries').withIndex('by_anilist_id', (q) => q.eq('anilistId', 5)).unique()
      if (!anime) throw new Error('Expected cached Anime 5.')
      await ctx.db.patch('animeSummaries', anime._id, { titles: { ...anime.titles, display: 'Unique Frieren' } })
    })
    for (let index = 0; index < ratings.length; index += 1) {
      await authors[index]!.client.mutation(socialApi.reviews.publish, {
        animeId: animeIds[index]!, requestId: `band-${index}`, rating: ratings[index]!,
        summary: `Band ${index}`, containsSpoiler: false, bodyJson, visibility: 'public',
      })
    }

    const read = async (sort: 'newest' | 'rating-high' | 'rating-low', ratingBand: string | null, query: string | null) => await t.query(socialApi.reviews.listDiscovery, {
      query, sort, ratingBand, visibility: 'public', cursor: null,
    })
    expect((await read('rating-high', null, null)).items.map((review: { rating: number }) => review.rating)).toEqual(ratings.slice(0, 12))
    expect((await read('rating-low', null, null)).items.map((review: { rating: number }) => review.rating)).toEqual([...ratings].reverse().slice(0, 12))
    const newestItems: Array<{ summary: string }> = []
    let newestCursor: string | null = null
    do {
      const page: { items: Array<{ summary: string }>; cursor: string | null } = await t.query(socialApi.reviews.listDiscovery, {
        query: null, sort: 'newest', ratingBand: null, visibility: 'public', cursor: newestCursor,
      })
      newestItems.push(...page.items)
      newestCursor = page.cursor
    } while (newestCursor !== null)
    expect(newestItems[0]?.summary).toBe('Band 19')

    const bands = ['90-100', '80-89', '70-79', '60-69', '50-59', '40-49', '30-39', '20-29', '10-19', '0-9']
    for (let index = 0; index < bands.length; index += 1) {
      expect((await read('newest', bands[index]!, null)).items.map((review: { rating: number }) => review.rating)).toEqual(ratings.slice(index * 2, (index * 2) + 2).reverse())
    }
    expect((await read('newest', null, 'Frieren')).items).toHaveLength(1)
    expect((await read('newest', null, 'Search Display')).items).toHaveLength(1)
    expect((await read('newest', null, 'SearchHandle')).items).toHaveLength(1)
  }, 30_000)

  test('continues composite discovery cursors without duplicates and permits retry', async () => {
    const t = createHarness()
    const viewer = await createOwner(t, 'cursor-viewer')
    const authors = await Promise.all(Array.from({ length: 14 }, (_, index) => createOwner(t, `cursor-author-${index}`)))
    const animeIds = await Promise.all(Array.from({ length: 16 }, (_, index) => insertAnime(t, index + 1)))
    await t.run(async (ctx) => {
      for (let index = 1; index <= 16; index += 1) {
        const anime = await ctx.db.query('animeSummaries').withIndex('by_anilist_id', (q) => q.eq('anilistId', index)).unique()
        if (!anime) throw new Error(`Expected cached Anime ${index}.`)
        await ctx.db.patch('animeSummaries', anime._id, { titles: { ...anime.titles, display: `葬送 Anime ${index}` } })
      }
    })
    for (let index = 0; index < authors.length; index += 1) {
      await authors[index]!.client.mutation(socialApi.reviews.publish, {
        animeId: animeIds[index]!, requestId: `cursor-${index}`, rating: 60 + index,
        summary: `Cursor public ${index}`, containsSpoiler: false, bodyJson, visibility: 'public',
      })
    }
    await viewer.client.mutation(socialApi.reviews.publish, {
      animeId: animeIds[14]!, requestId: 'cursor-followers', rating: 88,
      summary: 'Cursor own followers', containsSpoiler: false, bodyJson, visibility: 'followers',
    })
    await viewer.client.mutation(socialApi.reviews.publish, {
      animeId: animeIds[15]!, requestId: 'cursor-private', rating: 77,
      summary: 'Cursor own private', containsSpoiler: false, bodyJson, visibility: 'private',
    })
    const input = { query: null, sort: 'newest', ratingBand: null, visibility: 'all', cursor: null }
    const first = await viewer.client.query(socialApi.reviews.listDiscovery, input)
    expect(first.items).toHaveLength(12)
    expect(first.hasMore).toBe(true)
    const retryInput = { ...input, cursor: first.cursor }
    const second = await viewer.client.query(socialApi.reviews.listDiscovery, retryInput)
    expect(await viewer.client.query(socialApi.reviews.listDiscovery, retryInput)).toEqual(second)
    expect(second.hasMore).toBe(false)
    expect(second.cursor).toBeNull()
    const ids = [...first.items, ...second.items].map((review: { id: string }) => review.id)
    expect(ids).toHaveLength(16)
    expect(new Set(ids).size).toBe(16)

    const searchFirst = await viewer.client.query(socialApi.reviews.listDiscovery, {
      query: '葬送', sort: 'newest', ratingBand: null, visibility: 'all', cursor: null,
    })
    expect(searchFirst.items.map((review: { summary: string }) => review.summary)).toEqual(['Cursor own followers'])
    const searchIds: string[] = [...searchFirst.items.map((review: { id: string }) => review.id)]
    const searchRetryInput = { query: '葬送', sort: 'newest', ratingBand: null, visibility: 'all', cursor: searchFirst.cursor }
    const searchSecond = await viewer.client.query(socialApi.reviews.listDiscovery, searchRetryInput)
    expect(await viewer.client.query(socialApi.reviews.listDiscovery, searchRetryInput)).toEqual(searchSecond)
    searchIds.push(...searchSecond.items.map((review: { id: string }) => review.id))
    let searchCursor = searchSecond.cursor
    while (searchCursor !== null) {
      const page = await viewer.client.query(socialApi.reviews.listDiscovery, {
        query: '葬送', sort: 'newest', ratingBand: null, visibility: 'all', cursor: searchCursor,
      })
      searchIds.push(...page.items.map((review: { id: string }) => review.id))
      searchCursor = page.cursor
    }
    expect(searchIds).toHaveLength(16)
    expect(new Set(searchIds).size).toBe(16)
  }, 30_000)

  test('backfills and verifies every Draft and published Review page', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'discovery-backfill')
    const draftAnimeId = await insertAnime(t, 1)
    const publishedAnimeId = await insertAnime(t, 2)
    const draftId = await owner.client.mutation(socialApi.reviews.saveDraft, {
      animeId: draftAnimeId, requestId: 'backfill-draft', rating: null, summary: '',
      containsSpoiler: false, bodyJson, visibility: 'private',
    })
    const publishedId = await owner.client.mutation(socialApi.reviews.publish, {
      animeId: publishedAnimeId, requestId: 'backfill-published', rating: 90, summary: 'Published',
      containsSpoiler: false, bodyJson, visibility: 'public',
    })
    await t.run(async (ctx) => {
      await ctx.db.patch('reviews', draftId, { searchText: 'stale draft', ratingBand: '0-9' })
      await ctx.db.patch('reviews', publishedId, { searchText: 'stale published', ratingBand: '0-9' })
    })

    const first = await t.mutation(socialInternal.reviews.backfillDiscoveryFields, { paginationOpts: { numItems: 1, cursor: null } })
    const second = await t.mutation(socialInternal.reviews.backfillDiscoveryFields, { paginationOpts: { numItems: 1, cursor: first.continueCursor } })
    expect(first).toMatchObject({ processedCount: 1, updatedCount: 1, isDone: false })
    expect(second).toMatchObject({ processedCount: 1, updatedCount: 1, isDone: true })

    const verifyFirst = await t.mutation(socialInternal.reviews.verifyDiscoveryBackfill, { paginationOpts: { numItems: 1, cursor: null } })
    const verifySecond = await t.mutation(socialInternal.reviews.verifyDiscoveryBackfill, { paginationOpts: { numItems: 1, cursor: verifyFirst.continueCursor } })
    expect([...verifyFirst.mismatchIds, ...verifySecond.mismatchIds]).toEqual([])
    expect(await t.run(async (ctx) => ({
      draftBand: (await ctx.db.get('reviews', draftId))?.ratingBand,
      publishedBand: (await ctx.db.get('reviews', publishedId))?.ratingBand,
    }))).toEqual({ draftBand: 'none', publishedBand: '90-100' })
  }, 20_000)

  test('allows unrated Draft projection but rejects published Review without Rating', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'null-rating-backfill')
    const draftAnimeId = await insertAnime(t, 1)
    const publishedAnimeId = await insertAnime(t, 2)
    const draftId = await owner.client.mutation(socialApi.reviews.saveDraft, {
      animeId: draftAnimeId, requestId: 'null-rating-draft', rating: null, summary: '',
      containsSpoiler: false, bodyJson, visibility: 'private',
    })
    await t.run(async (ctx) => await ctx.db.patch('reviews', draftId, { searchText: 'stale', ratingBand: '0-9' }))
    await t.mutation(socialInternal.reviews.backfillDiscoveryFields, { paginationOpts: { numItems: 1, cursor: null } })
    expect(await t.run(async (ctx) => (await ctx.db.get('reviews', draftId))?.ratingBand)).toBe('none')

    await t.run(async (ctx) => {
      await ctx.db.insert('reviews', {
        userId: owner.profileId, anilistId: 2, animeId: publishedAnimeId,
        requestId: 'corrupt-published-null', state: 'published', rating: null,
        summary: 'Corrupt', containsSpoiler: false, bodyJson, visibility: 'public', publishedAt: 1,
        updatedAt: 1, activityState: 'active', newestOrderKey: 'corrupt', highRatingOrderKey: 'corrupt', lowRatingOrderKey: 'corrupt',
        searchText: 'corrupt', ratingBand: 'none',
      })
    })
    await expect(t.mutation(socialInternal.reviews.backfillDiscoveryFields, {
      paginationOpts: { numItems: 10, cursor: null },
    })).rejects.toThrow('Published Review requires a Rating')
    await expect(t.mutation(socialInternal.reviews.verifyDiscoveryBackfill, {
      paginationOpts: { numItems: 10, cursor: null },
    })).rejects.toThrow('Published Review requires a Rating')
  }, 20_000)

  test('rejects activity removal for Draft Reviews without changing projection state', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'draft-activity-owner')
    const animeId = await insertAnime(t, 1)
    const reviewId = await owner.client.mutation(socialApi.reviews.saveDraft, {
      animeId, requestId: 'draft-activity', rating: null, summary: '',
      containsSpoiler: false, bodyJson, visibility: 'private',
    })
    const before = await t.run(async (ctx) => await ctx.db.get('reviews', reviewId))

    await expect(owner.client.mutation(socialApi.reviews.removeActivity, { reviewId })).rejects.toThrow('published Reviews')

    const after = await t.run(async (ctx) => await ctx.db.get('reviews', reviewId))
    expect(after).toMatchObject({ state: 'draft', activityState: 'active', searchText: before?.searchText, ratingBand: 'none' })
  }, 20_000)

  test('fails discovery hydration when indexed Review author source is missing', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'missing-discovery-author')
    const animeId = await insertAnime(t, 1)
    await owner.client.mutation(socialApi.reviews.publish, {
      animeId, requestId: 'missing-discovery-author', rating: 75, summary: 'Source required',
      containsSpoiler: false, bodyJson, visibility: 'public',
    })
    await t.run(async (ctx) => await ctx.db.delete('users', owner.profileId))

    await expect(t.query(socialApi.reviews.listDiscovery, {
      query: null, sort: 'newest', ratingBand: null, visibility: 'public', cursor: null,
    })).rejects.toThrow('author profile is missing')
  }, 20_000)

  test('resumes one Review, publishes idempotently, isolates visibility, and updates metrics', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'owner')
    const viewer = await createOwner(t, 'viewer')
    const animeId = await insertAnime(t, 1)

    await expect(t.mutation(socialApi.reviews.saveDraft, {
      animeId, requestId: 'signed-out', rating: null, summary: '', containsSpoiler: false,
      bodyJson, visibility: 'private',
    })).rejects.toThrow('Unauthenticated')
    await expect(owner.client.mutation(socialApi.reviews.saveDraft, {
      animeId, requestId: 'forged-owner', rating: null, summary: '', containsSpoiler: false,
      bodyJson, visibility: 'private', userId: viewer.profileId,
    })).rejects.toThrow('Validator error')

    const draftId = await owner.client.mutation(socialApi.reviews.saveDraft, {
      animeId, requestId: 'draft-1', rating: null, summary: '', containsSpoiler: false,
      bodyJson, visibility: 'private',
    })
    const draft = await owner.client.query(socialApi.reviews.getById, { reviewId: draftId })
    expect(draft).toMatchObject({ id: draftId, state: 'draft' })
    expect(JSON.parse(draft.bodyJson)).toEqual(body)
    expect(await viewer.client.query(socialApi.reviews.getById, { reviewId: draftId })).toBeNull()
    expect(await owner.client.mutation(socialApi.reviews.saveDraft, {
      animeId, requestId: 'draft-2', rating: 80, summary: 'Draft', containsSpoiler: false,
      bodyJson, visibility: 'private',
    })).toBe(draftId)

    const publishedId = await owner.client.mutation(socialApi.reviews.publish, {
      animeId, requestId: 'publish-1', rating: 95, summary: 'Great', containsSpoiler: false,
      bodyJson, visibility: 'public',
    })
    expect(publishedId).toBe(draftId)
    const reviewFeed = await viewer.client.query(socialApi.feed.listGlobal, { cursor: null })
    expect(reviewFeed.items).toContainEqual(expect.objectContaining({ kind: 'review', reviewId: draftId }))
    expect(await owner.client.mutation(socialApi.reviews.publish, {
      animeId, requestId: 'publish-1', rating: 95, summary: 'Great', containsSpoiler: false,
      bodyJson, visibility: 'public',
    })).toBe(draftId)
    expect(await viewer.client.query(socialApi.reviews.getStats, { animeId })).toMatchObject({ count: 1, average: 95, bands: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] })

    await owner.client.mutation(socialApi.reviews.setVisibility, { reviewId: draftId, visibility: 'followers' })
    expect(await viewer.client.query(socialApi.reviews.getById, { reviewId: draftId })).toBeNull()
    expect(await owner.client.query(socialApi.reviews.getById, { reviewId: draftId })).not.toBeNull()
    expect(await viewer.client.query(socialApi.reviews.getStats, { animeId })).toMatchObject({ count: 0, average: null })
    expect(await owner.client.query(socialApi.reviews.getStats, { animeId })).toMatchObject({ count: 1, average: 95 })

    await owner.client.mutation(socialApi.reviews.update, {
      reviewId: draftId, rating: 85, summary: 'Updated', containsSpoiler: true, bodyJson, visibility: 'public',
    })
    expect(await viewer.client.query(socialApi.reviews.getStats, { animeId })).toMatchObject({ count: 1, average: 85, bands: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0] })
    await owner.client.mutation(socialApi.reviews.removeActivity, { reviewId: draftId })
    expect(await t.run(async (ctx) => (await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', `review:${draftId}`)).unique())?.active)).toBe(false)
    await owner.client.mutation(socialApi.reviews.update, {
      reviewId: draftId, rating: 80, summary: 'Still hidden', containsSpoiler: false, bodyJson, visibility: 'public',
    })
    expect(await t.run(async (ctx) => (await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', `review:${draftId}`)).unique())?.active)).toBe(false)
    await owner.client.mutation(socialApi.reviews.remove, { reviewId: draftId })
    expect(await owner.client.query(socialApi.reviews.getMineForAnime, { animeId })).toBeNull()
    expect(await viewer.client.query(socialApi.reviews.getStats, { animeId })).toMatchObject({ count: 0, average: null })
  }, 20_000)

  test('stores validated Review bodies as bounded canonical JSON', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'canonical-review-owner')
    const animeId = await insertAnime(t, 1)
    const paddedBodyJson = `${' '.repeat((64 * 1024) + 1)}${bodyJson}`

    const reviewId = await owner.client.mutation(socialApi.reviews.saveDraft, {
      animeId, requestId: 'canonical-review', rating: null, summary: '', containsSpoiler: false,
      bodyJson: paddedBodyJson, visibility: 'private',
    })

    const stored = await owner.client.query(socialApi.reviews.getById, { reviewId })
    expect(JSON.parse(stored?.bodyJson)).toEqual(body)
    expect(stored?.bodyJson).toBe(JSON.stringify(JSON.parse(stored?.bodyJson)))
    expect(new TextEncoder().encode(stored?.bodyJson).byteLength).toBeLessThanOrEqual(64 * 1024)
  }, 20_000)

  test('creates media-only Post, replaces and removes media, then deletes its feed projection', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'poster')
    const image = { type: 'image', url: 'https://example.com/image.jpg', description: null } as const
    const video = { type: 'video', url: 'https://vimeo.com/123', provider: 'vimeo', label: 'Trailer' } as const
    const postId = await owner.client.mutation(socialApi.posts.create, {
      requestId: 'post-1', text: '', media: image, hasSpoiler: false, visibility: 'public',
    })
    expect(await owner.client.query(socialApi.feed.listGlobal, { cursor: null })).toMatchObject({
      items: [expect.objectContaining({ kind: 'post', postId, media: image })],
    })
    await owner.client.mutation(socialApi.posts.update, {
      postId, requestId: 'post-update-1', text: 'edited', media: video, hasSpoiler: true, visibility: 'followers',
    })
    expect(await t.run(async (ctx) => await ctx.db.get('posts', postId))).toMatchObject({ media: video })
    await owner.client.mutation(socialApi.posts.update, {
      postId, requestId: 'post-update-2', text: 'text only', media: null, hasSpoiler: false, visibility: 'private',
    })
    await owner.client.mutation(socialApi.posts.remove, { postId })
    expect(await t.run(async (ctx) => await ctx.db.get('posts', postId))).toBeNull()
    expect(await t.run(async (ctx) => await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', `post:${postId}`)).unique())).toBeNull()
  }, 20_000)

  test('rejects non-owner Post mutations without changing source or feed projection', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'post-owner')
    const other = await createOwner(t, 'post-other')
    const media = { type: 'image', url: 'https://example.com/owned.jpg', description: 'Owned' } as const
    const postId = await owner.client.mutation(socialApi.posts.create, {
      requestId: 'owned-post', text: 'Owner text', media, hasSpoiler: false, visibility: 'public',
    })
    const before = await t.run(async (ctx) => ({
      post: await ctx.db.get('posts', postId),
      card: await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', `post:${postId}`)).unique(),
    }))

    await expect(other.client.mutation(socialApi.posts.update, {
      postId, requestId: 'forged-update', text: 'Forged', media: null, hasSpoiler: true, visibility: 'private',
    })).rejects.toThrow('Only the Post owner')
    await expect(other.client.mutation(socialApi.posts.remove, { postId })).rejects.toThrow('Only the Post owner')
    await expect(other.client.mutation(socialApi.posts.setVisibility, {
      postId, visibility: 'private',
    })).rejects.toThrow('Only the Post owner')

    expect(await t.run(async (ctx) => ({
      post: await ctx.db.get('posts', postId),
      card: await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', `post:${postId}`)).unique(),
    }))).toEqual(before)
  }, 20_000)

  test('rejects invalid external Post media and removed upload writers', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'post-media-validation')
    const base = { requestId: 'invalid-media', text: '', hasSpoiler: false, visibility: 'public' }
    for (const media of [
      { type: 'image', url: 'http://example.com/image.jpg', description: null },
      { type: 'image', url: 'https://user:pass@example.com/image.jpg', description: null },
      { type: 'image', url: `https://example.com/${'x'.repeat(2049)}`, description: null },
      { type: 'video', url: 'https://youtube.com/watch?v=abc', provider: 'vimeo', label: null },
    ]) await expect(owner.client.mutation(socialApi.posts.create, { ...base, media })).rejects.toThrow()

    await expect(owner.client.mutation(socialApi.posts.generateUploadUrl, { claimId: 'removed-upload' })).rejects.toThrow('no such export')
    await expect(owner.client.mutation(socialApi.posts.registerImage, {
      claimId: 'removed-register', storageId: 'storage', mimeType: 'image/png', size: 1, width: 1, height: 1,
    })).rejects.toThrow('no such export')
    await expect(owner.client.mutation(socialApi.posts.discardImage, { imageId: 'image' })).rejects.toThrow('no such export')
  }, 20_000)

  test('shows public Global cards and dedupes owner-prioritized Home cards', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'feed-owner')
    const other = await createOwner(t, 'feed-other')
    for (const requestId of ['owner-1', 'owner-2']) {
      await owner.client.mutation(socialApi.posts.create, {
        requestId, text: requestId, media: null, hasSpoiler: false, visibility: 'public',
      })
    }
    await other.client.mutation(socialApi.posts.create, {
      requestId: 'global-1', text: 'global', media: null, hasSpoiler: false, visibility: 'public',
    })

    const global = await t.query(socialApi.feed.listGlobal, { cursor: null })
    expect(global.items).toHaveLength(3)
    const home = await owner.client.query(socialApi.feed.listHome, { cursor: null })
    expect(home.items).toHaveLength(3)
    expect(new Set(home.items.map((item: { id: string }) => item.id)).size).toBe(3)
    expect(home.items.slice(0, 2).every((item: { author: { username: string } }) => item.author.username === 'feed-owner')).toBe(true)
  }, 20_000)

  test('suppresses corrupt Post projections and authorizes from Post source truth', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'source-post-owner')
    const other = await createOwner(t, 'source-post-other')
    const viewer = await createOwner(t, 'source-post-viewer')
    const postId = await owner.client.mutation(socialApi.posts.create, {
      requestId: 'source-post', text: 'Source Post', media: null, hasSpoiler: false, visibility: 'public',
    })
    const otherPostId = await other.client.mutation(socialApi.posts.create, {
      requestId: 'source-post-other', text: 'Other Post', media: null, hasSpoiler: false, visibility: 'public',
    })
    const privatePostId = await owner.client.mutation(socialApi.posts.create, {
      requestId: 'source-post-private', text: 'Private Post', media: null, hasSpoiler: false, visibility: 'private',
    })
    const cards = await t.run(async (ctx) => ({
      card: await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', `post:${postId}`)).unique(),
      privateCard: await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', `post:${privatePostId}`)).unique(),
    }))
    if (!cards.card || !cards.privateCard) throw new Error('Expected Post feed projections.')

    expect(await viewer.client.query(socialApi.feed.getById, { cardId: cards.card._id })).toMatchObject({
      postId, author: { id: owner.profileId, username: 'source-post-owner' }, visibility: 'public',
    })
    expect((await t.query(socialApi.feed.listGlobal, { cursor: null })).items.map((item: { id: string }) => item.id)).toContain(cards.card._id)

    const corruptions = [
      { sourceKey: 'post:wrong-source-key' },
      { sourceId: otherPostId },
      { userId: other.profileId },
      { visibility: 'private' as const },
      { sourceId: 'missing-post-source' },
    ]
    for (const corruption of corruptions) {
      await t.run(async (ctx) => await ctx.db.patch('feedCards', cards.card!._id, corruption))
      expect(await viewer.client.query(socialApi.feed.getById, { cardId: cards.card._id })).toBeNull()
      expect((await t.query(socialApi.feed.listGlobal, { cursor: null })).items.map((item: { id: string }) => item.id)).not.toContain(cards.card._id)
      await t.run(async (ctx) => await ctx.db.patch('feedCards', cards.card!._id, {
        sourceKey: `post:${postId}`, sourceId: postId, userId: owner.profileId, visibility: 'public',
      }))
    }

    expect(await viewer.client.query(socialApi.feed.getById, { cardId: cards.privateCard._id })).toBeNull()
    expect(await owner.client.query(socialApi.feed.getById, { cardId: cards.privateCard._id })).toMatchObject({ postId: privatePostId, visibility: 'private' })
    expect((await t.query(socialApi.feed.listGlobal, { cursor: null })).items.map((item: { id: string }) => item.id)).not.toContain(cards.privateCard._id)
    expect((await owner.client.query(socialApi.feed.listHome, { cursor: null })).items.map((item: { id: string }) => item.id)).toContain(cards.privateCard._id)

    await t.run(async (ctx) => await ctx.db.delete('posts', postId))
    expect(await viewer.client.query(socialApi.feed.getById, { cardId: cards.card._id })).toBeNull()
    expect((await t.query(socialApi.feed.listGlobal, { cursor: null })).items.map((item: { id: string }) => item.id)).not.toContain(cards.card._id)
  }, 20_000)

  test('suppresses unpublished or inactive Review projections', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'source-review-owner')
    const viewer = await createOwner(t, 'source-review-viewer')
    const animeId = await insertAnime(t, 89)
    const otherAnimeId = await insertAnime(t, 90)
    const reviewId = await owner.client.mutation(socialApi.reviews.publish, {
      animeId, requestId: 'source-review', rating: 90, summary: 'Source Review',
      containsSpoiler: false, bodyJson, visibility: 'public',
    })
    const otherReviewId = await viewer.client.mutation(socialApi.reviews.publish, {
      animeId: otherAnimeId, requestId: 'source-review-other', rating: 80, summary: 'Other Review',
      containsSpoiler: false, bodyJson, visibility: 'public',
    })
    const card = await t.run(async (ctx) => await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', `review:${reviewId}`)).unique())
    if (!card) throw new Error('Expected Review feed projection.')

    const readCard = async () => ({
      direct: await owner.client.query(socialApi.feed.getById, { cardId: card._id }),
      globalHasCard: (await t.query(socialApi.feed.listGlobal, { cursor: null })).items.some((item: { id: string }) => item.id === card._id),
    })
    await t.run(async (ctx) => await ctx.db.patch('reviews', reviewId, { state: 'draft' }))
    expect(await readCard()).toEqual({ direct: null, globalHasCard: false })
    await t.run(async (ctx) => await ctx.db.patch('reviews', reviewId, { state: 'published', activityState: 'deleted' }))
    expect(await readCard()).toEqual({ direct: null, globalHasCard: false })
    await t.run(async (ctx) => await ctx.db.patch('reviews', reviewId, { activityState: 'active' }))

    const corruptions = [
      { sourceKey: 'review:wrong-source-key' },
      { sourceId: otherReviewId },
      { userId: viewer.profileId },
      { anilistId: 90 },
      { animeId: otherAnimeId },
      { visibility: 'private' as const },
      { sourceId: 'missing-review-source' },
    ]
    for (const corruption of corruptions) {
      await t.run(async (ctx) => await ctx.db.patch('feedCards', card._id, corruption))
      expect(await readCard()).toEqual({ direct: null, globalHasCard: false })
      await t.run(async (ctx) => await ctx.db.patch('feedCards', card._id, {
        sourceKey: `review:${reviewId}`, sourceId: reviewId, userId: owner.profileId,
        anilistId: 89, animeId, visibility: 'public',
      }))
    }

    await t.run(async (ctx) => await ctx.db.delete('reviews', reviewId))
    expect(await readCard()).toEqual({ direct: null, globalHasCard: false })
  }, 20_000)

  test('returns null for malformed direct feed IDs and exposes milestone visibility', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'milestone-owner')
    const animeId = await insertAnime(t, 88)
    expect(await owner.client.query(socialApi.feed.getById, { cardId: 'not-a-convex-id' })).toBeNull()
    const cardId = await t.run(async (ctx) => {
      await ctx.db.insert('animeMilestones', {
        userId: owner.profileId, anilistId: 88, animeId,
        kind: 'completed', visibility: 'private', occurredAt: 1, updatedAt: 1,
      })
      const sourceKey = `completed:${owner.profileId}:${animeId}`
      return await ctx.db.insert('feedCards', {
        sourceKey, kind: 'completed', userId: owner.profileId,
        anilistId: 88, animeId, visibility: 'private', active: true, orderKey: '0000000000000001:test',
        occurredAt: 1, updatedAt: 1,
      })
    })
    expect(await owner.client.query(socialApi.feed.getById, { cardId })).toMatchObject({
      id: cardId, kind: 'completed', visibility: 'private',
    })
  })

  test('rejects publish request collisions across anime and Draft intent', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'collision-owner')
    const firstAnimeId = await insertAnime(t, 1)
    const secondAnimeId = await insertAnime(t, 2)
    await owner.client.mutation(socialApi.reviews.saveDraft, {
      animeId: secondAnimeId, requestId: 'collision', rating: null, summary: '', containsSpoiler: false, bodyJson, visibility: 'private',
    })
    await expect(owner.client.mutation(socialApi.reviews.saveDraft, {
      animeId: firstAnimeId, requestId: 'collision', rating: null, summary: '', containsSpoiler: false, bodyJson, visibility: 'private',
    })).rejects.toThrow('collision')
    await expect(owner.client.mutation(socialApi.reviews.publish, {
      animeId: firstAnimeId, requestId: 'collision', rating: 90, summary: 'Collision', containsSpoiler: false, bodyJson, visibility: 'public',
    })).rejects.toThrow('collision')
  }, 20_000)

  test('rejects Post update request collisions across owned Posts', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'post-collision-owner')
    const firstId = await owner.client.mutation(socialApi.posts.create, {
      requestId: 'post-request-a', text: 'First', media: null, hasSpoiler: false, visibility: 'public',
    })
    const secondId = await owner.client.mutation(socialApi.posts.create, {
      requestId: 'post-request-b', text: 'Second', media: null, hasSpoiler: false, visibility: 'public',
    })
    await expect(owner.client.mutation(socialApi.posts.update, {
      postId: secondId, requestId: 'post-request-a', text: 'Collision', media: null, hasSpoiler: false, visibility: 'public',
    })).rejects.toThrow('collision')
    expect(await t.run(async (ctx) => await ctx.db.get('posts', firstId))).not.toBeNull()
  }, 20_000)

  test('binds Post create request IDs to exact normalized media intent', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'post-create-retry-owner')
    const firstMedia = { type: 'image', url: 'https://example.com/first.jpg', description: null } as const
    const secondMedia = { type: 'video', url: 'https://vimeo.com/456', provider: 'vimeo', label: null } as const
    const requestId = 'post-create-retry'
    const postId = await owner.client.mutation(socialApi.posts.create, {
      requestId, text: '  Same text  ', media: firstMedia, hasSpoiler: false, visibility: 'public',
    })

    expect(await owner.client.mutation(socialApi.posts.create, {
      requestId, text: 'Same text', media: firstMedia, hasSpoiler: false, visibility: 'public',
    })).toBe(postId)
    for (const changed of [
      { text: 'Changed text', media: firstMedia, hasSpoiler: false, visibility: 'public' },
      { text: 'Same text', media: firstMedia, hasSpoiler: true, visibility: 'public' },
      { text: 'Same text', media: firstMedia, hasSpoiler: false, visibility: 'private' },
      { text: 'Same text', media: secondMedia, hasSpoiler: false, visibility: 'public' },
    ] as const) {
      await expect(owner.client.mutation(socialApi.posts.create, { requestId, ...changed })).rejects.toThrow('collision')
    }

    expect(await t.run(async (ctx) => await ctx.db.get('posts', postId))).toMatchObject({
      text: 'Same text', media: firstMedia, hasSpoiler: false, visibility: 'public',
    })
  }, 20_000)

  test('requires cached anime for every Review lifecycle mutation', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'cache-owner')
    const animeId = await insertAnime(t, 1)
    const reviewId = await owner.client.mutation(socialApi.reviews.publish, {
      animeId, requestId: 'cache-review', rating: 90, summary: 'Cached', containsSpoiler: false, bodyJson, visibility: 'public',
    })
    await t.run(async (ctx) => {
      const anime = await ctx.db.query('animeSummaries').withIndex('by_anilist_id', (q) => q.eq('anilistId', 1)).unique()
      if (anime) await ctx.db.delete('animeSummaries', anime._id)
    })
    await expect(owner.client.mutation(socialApi.reviews.update, { reviewId, rating: 80, summary: 'No cache', containsSpoiler: false, bodyJson, visibility: 'public' })).rejects.toThrow('loaded')
    await expect(owner.client.mutation(socialApi.reviews.setVisibility, { reviewId, visibility: 'private' })).rejects.toThrow('loaded')
    await expect(owner.client.mutation(socialApi.reviews.removeActivity, { reviewId })).rejects.toThrow('loaded')
    await expect(owner.client.mutation(socialApi.reviews.remove, { reviewId })).rejects.toThrow('loaded')
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
            visibility: 'public', media: null, createdAt: occurredAt, updatedAt: occurredAt,
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
          visibility: 'public', media: null, createdAt: index, updatedAt: index,
        })
        await ctx.db.insert('feedCards', {
          sourceKey: `post:${postId}`, kind: 'post', userId: owner.profileId, sourceId: postId,
          visibility: 'public', active: true, orderKey: String(index).padStart(4, '0'), occurredAt: index, updatedAt: index,
        })
      }
      for (let index = 26; index <= 28; index += 1) {
        const postId = await ctx.db.insert('posts', {
          userId: other.profileId, requestId: `prefix-global-${index}`, text: `global-${index}`, hasSpoiler: false,
          visibility: 'public', media: null, createdAt: index, updatedAt: index,
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
    const animeId = await insertAnime(t, 1)
    await t.run(async (ctx) => {
      await ctx.db.insert('animeReviewStats', { anilistId: 1, count: 1, ratingSum: 90, bands: [1, 0, 0, 0, 0, 0, 0, 0, 0], updatedAt: Date.now() })
    })
    await expect(t.query(socialApi.reviews.getStats, { animeId })).rejects.toThrow()
  })

  test('paginates 25 public Reviews plus one private owner Review exactly once', async () => {
    const t = createHarness()
    const viewer = await createOwner(t, 'review-pager')
    const animeId = await insertAnime(t, 1)
    await t.run(async (ctx) => {
      for (let index = 1; index <= 25; index += 1) {
        const now = index
        const userId = await ctx.db.insert('users', {
          authId: `review-author-${index}`, username: `Author${index}`, usernameKey: `author${index}`,
          name: `Author ${index}`, profileVisibility: 'public', visibility: 'public', createdAt: now, updatedAt: now,
        })
        const key = String(index * 2).padStart(4, '0')
        await ctx.db.insert('reviews', {
          userId, anilistId: 1, animeId,
          requestId: `public-${index}`, state: 'published', rating: 50,
          summary: `Public ${index}`, containsSpoiler: false, bodyJson, visibility: 'public',
          publishedAt: now, updatedAt: now, activityState: 'active', newestOrderKey: key,
          highRatingOrderKey: key, lowRatingOrderKey: key, searchText: `author ${index}`, ratingBand: '50-59',
        })
      }
      await ctx.db.insert('reviews', {
        userId: viewer.profileId, anilistId: 1, animeId,
        requestId: 'private-own', state: 'published', rating: 50,
        summary: 'Private own', containsSpoiler: false, bodyJson, visibility: 'private',
        publishedAt: 13, updatedAt: 13, activityState: 'active', newestOrderKey: '0025',
        highRatingOrderKey: '0025', lowRatingOrderKey: '0025', searchText: 'private own', ratingBand: '50-59',
      })
    })

    const items: Array<Record<string, unknown>> = []
    let cursor: string | null = null
    do {
      const page: { items: Array<Record<string, unknown>>; cursor: string | null } = await viewer.client.query(socialApi.reviews.listForAnime, { animeId, sort: 'newest', cursor })
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
    const animeId = await insertAnime(t, 1)
    await t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert('animeMilestones', {
        userId: owner.profileId, anilistId: 1, animeId,
        kind: 'completed', visibility: 'public', occurredAt: now, updatedAt: now,
      })
    })
    await t.mutation(socialInternal.feed.projectMilestones, { paginationOpts: { numItems: 10, cursor: null } })
    const cardId = await t.run(async (ctx) => {
      const card = await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', `completed:${owner.profileId}:${animeId}`)).unique()
      if (!card) throw new Error('Backfilled milestone card missing.')
      return card._id
    })
    await owner.client.mutation(socialApi.feed.removeActivity, { cardId })
    await t.mutation(socialInternal.feed.projectMilestones, { paginationOpts: { numItems: 10, cursor: null } })
    const cards = await t.run(async (ctx) => await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', `completed:${owner.profileId}:${animeId}`)).collect())
    expect(cards).toHaveLength(1)
    expect(cards[0]?.active).toBe(false)
  }, 20_000)
})
