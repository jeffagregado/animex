/// <reference types="vite/client" />

import betterAuthTest from '@convex-dev/better-auth/test'
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'

import { api, components, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import schema from './schema'
import {
  backfillProfiles,
  search,
  searchPreview,
  verifyProfiles,
} from './userSearch'
import { createUserSearchText } from './users'

const modules = import.meta.glob(['./_generated/**/*.*', './{userSearch,users}.ts'])
// Generated API is controller-owned and intentionally not regenerated in this worker commit.
const profileApi = api as any
const profileInternal = internal as any

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
    const t = createHarness()
    const missingId = await insertProfile(t, 'missing-auth', 'MissingFan', 'Missing Fan', undefined)
    const mismatchId = await insertProfile(t, 'mismatch-auth', 'MismatchFan', 'Mismatch Fan', 'public')
    const duplicateId = await insertProfile(t, 'duplicate-auth', 'DuplicateFan', 'Duplicate Fan', 'public')

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
