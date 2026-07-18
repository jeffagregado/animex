/// <reference types="vite/client" />

import betterAuthTest from '@convex-dev/better-auth/test'
import { defineSchema, defineTable } from 'convex/server'
import { convexTest } from 'convex-test'
import { v } from 'convex/values'
import { describe, expect, test } from 'vitest'

import type { FeedCard } from '../src/features/social/shared/social-contracts'
import { api, components } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { makeOrderKey } from './feedPolicy'
import { reviewOrderFields } from './reviewDiscovery'
import schema from './schema'

const modules = import.meta.glob([
  './_generated/**/*.*',
  './{feed,feedPolicy,profileReviewPolicy,profiles,reviews,reviewDiscovery,reviewDiscoveryPolicy,socialPolicy,userAnime,userAnimePolicy,users}.ts',
])
const profileApi = api as any

const createHarness = () => {
  const t = convexTest(schema, modules)
  betterAuthTest.register(t)
  return t
}

const createAuthUser = async (
  t: ReturnType<typeof createHarness>,
  label: string,
) => {
  const now = Date.now()
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: 'user',
      data: {
        name: label,
        email: `${label}@example.com`,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    },
  })
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: 'session',
      data: {
        userId: user._id,
        token: `${label}-token`,
        expiresAt: now + 60_000,
        createdAt: now,
        updatedAt: now,
      },
    },
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
  visibility: 'private' | 'public',
) => await t.run(async (ctx) => await ctx.db.insert('users', {
  authId,
  username,
  usernameKey: username.toLowerCase(),
  name: `${username} Name`,
  profileVisibility: visibility,
  visibility: 'public',
  createdAt: Date.now(),
  updatedAt: Date.now(),
}))

const insertAnime = async (
  t: ReturnType<typeof createHarness>,
  anilistId: number,
) => await t.run(async (ctx) => {
  const now = Date.now()
  const animeId = await ctx.db.insert('catalogEntities', { kind: 'anime', createdAt: now, updatedAt: now })
  await ctx.db.insert('catalogProviderRefs', {
    entityId: animeId, provider: 'anilist', kind: 'anime', providerId: anilistId, createdAt: now, updatedAt: now,
  })
  return await ctx.db.insert('animeSummaries', {
    anilistId,
    slug: `anime-${anilistId}`,
    titles: { display: `Anime ${anilistId}`, english: null, romaji: null, native: null },
    coverImageUrl: null,
    bannerImageUrl: null,
    format: 'TV',
    season: null,
    seasonYear: 2026,
    episodes: 12,
    genres: [],
    popularity: anilistId,
    averageScore: null,
    trending: null,
    startDate: null,
    nextAiringAt: null,
    updatedAt: anilistId,
  })
})

const insertReview = async (
  t: ReturnType<typeof createHarness>,
  userId: Id<'users'>,
  anilistId: number,
  publishedAt: number,
  visibility: 'followers' | 'private' | 'public',
) => await t.run(async (ctx) => {
  const seed = `${userId}:${anilistId}:${visibility}:${publishedAt}`
  return await ctx.db.insert('reviews', {
    userId,
    anilistId,
    requestId: seed,
    state: 'published',
    rating: 90,
    summary: `${visibility} ${publishedAt}`,
    containsSpoiler: false,
    bodyJson: '{}',
    visibility,
    publishedAt,
    updatedAt: publishedAt,
    activityState: 'active',
    ...reviewOrderFields(publishedAt, 90, seed),
    searchText: `review ${publishedAt}`,
    ratingBand: '90-100',
  })
})

