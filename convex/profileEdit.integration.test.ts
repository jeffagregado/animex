/// <reference types="vite/client" />

import betterAuthTest from '@convex-dev/better-auth/test'
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'

import { api, components } from './_generated/api'
import type { Id } from './_generated/dataModel'
import schema from './schema'

const modules = import.meta.glob([
  './_generated/**/*.*',
  './{profiles,users}.ts',
])
// Generated API is controller-owned and intentionally not regenerated here.
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
): Promise<Id<'users'>> => await t.run(async (ctx) => {
  const now = Date.now()
  return await ctx.db.insert('users', {
    authId,
    username: 'RinkoFan',
    usernameKey: 'rinkofan',
    name: 'Rinko',
    bio: 'Seasonal reviews',
    profileVisibility: 'public',
    visibility: 'private',
    createdAt: now,
    updatedAt: now,
  })
})

const readProfile = async (
  t: ReturnType<typeof createHarness>,
  profileId: Id<'users'>,
) => await t.run(async (ctx) => await ctx.db.get('users', profileId))

const captureConvexError = async (
  promise: Promise<unknown>,
): Promise<{ data: unknown }> => {
  try {
    await promise
  } catch (error) {
    return error as { data: unknown }
  }
  throw new Error('Expected mutation to reject.')
}

describe('Profile edit Convex integration', () => {
  test('requires an authenticated completed Profile owner', async () => {
    const t = createHarness()

    await expect(t.mutation(profileApi.profiles.update, {
      name: 'Updated',
      bio: '',
      profileVisibility: 'private',
    })).rejects.toThrow('Unauthenticated')
  })

  test('returns stable first field errors and rejects non-editable fields', async () => {
    const t = createHarness()
    const owner = await createAuthUser(t, 'profile-edit-invalid')
    await insertProfile(t, owner.authId)

    const error = await captureConvexError(owner.client.mutation(
      profileApi.profiles.update,
      {
        name: '   ',
        bio: 'x'.repeat(301),
        profileVisibility: 'followers',
      },
    ))

    expect(error.data).toEqual({
      code: 'PROFILE_EDIT_INVALID',
      message: 'Review the highlighted Profile fields.',
      fieldErrors: {
        name: 'Display name is required.',
        bio: 'Bio must be 300 characters or fewer.',
        profileVisibility: 'Choose Public or Private Profile Visibility.',
      },
    })
    await expect(owner.client.mutation(profileApi.profiles.update, {
      name: 'Rinko',
      bio: '',
      profileVisibility: 'public',
      username: 'changed',
    } as never)).rejects.toThrow()
  })

  test('trims text, removes an empty bio, changes visibility, and updates search', async () => {
    const t = createHarness()
    const owner = await createAuthUser(t, 'profile-edit-owner')
    const profileId = await insertProfile(t, owner.authId)

    await owner.client.mutation(profileApi.profiles.update, {
      name: '  Rinko Updated  ',
      bio: '   ',
      profileVisibility: 'private',
    })

    const profile = await readProfile(t, profileId)
    const projection = await t.run(async (ctx) => await ctx.db
      .query('userSearchDocuments')
      .withIndex('by_user', (q) => q.eq('userId', profileId))
      .unique())
    expect(profile).toMatchObject({
      name: 'Rinko Updated',
      profileVisibility: 'private',
      visibility: 'private',
    })
    expect(profile).not.toHaveProperty('bio')
    expect(projection).toMatchObject({
      userId: profileId,
      searchText: 'rinko updated rinkofan',
    })
  })

  test('rolls back the Profile patch when the search projection cannot update', async () => {
    const t = createHarness()
    const owner = await createAuthUser(t, 'profile-edit-rollback')
    const profileId = await insertProfile(t, owner.authId)
    await t.run(async (ctx) => {
      await ctx.db.insert('userSearchDocuments', {
        userId: profileId,
        searchText: 'first',
        updatedAt: 1,
      })
      await ctx.db.insert('userSearchDocuments', {
        userId: profileId,
        searchText: 'second',
        updatedAt: 2,
      })
    })

    await expect(owner.client.mutation(profileApi.profiles.update, {
      name: 'Must Roll Back',
      bio: 'Changed',
      profileVisibility: 'private',
    })).rejects.toThrow('USER_SEARCH_CORRUPT')

    expect(await readProfile(t, profileId)).toMatchObject({
      name: 'Rinko',
      bio: 'Seasonal reviews',
      profileVisibility: 'public',
    })
  })
})
