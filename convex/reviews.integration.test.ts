/// <reference types="vite/client" />

import betterAuthTest from '@convex-dev/better-auth/test'
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'

import { api, components } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob(['./_generated/**/*.*', './reviews.ts'])
const reviewsApi = api as any
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

const insertLegacyReview = async (
  t: ReturnType<typeof createHarness>,
  userId: string,
  anilistId: number,
) => await t.run(async (ctx) => await ctx.db.insert('reviews', {
  userId: userId as never, anilistId, requestId: `legacy-${anilistId}`, state: 'published',
  rating: 90, summary: 'Legacy Review', containsSpoiler: false, bodyJson: '{"version":1}',
  visibility: 'public', publishedAt: 10, updatedAt: 10, activityState: 'active',
  newestOrderKey: '0001', highRatingOrderKey: '0001', lowRatingOrderKey: '0001',
  searchText: 'legacy review', ratingBand: '90-100',
}))

const bodyJson = JSON.stringify({
  version: 1,
  editorState: {
    root: {
      type: 'root', version: 1, direction: null, format: '', indent: 0,
      children: [{
        type: 'paragraph', version: 1, direction: null, format: '', indent: 0, textFormat: 0, textStyle: '',
        children: [{ type: 'text', version: 1, detail: 0, format: 0, mode: 'normal', style: '', text: 'Review body.' }],
      }],
    },
  },
})

describe('Review entity-primary drift guards', () => {
  test('rejects missing and conflicting legacy Review refs before creating a duplicate', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'review-drift')
    const animeId = await insertAnime(t, 801)
    const otherAnimeId = await insertAnime(t, 802)
    const reviewId = await insertLegacyReview(t, owner.profileId, 801)
    const input = {
      animeId, requestId: 'new-request', rating: null, summary: '',
      containsSpoiler: false, bodyJson, visibility: 'private',
    }

    await expect(owner.client.mutation(reviewsApi.reviews.saveDraft, input)).rejects.toThrow('missing its Anime entity')
    await t.run(async (ctx) => await ctx.db.patch('reviews', reviewId, { animeId: otherAnimeId }))
    await expect(owner.client.mutation(reviewsApi.reviews.saveDraft, input)).rejects.toThrow('conflicts with provider mapping')
    expect(await t.run(async (ctx) => (await ctx.db.query('reviews').collect()).length)).toBe(1)
  })

  test('rejects missing and conflicting legacy aggregate refs', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'aggregate-drift')
    const animeId = await insertAnime(t, 803)
    const otherAnimeId = await insertAnime(t, 804)
    const statsId = await t.run(async (ctx) => await ctx.db.insert('animeReviewStats', {
      anilistId: 803, count: 1, ratingSum: 90, bands: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0], updatedAt: 1,
    }))
    const input = {
      animeId, requestId: 'aggregate-write', rating: 90, summary: 'Aggregate guard',
      containsSpoiler: false, bodyJson, visibility: 'public',
    }

    await expect(owner.client.mutation(reviewsApi.reviews.publish, input)).rejects.toThrow('missing its Anime entity')
    await t.run(async (ctx) => await ctx.db.patch('animeReviewStats', statsId, { animeId: otherAnimeId }))
    await expect(t.query(reviewsApi.reviews.getStats, { animeId })).rejects.toThrow('conflicts with provider mapping')
  })

  test('rejects an entity-primary aggregate with the wrong provider ID', async () => {
    const t = createHarness()
    const animeId = await insertAnime(t, 807)
    await t.run(async (ctx) => await ctx.db.insert('animeReviewStats', {
      anilistId: 999, animeId, count: 1, ratingSum: 90,
      bands: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0], updatedAt: 1,
    }))

    await expect(t.query(reviewsApi.reviews.getStats, { animeId })).rejects.toThrow('conflicts with provider mapping')
  })

  test('rejects missing and conflicting legacy rows during per-Anime pagination', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'page-drift')
    const animeId = await insertAnime(t, 805)
    const otherAnimeId = await insertAnime(t, 806)
    const reviewId = await insertLegacyReview(t, owner.profileId, 805)
    const input = { animeId, sort: 'newest', cursor: null }

    await expect(t.query(reviewsApi.reviews.listForAnime, input)).rejects.toThrow('missing its Anime entity')
    await t.run(async (ctx) => await ctx.db.patch('reviews', reviewId, { animeId: otherAnimeId }))
    await expect(t.query(reviewsApi.reviews.listForAnime, input)).rejects.toThrow('conflicts with provider mapping')
  })
})