describe('profile content Convex integration', () => {
  test('returns exact full and private header projections without raw fields', async () => {
    const t = createHarness()
    const owner = await createAuthUser(t, 'profile-owner')
    const viewer = await createAuthUser(t, 'profile-viewer')
    const ownerId = await insertProfile(t, owner.authId, 'ProfileOwner', 'public')
    await insertProfile(t, viewer.authId, 'ProfileViewer', 'public')
    await t.run(async (ctx) => await ctx.db.patch('users', ownerId, {
      bio: 'Profile bio',
      visibility: 'followers',
    }))

    await expect(t.query(profileApi.profiles.getByUsername, {
      username: 'profileowner',
    })).rejects.toThrow('Unauthenticated')
    await expect(viewer.client.query(profileApi.profiles.getByUsername, {
      username: 'missing-profile',
    })).rejects.toThrow('PROFILE_NOT_FOUND')

    const full = await viewer.client.query(profileApi.profiles.getByUsername, {
      username: 'PROFILEOWNER',
    })
    expect(full).toEqual({
      access: 'full',
      owner: false,
      profile: {
        id: ownerId,
        username: 'ProfileOwner',
        name: 'ProfileOwner Name',
        bio: 'Profile bio',
        avatarUrl: null,
        bannerUrl: null,
        profileVisibility: 'public',
        progress: { watching: 0, completed: 0, planned: 0, dropped: 0 },
        favorites: [],
      },
    })
    expect(Object.keys(full.profile).sort()).toEqual([
      'avatarUrl', 'bannerUrl', 'bio', 'favorites', 'id', 'name',
      'profileVisibility', 'progress', 'username',
    ])
    expect(JSON.stringify(full)).not.toContain('"visibility"')

    await t.run(async (ctx) => await ctx.db.patch('users', ownerId, {
      profileVisibility: 'private',
    }))
    const header = await viewer.client.query(profileApi.profiles.getByUsername, {
      username: 'ProfileOwner',
    })
    expect(header).toEqual({
      access: 'header',
      owner: false,
      profile: {
        id: ownerId,
        username: 'ProfileOwner',
        name: 'ProfileOwner Name',
        bio: 'Profile bio',
        avatarUrl: null,
        bannerUrl: null,
        profileVisibility: 'private',
      },
    })
    expect(JSON.stringify(header)).not.toContain(owner.authId)
    expect(await owner.client.query(profileApi.profiles.getByUsername, {
      username: 'profileowner',
    })).toMatchObject({ access: 'full', owner: true })
  })

  test('rejects missing Profile Visibility as explicit corruption', async () => {
    const legacySchema = defineSchema({
      users: defineTable({
        authId: v.string(),
        username: v.string(),
        usernameKey: v.string(),
        name: v.string(),
        profileVisibility: v.optional(v.union(v.literal('public'), v.literal('private'))),
        visibility: v.union(v.literal('private'), v.literal('followers'), v.literal('public')),
        createdAt: v.number(),
        updatedAt: v.number(),
      }).index('by_auth_id', ['authId']).index('by_username_key', ['usernameKey']),
    })
    const t = convexTest(legacySchema, modules)
    betterAuthTest.register(t)
    const now = Date.now()
    const authUser = await t.mutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'corruption-viewer',
          email: 'corruption-viewer@example.com',
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        },
      },
    })
    const session = await t.mutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: {
          userId: authUser._id,
          token: 'corruption-token',
          expiresAt: now + 60_000,
          createdAt: now,
          updatedAt: now,
        },
      },
    })
    await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        authId: authUser._id,
        username: 'Viewer',
        usernameKey: 'viewer',
        name: 'Viewer',
        profileVisibility: 'public',
        visibility: 'public',
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('users', {
        authId: 'corrupt-auth',
        username: 'Corrupt',
        usernameKey: 'corrupt',
        name: 'Corrupt',
        profileVisibility: undefined,
        visibility: 'public',
        createdAt: now,
        updatedAt: now,
      })
    })
    const viewer = t.withIdentity({ subject: authUser._id, sessionId: session._id } as never)
    await expect(viewer.query(profileApi.profiles.getByUsername, {
      username: 'corrupt',
    })).rejects.toThrow('PROFILE_VISIBILITY_CORRUPT')
  })

  test('previews and pages newest Favorites exactly once with scoped cursors', async () => {
    const t = createHarness()
    const owner = await createAuthUser(t, 'favorite-owner')
    const viewer = await createAuthUser(t, 'favorite-viewer')
    const ownerId = await insertProfile(t, owner.authId, 'FavoriteOwner', 'public')
    await insertProfile(t, viewer.authId, 'FavoriteViewer', 'public')
    for (let index = 1; index <= 22; index += 1) {
      await insertAnime(t, index)
      await t.run(async (ctx) => await ctx.db.insert('userAnimeEntries', {
        userId: ownerId,
        anilistId: index,
        status: null,
        score: null,
        favoriteAt: index,
        rewatchCount: 0,
        lastRewatchSequence: 0,
        createdAt: index,
        updatedAt: index,
      }))
    }
    const profile = await viewer.client.query(profileApi.profiles.getByUsername, {
      username: 'favoriteowner',
    })
    expect(profile.profile.favorites.map((anime: { anilistId: number }) => anime.anilistId))
      .toEqual([22, 21, 20, 19, 18, 17, 16, 15, 14, 13])
    const first = await viewer.client.query(profileApi.userAnime.listProfileFavorites, {
      username: 'FavoriteOwner',
      cursor: null,
    })
    const second = await viewer.client.query(profileApi.userAnime.listProfileFavorites, {
      username: 'favoriteowner',
      cursor: first.cursor,
    })
    const ids = [...first.items, ...second.items].map((item) => item.anime.anilistId)
    expect(ids).toEqual(Array.from({ length: 22 }, (_, index) => 22 - index))
    expect(new Set(ids)).toHaveLength(22)
    await expect(owner.client.query(profileApi.userAnime.listProfileFavorites, {
      username: 'FavoriteOwner',
      cursor: first.cursor,
    })).rejects.toThrow('viewer')
    await t.run(async (ctx) => await ctx.db.patch('users', ownerId, {
      profileVisibility: 'private',
    }))
    await expect(viewer.client.query(profileApi.userAnime.listProfileFavorites, {
      username: 'FavoriteOwner',
      cursor: null,
    })).rejects.toThrow('PROFILE_PRIVATE')
  })

  test('pages public Reviews for viewers and all published lanes for owner', async () => {
    const t = createHarness()
    const owner = await createAuthUser(t, 'review-owner')
    const viewer = await createAuthUser(t, 'review-viewer')
    const ownerId = await insertProfile(t, owner.authId, 'ReviewOwner', 'public')
    await insertProfile(t, viewer.authId, 'ReviewViewer', 'public')
    for (let index = 1; index <= 21; index += 1) {
      await insertAnime(t, index)
      await insertReview(t, ownerId, index, index, 'public')
    }
    await insertReview(t, ownerId, 1, 30, 'followers')
    await insertReview(t, ownerId, 2, 29, 'private')
    const viewerFirst = await viewer.client.query(profileApi.reviews.listForProfile, {
      username: 'reviewowner',
      cursor: null,
    })
    const viewerSecond = await viewer.client.query(profileApi.reviews.listForProfile, {
      username: 'ReviewOwner',
      cursor: viewerFirst.cursor,
    })
    const viewed = [...viewerFirst.items, ...viewerSecond.items]
    expect(viewed).toHaveLength(21)
    expect(new Set(viewed.map((review) => review.visibility))).toEqual(new Set(['public']))
    const ownerFirst = await owner.client.query(profileApi.reviews.listForProfile, {
      username: 'ReviewOwner',
      cursor: null,
    })
    const ownerSecond = await owner.client.query(profileApi.reviews.listForProfile, {
      username: 'reviewowner',
      cursor: ownerFirst.cursor,
    })
    const owned = [...ownerFirst.items, ...ownerSecond.items]
    expect(owned).toHaveLength(23)
    expect(new Set(owned.map((review) => review.id))).toHaveLength(23)
    expect(owned.slice(0, 2).map((review) => review.visibility))
      .toEqual(['followers', 'private'])
    await expect(owner.client.query(profileApi.reviews.listForProfile, {
      username: 'ReviewOwner',
      cursor: viewerFirst.cursor,
    })).rejects.toThrow('viewer')
  })

  test('bounds stale Activity reads and eventually reaches valid source-backed cards', async () => {
    const t = createHarness()
    const owner = await createAuthUser(t, 'activity-owner')
    const viewer = await createAuthUser(t, 'activity-viewer')
    const ownerId = await insertProfile(t, owner.authId, 'ActivityOwner', 'public')
    await insertProfile(t, viewer.authId, 'ActivityViewer', 'public')
    await insertAnime(t, 1)
    const deletedReviewId = await insertReview(t, ownerId, 1, 49, 'public')
    await t.run(async (ctx) => {
      for (let index = 100; index > 55; index -= 1) {
        const sourceId = `deleted-${index}`
        await ctx.db.insert('feedCards', {
          sourceKey: `post:${sourceId}`,
          kind: 'post',
          userId: ownerId,
          sourceId,
          visibility: 'public',
          active: true,
          orderKey: makeOrderKey(index, `post:${sourceId}`),
          occurredAt: index,
          updatedAt: index,
        })
      }
      await ctx.db.patch('reviews', deletedReviewId, { activityState: 'deleted' })
      const postId = await ctx.db.insert('posts', {
        userId: ownerId,
        requestId: 'valid-post',
        text: 'Eventually visible',
        hasSpoiler: false,
        visibility: 'public',
        media: null,
        createdAt: 50,
        updatedAt: 50,
      })
      await ctx.db.insert('feedCards', {
        sourceKey: `post:${postId}`,
        kind: 'post',
        userId: ownerId,
        sourceId: postId,
        visibility: 'public',
        active: true,
        orderKey: makeOrderKey(50, `post:${postId}`),
        occurredAt: 50,
        updatedAt: 50,
      })
      await ctx.db.insert('feedCards', {
        sourceKey: `review:${deletedReviewId}`,
        kind: 'review',
        userId: ownerId,
        sourceId: deletedReviewId,
        anilistId: 1,
        visibility: 'public',
        active: true,
        orderKey: makeOrderKey(49, `review:${deletedReviewId}`),
        occurredAt: 49,
        updatedAt: 49,
      })
      const privatePostId = await ctx.db.insert('posts', {
        userId: ownerId,
        requestId: 'private-post',
        text: 'Private',
        hasSpoiler: false,
        visibility: 'private',
        media: null,
        createdAt: 48,
        updatedAt: 48,
      })
      await ctx.db.insert('feedCards', {
        sourceKey: `post:${privatePostId}`,
        kind: 'post',
        userId: ownerId,
        sourceId: privatePostId,
        visibility: 'private',
        active: true,
        orderKey: makeOrderKey(48, `post:${privatePostId}`),
        occurredAt: 48,
        updatedAt: 48,
      })
      await ctx.db.insert('animeMilestones', {
        userId: ownerId,
        anilistId: 1,
        kind: 'completed',
        visibility: 'public',
        occurredAt: 47,
        updatedAt: 47,
      })
      await ctx.db.insert('feedCards', {
        sourceKey: `completed:${ownerId}:1`,
        kind: 'completed',
        userId: ownerId,
        anilistId: 1,
        visibility: 'public',
        active: true,
        orderKey: makeOrderKey(47, `completed:${ownerId}:1`),
        occurredAt: 47,
        updatedAt: 47,
      })
    })

    const first = await viewer.client.query(profileApi.feed.listForProfile, {
      username: 'activityowner',
      cursor: null,
    })
    expect(first).toMatchObject({ items: [], hasMore: true })
    const second = await viewer.client.query(profileApi.feed.listForProfile, {
      username: 'ActivityOwner',
      cursor: first.cursor,
    })
    expect(second).toMatchObject({ items: [], hasMore: true })
    const third = await viewer.client.query(profileApi.feed.listForProfile, {
      username: 'activityowner',
      cursor: second.cursor,
    })
    expect(third.items.map((item: FeedCard) => item.kind)).toEqual(['post', 'completed'])
    expect(JSON.stringify(third)).not.toContain(deletedReviewId)
    expect(JSON.stringify(third)).not.toContain(owner.authId)
    expect(third.hasMore).toBe(false)
  })
})
