/// <reference types="vite/client" />

import betterAuthTest from '@convex-dev/better-auth/test'
import { defineSchema, defineTable } from 'convex/server'
import { convexTest } from 'convex-test'
import { v } from 'convex/values'
import { describe, expect, test } from 'vitest'

import type { FeedCard } from '../src/features/social/shared/social-contracts'
import { api, components, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { makeOrderKey } from './feedPolicy'
import schema from './schema'
import {
  backfillProfiles,
  search,
  searchPreview,
  verifyProfiles,
} from './userSearch'
import { reviewOrderFields } from './reviewDiscovery'
import { createUserSearchText } from './users'

const modules = import.meta.glob(['./_generated/**/*.*', './{feed,feedPolicy,profiles,reviews,reviewDiscovery,reviewDiscoveryPolicy,socialPolicy,userAnime,userAnimePolicy,userSearch,users}.ts'])
// Generated API is controller-owned and intentionally not regenerated in this worker commit.
const profileApi = api as any
const profileInternal = internal as any

const legacyProfileSchema = defineSchema({
  users: defineTable({
    authId: v.string(),
    username: v.string(),
    usernameKey: v.string(),
    name: v.string(),
    avatarStorageId: v.optional(v.id('_storage')),
    bannerStorageId: v.optional(v.id('_storage')),
    bio: v.optional(v.string()),
    profileVisibility: v.optional(v.union(v.literal('public'), v.literal('private'))),
    visibility: v.union(v.literal('private'), v.literal('followers'), v.literal('public')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_auth_id', ['authId'])
    .index('by_username_key', ['usernameKey'])
    .index('by_avatar_storage_id', ['avatarStorageId'])
    .index('by_banner_storage_id', ['bannerStorageId']),
  userSearchDocuments: defineTable({
    userId: v.id('users'),
    searchText: v.string(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .searchIndex('search_users', { searchField: 'searchText' }),
})

const createHarness = () => {
  const t = convexTest(schema, modules)
  betterAuthTest.register(t)
  return t
}

const createMigrationHarness = () => convexTest(legacyProfileSchema, modules)

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
  name: string,
  profileVisibility: 'private' | 'public',
): Promise<Id<'users'>> => await t.run(async (ctx) => {
  const now = Date.now()
  return await ctx.db.insert('users', {
    authId,
    username,
    usernameKey: username.toLowerCase(),
    name,
    profileVisibility,
    visibility: 'public',
    createdAt: now,
    updatedAt: now,
  })
})

const insertLegacyProfile = async (
  t: ReturnType<typeof createMigrationHarness>,
  authId: string,
  username: string,
  name: string,
  profileVisibility: 'private' | 'public' | undefined,
): Promise<Id<'users'>> => await t.run(async (ctx) => {
  const now = Date.now()
  return await ctx.db.insert('users', {
    authId,
    username,
    usernameKey: username.toLowerCase(),
    name,
    profileVisibility,
    visibility: 'public',
    createdAt: now,
    updatedAt: now,
  })
})

const insertAnimeSummary = async (
  t: ReturnType<typeof createHarness>,
  anilistId: number,
) => await t.run(async (ctx) => await ctx.db.insert('animeSummaries', {
  anilistId,
  slug: `anime-${anilistId}`,
  titles: {
    display: `Anime ${anilistId}`,
    english: null,
    romaji: null,
    native: null,
  },
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
  updatedAt: Date.now(),
}))

const insertPublishedReview = async (
  t: ReturnType<typeof createHarness>,
  userId: Id<'users'>,
  anilistId: number,
  publishedAt: number,
  visibility: 'followers' | 'private' | 'public',
) => await t.run(async (ctx) => {
  const seed = `${userId}:${anilistId}:${visibility}:${publishedAt}`
  const fields = reviewOrderFields(publishedAt, 90, seed)
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
    ...fields,
    searchText: `review ${publishedAt}`,
    ratingBand: '90-100',
  })
})

describe('profile search Convex integration', () => {
  test('builds one canonical normalized identity search text', () => {
    expect(createUserSearchText({
      name: '  Anime   Fan ',
      username: 'Anime_Fan',
    })).toBe('anime fan anime_fan')
  })

  test('completes a profile with Public visibility and its normalized search projection', async () => {
    const t = createHarness()
    const owner = await createAuthUser(t, 'completion-owner')

    const profileId = await owner.client.mutation(
      profileInternal.users.completeProfileInternal,
      { username: 'Anime_Fan' },
    )

    const state = await owner.client.query(profileApi.users.getAuthState, {})
    const projection = await t.run(async (ctx) => await ctx.db
      .query('userSearchDocuments')
      .withIndex('by_user', (q) => q.eq('userId', profileId))
      .unique())

    expect(state.profile).toMatchObject({
      id: profileId,
      username: 'Anime_Fan',
      name: 'Anime_Fan',
    })
    expect(await t.run(async (ctx) => await ctx.db.get('users', profileId)))
      .toMatchObject({ profileVisibility: 'public' })
    expect(projection).toMatchObject({
      userId: profileId,
      searchText: 'anime_fan anime_fan',
    })
  })

  test('searches normalized identity case-insensitively without exposing private data', async () => {
    const t = createHarness()
    const viewer = await createAuthUser(t, 'search-viewer')
    await insertProfile(t, viewer.authId, 'SearchViewer', 'Search Viewer', 'public')
    const targetId = await insertProfile(
      t,
      'private-auth-id',
      'Alice_Fan',
      '  Alice   Example  ',
      'private',
    )

    await t.mutation(profileInternal.userSearch.backfillProfiles, {
      paginationOpts: { numItems: 10, cursor: null },
    })

    await expect(t.query(profileApi.userSearch.searchPreview, { query: 'alice' }))
      .rejects.toThrow('Unauthenticated')
    await expect(viewer.client.query(profileApi.userSearch.searchPreview, { query: 'a' }))
      .rejects.toThrow('2-100')
    await expect(viewer.client.query(profileApi.userSearch.searchPreview, {
      query: `a${' '.repeat(99)}b`,
    })).rejects.toThrow('2-100')

    const preview = await viewer.client.query(
      profileApi.userSearch.searchPreview,
      { query: '  ALICE   ' },
    )
    const page = await viewer.client.query(profileApi.userSearch.search, {
      query: 'ALICE_FAN',
      paginationOpts: { numItems: 20, cursor: null },
    })

    expect(preview).toEqual([{
      id: targetId,
      username: 'Alice_Fan',
      name: '  Alice   Example  ',
      avatarUrl: null,
    }])
    expect(page.page).toEqual(preview)
    expect(Object.keys(preview[0]).sort()).toEqual([
      'avatarUrl',
      'id',
      'name',
      'username',
    ])
    expect(JSON.stringify(preview)).not.toContain('private-auth-id')
  })

  test('caps preview at 5 and pages full search at exactly 20 results', async () => {
    const t = createHarness()
    const viewer = await createAuthUser(t, 'paging-viewer')
    await insertProfile(t, viewer.authId, 'PagingViewer', 'Search Viewer', 'public')
    const expectedIds = await t.run(async (ctx) => {
      const now = Date.now()
      return await Promise.all(Array.from({ length: 22 }, async (_, index) => (
        await ctx.db.insert('users', {
          authId: `paging-auth-${index}`,
          username: `PagingFan${index}`,
          usernameKey: `pagingfan${index}`,
          name: `PagingMatch ${index}`,
          profileVisibility: 'public',
          visibility: 'public',
          createdAt: now,
          updatedAt: now,
        })
      )))
    })
    await t.mutation(profileInternal.userSearch.backfillProfiles, {
      paginationOpts: { numItems: 100, cursor: null },
    })

    await expect(viewer.client.query(profileApi.userSearch.search, {
      query: 'pagingmatch',
      paginationOpts: { numItems: 19, cursor: null },
    })).rejects.toThrow('20 results per page')

    const preview = await viewer.client.query(
      profileApi.userSearch.searchPreview,
      { query: 'pagingmatch' },
    )
    const first = await viewer.client.query(profileApi.userSearch.search, {
      query: 'pagingmatch',
      paginationOpts: { numItems: 20, cursor: null },
    })
    const second = await viewer.client.query(profileApi.userSearch.search, {
      query: 'pagingmatch',
      paginationOpts: { numItems: 20, cursor: first.continueCursor },
    })

    expect(preview).toHaveLength(5)
    expect(first.page).toHaveLength(20)
    expect(first.isDone).toBe(false)
    expect(second.page).toHaveLength(2)
    expect(second.isDone).toBe(true)
    expect(new Set([...first.page, ...second.page].map((item) => item.id)))
      .toEqual(new Set(expectedIds))
  })

  test('omits stale projections whose profile no longer exists', async () => {
    const t = createHarness()
    const viewer = await createAuthUser(t, 'stale-viewer')
    await insertProfile(t, viewer.authId, 'StaleViewer', 'Search Viewer', 'public')
    const deletedId = await insertProfile(
      t,
      'stale-auth',
      'DeletedSearchFan',
      'DeletedSearch Identity',
      'public',
    )
    await t.mutation(profileInternal.userSearch.backfillProfiles, {
      paginationOpts: { numItems: 10, cursor: null },
    })
    await t.run(async (ctx) => await ctx.db.delete('users', deletedId))

    expect(await viewer.client.query(profileApi.userSearch.searchPreview, {
      query: 'deletedsearch',
    })).toEqual([])
    expect(await viewer.client.query(profileApi.userSearch.search, {
      query: 'deletedsearch',
      paginationOpts: { numItems: 20, cursor: null },
    })).toMatchObject({ page: [] })
  })

  test('keeps one projection per profile and rejects duplicate corruption', async () => {
    const t = createHarness()
    const userId = await insertProfile(t, 'upsert-auth', 'UpsertFan', 'Upsert Fan', 'public')

    const first = await t.mutation(profileInternal.userSearch.backfillProfiles, {
      paginationOpts: { numItems: 10, cursor: null },
    })
    const second = await t.mutation(profileInternal.userSearch.backfillProfiles, {
      paginationOpts: { numItems: 10, cursor: null },
    })
    const rows = await t.run(async (ctx) => await ctx.db
      .query('userSearchDocuments')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect())

    expect(first).toMatchObject({ processedCount: 1, searchUpsertedCount: 1 })
    expect(second).toMatchObject({ processedCount: 1, searchUpsertedCount: 1 })
    expect(rows).toHaveLength(1)

    await t.run(async (ctx) => {
      await ctx.db.insert('userSearchDocuments', {
        userId,
        searchText: 'duplicate',
        updatedAt: Date.now(),
      })
    })
    await expect(t.mutation(profileInternal.userSearch.backfillProfiles, {
      paginationOpts: { numItems: 10, cursor: null },
    })).rejects.toThrow('USER_SEARCH_CORRUPT')
  })

  test('backfills missing defaults idempotently and reports every verification mismatch', async () => {
    const t = createMigrationHarness()
    const missingId = await insertLegacyProfile(t, 'missing-auth', 'MissingFan', 'Missing Fan', undefined)
    const mismatchId = await insertLegacyProfile(t, 'mismatch-auth', 'MismatchFan', 'Mismatch Fan', 'public')
    const duplicateId = await insertLegacyProfile(t, 'duplicate-auth', 'DuplicateFan', 'Duplicate Fan', 'public')

    await t.run(async (ctx) => {
      await ctx.db.insert('userSearchDocuments', {
        userId: mismatchId,
        searchText: 'wrong',
        updatedAt: 1,
      })
      await ctx.db.insert('userSearchDocuments', {
        userId: duplicateId,
        searchText: 'duplicate fan duplicatefan',
        updatedAt: 1,
      })
      await ctx.db.insert('userSearchDocuments', {
        userId: duplicateId,
        searchText: 'duplicate fan duplicatefan',
        updatedAt: 2,
      })
    })

    const verification = await t.mutation(
      profileInternal.userSearch.verifyProfiles,
      { paginationOpts: { numItems: 10, cursor: null } },
    )
    expect(verification.missingVisibilityIds).toEqual([missingId])
    expect(verification.missingSearchIds).toEqual([missingId])
    expect(verification.mismatchedSearchUserIds).toEqual([mismatchId])
    expect(verification.duplicateSearchUserIds).toEqual([duplicateId])

    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query('userSearchDocuments')
        .withIndex('by_user', (q) => q.eq('userId', duplicateId))
        .collect()
      await ctx.db.delete(rows[1]!._id)
    })
    const first = await t.mutation(profileInternal.userSearch.backfillProfiles, {
      paginationOpts: { numItems: 10, cursor: null },
    })
    const second = await t.mutation(profileInternal.userSearch.backfillProfiles, {
      paginationOpts: { numItems: 10, cursor: null },
    })

    expect(first.visibilityPatchedCount).toBe(1)
    expect(second.visibilityPatchedCount).toBe(0)
    expect(await t.mutation(profileInternal.userSearch.verifyProfiles, {
      paginationOpts: { numItems: 10, cursor: null },
    })).toMatchObject({
      missingVisibilityIds: [],
      missingSearchIds: [],
      duplicateSearchUserIds: [],
      mismatchedSearchUserIds: [],
    })
  })

  test('registers maintenance functions as internal and search functions as public', () => {
    // Registration metadata is authoritative; generated API proxies do not prove visibility.
    expect(backfillProfiles.isInternal).toBe(true)
    expect(verifyProfiles.isInternal).toBe(true)
    expect('isInternal' in searchPreview).toBe(false)
    expect('isInternal' in search).toBe(false)
  })
})

describe('profile read Convex integration', () => {
  test('returns exact full and private header projections through normalized usernames', async () => {
    const t = createHarness()
    const owner = await createAuthUser(t, 'profile-owner')
    const viewer = await createAuthUser(t, 'profile-viewer')
    const ownerId = await insertProfile(t, owner.authId, 'ProfileOwner', 'Profile Owner', 'public')
    await insertProfile(t, viewer.authId, 'ProfileViewer', 'Profile Viewer', 'public')
    await t.run(async (ctx) => {
      await ctx.db.patch('users', ownerId, {
        bio: 'Profile bio',
        visibility: 'followers',
      })
    })

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
        name: 'Profile Owner',
        bio: 'Profile bio',
        avatarUrl: null,
        bannerUrl: null,
        profileVisibility: 'public',
        progress: { watching: 0, completed: 0, planned: 0, dropped: 0 },
        favorites: [],
      },
    })
    expect(Object.keys(full.profile).sort()).toEqual([
      'avatarUrl',
      'bannerUrl',
      'bio',
      'favorites',
      'id',
      'name',
      'profileVisibility',
      'progress',
      'username',
    ])
    expect(JSON.stringify(full)).not.toContain('"visibility"')

    await t.run(async (ctx) => {
      await ctx.db.patch('users', ownerId, { profileVisibility: 'private' })
    })
    const header = await viewer.client.query(profileApi.profiles.getByUsername, {
      username: 'ProfileOwner',
    })
    expect(header).toEqual({
      access: 'header',
      owner: false,
      profile: {
        id: ownerId,
        username: 'ProfileOwner',
        name: 'Profile Owner',
        bio: 'Profile bio',
        avatarUrl: null,
        bannerUrl: null,
        profileVisibility: 'private',
      },
    })
    expect(Object.keys(header.profile).sort()).toEqual([
      'avatarUrl',
      'bannerUrl',
      'bio',
      'id',
      'name',
      'profileVisibility',
      'username',
    ])
    expect(JSON.stringify(header)).not.toContain(owner.authId)
    expect(JSON.stringify(header)).not.toContain('visibility')

    const own = await owner.client.query(profileApi.profiles.getByUsername, {
      username: 'profileowner',
    })
    expect(own).toMatchObject({ access: 'full', owner: true })
  })

  test('rejects missing Profile Visibility as explicit post-migration corruption', async () => {
    const t = createMigrationHarness()
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
          token: 'corruption-viewer-token',
          expiresAt: now + 60_000,
          createdAt: now,
          updatedAt: now,
        },
      },
    })
    await insertLegacyProfile(t, authUser._id, 'CorruptionViewer', 'Corruption Viewer', 'public')
    await insertLegacyProfile(t, 'corrupt-profile-auth', 'CorruptProfile', 'Corrupt Profile', undefined)
    const viewer = t.withIdentity({
      subject: authUser._id,
      sessionId: session._id,
    } as never)

    await expect(viewer.query(profileApi.profiles.getByUsername, {
      username: 'corruptprofile',
    })).rejects.toThrow('PROFILE_VISIBILITY_CORRUPT')
  })

  test('previews newest 10 favorites and pages each favorite once in newest order', async () => {
    const t = createHarness()
    const owner = await createAuthUser(t, 'favorite-owner')
    const viewer = await createAuthUser(t, 'favorite-viewer')
    const ownerId = await insertProfile(t, owner.authId, 'FavoriteOwner', 'Favorite Owner', 'public')
    await insertProfile(t, viewer.authId, 'FavoriteViewer', 'Favorite Viewer', 'public')
    await t.run(async (ctx) => {
      for (let index = 1; index <= 22; index += 1) {
        await ctx.db.insert('animeSummaries', {
          anilistId: index,
          slug: `anime-${index}`,
          titles: { display: `Anime ${index}`, english: null, romaji: null, native: null },
          coverImageUrl: null,
          bannerImageUrl: null,
          format: 'TV',
          season: null,
          seasonYear: 2026,
          episodes: 12,
          genres: [],
          popularity: index,
          averageScore: null,
          trending: null,
          startDate: null,
          nextAiringAt: null,
          updatedAt: index,
        })
        await ctx.db.insert('userAnimeEntries', {
          userId: ownerId,
          anilistId: index,
          status: null,
          score: null,
          favoriteAt: index,
          rewatchCount: 0,
          lastRewatchSequence: 0,
          createdAt: index,
          updatedAt: index,
        })
      }
    })

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
    expect(first.items).toHaveLength(20)
    expect(second.items).toHaveLength(2)
    expect(ids).toEqual(Array.from({ length: 22 }, (_, index) => 22 - index))
    expect(new Set(ids)).toHaveLength(22)

    await expect(owner.client.query(profileApi.userAnime.listProfileFavorites, {
      username: 'FavoriteOwner',
      cursor: first.cursor,
    })).rejects.toThrow('viewer')
    await t.run(async (ctx) => {
      await ctx.db.patch('users', ownerId, { profileVisibility: 'private' })
    })
    await expect(viewer.client.query(profileApi.userAnime.listProfileFavorites, {
      username: 'FavoriteOwner',
      cursor: null,
    })).rejects.toThrow('PROFILE_PRIVATE')
  })

  test('pages public Reviews for another viewer and every published lane for owner', async () => {
    const t = createHarness()
    const owner = await createAuthUser(t, 'review-profile-owner')
    const viewer = await createAuthUser(t, 'review-profile-viewer')
    const ownerId = await insertProfile(t, owner.authId, 'ReviewProfileOwner', 'Review Owner', 'public')
    await insertProfile(t, viewer.authId, 'ReviewProfileViewer', 'Review Viewer', 'public')
    for (let index = 1; index <= 21; index += 1) {
      await insertAnimeSummary(t, index)
      await insertPublishedReview(t, ownerId, index, index, 'public')
    }
    await insertPublishedReview(t, ownerId, 1, 30, 'followers')
    await insertPublishedReview(t, ownerId, 2, 29, 'private')

    const viewerFirst = await viewer.client.query(profileApi.reviews.listForProfile, {
      username: 'reviewprofileowner',
      cursor: null,
    })
    const viewerSecond = await viewer.client.query(profileApi.reviews.listForProfile, {
      username: 'ReviewProfileOwner',
      cursor: viewerFirst.cursor,
    })
    const viewed = [...viewerFirst.items, ...viewerSecond.items]
    expect(viewed).toHaveLength(21)
    expect(new Set(viewed.map((review) => review.id))).toHaveLength(21)
    expect(new Set(viewed.map((review) => review.visibility))).toEqual(new Set(['public']))

    const ownerFirst = await owner.client.query(profileApi.reviews.listForProfile, {
      username: 'ReviewProfileOwner',
      cursor: null,
    })
    const ownerSecond = await owner.client.query(profileApi.reviews.listForProfile, {
      username: 'reviewprofileowner',
      cursor: ownerFirst.cursor,
    })
    const owned = [...ownerFirst.items, ...ownerSecond.items]
    expect(owned).toHaveLength(23)
    expect(new Set(owned.map((review) => review.id))).toHaveLength(23)
    expect(owned.slice(0, 2).map((review) => review.visibility))
      .toEqual(['followers', 'private'])

    await expect(owner.client.query(profileApi.reviews.listForProfile, {
      username: 'ReviewProfileOwner',
      cursor: viewerFirst.cursor,
    })).rejects.toThrow('viewer')
  })

  test('lists active accessible source-backed Activity without recreating deleted Review Activity', async () => {
    const t = createHarness()
    const owner = await createAuthUser(t, 'activity-profile-owner')
    const viewer = await createAuthUser(t, 'activity-profile-viewer')
    const ownerId = await insertProfile(t, owner.authId, 'ActivityProfileOwner', 'Activity Owner', 'public')
    await insertProfile(t, viewer.authId, 'ActivityProfileViewer', 'Activity Viewer', 'public')
    await insertAnimeSummary(t, 1)
    await t.run(async (ctx) => {
      const publicPostId = await ctx.db.insert('posts', {
        userId: ownerId,
        requestId: 'profile-public-post',
        text: 'Public post',
        hasSpoiler: false,
        visibility: 'public',
        media: null,
        createdAt: 40,
        updatedAt: 40,
      })
      const privatePostId = await ctx.db.insert('posts', {
        userId: ownerId,
        requestId: 'profile-private-post',
        text: 'Private post',
        hasSpoiler: false,
        visibility: 'private',
        media: null,
        createdAt: 39,
        updatedAt: 39,
      })
      await ctx.db.insert('feedCards', {
        sourceKey: `post:${publicPostId}`,
        kind: 'post',
        userId: ownerId,
        sourceId: publicPostId,
        visibility: 'public',
        active: true,
        orderKey: makeOrderKey(40, `post:${publicPostId}`),
        occurredAt: 40,
        updatedAt: 40,
      })
      await ctx.db.insert('feedCards', {
        sourceKey: `post:${privatePostId}`,
        kind: 'post',
        userId: ownerId,
        sourceId: privatePostId,
        visibility: 'private',
        active: true,
        orderKey: makeOrderKey(39, `post:${privatePostId}`),
        occurredAt: 39,
        updatedAt: 39,
      })
      await ctx.db.insert('animeMilestones', {
        userId: ownerId,
        anilistId: 1,
        kind: 'completed',
        visibility: 'public',
        occurredAt: 38,
        updatedAt: 38,
      })
      await ctx.db.insert('feedCards', {
        sourceKey: `completed:${ownerId}:1`,
        kind: 'completed',
        userId: ownerId,
        anilistId: 1,
        visibility: 'public',
        active: true,
        orderKey: makeOrderKey(38, `completed:${ownerId}:1`),
        occurredAt: 38,
        updatedAt: 38,
      })
    })
    const deletedReviewId = await insertPublishedReview(t, ownerId, 1, 41, 'public')
    await t.run(async (ctx) => {
      await ctx.db.patch('reviews', deletedReviewId, { activityState: 'deleted' })
      await ctx.db.insert('feedCards', {
        sourceKey: `review:${deletedReviewId}`,
        kind: 'review',
        userId: ownerId,
        sourceId: deletedReviewId,
        anilistId: 1,
        visibility: 'public',
        active: true,
        orderKey: makeOrderKey(41, `review:${deletedReviewId}`),
        occurredAt: 41,
        updatedAt: 41,
      })
    })

    const viewed = await viewer.client.query(profileApi.feed.listForProfile, {
      username: 'activityprofileowner',
      cursor: null,
    })
    expect(viewed.items.map((item: FeedCard) => item.kind)).toEqual(['post', 'completed'])
    expect(JSON.stringify(viewed)).not.toContain(deletedReviewId)
    expect(JSON.stringify(viewed)).not.toContain(owner.authId)

    const owned = await owner.client.query(profileApi.feed.listForProfile, {
      username: 'ActivityProfileOwner',
      cursor: null,
    })
    expect(owned.items.map((item: FeedCard) => item.kind)).toEqual(['post', 'post', 'completed'])
    expect(owned.items.map((item: FeedCard) => item.visibility))
      .toEqual(['public', 'private', 'public'])
  })
})
