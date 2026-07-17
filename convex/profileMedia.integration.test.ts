/// <reference types="vite/client" />

import betterAuthTest from '@convex-dev/better-auth/test'
import { makeFunctionReference } from 'convex/server'
import { convexTest } from 'convex-test'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { components } from './_generated/api'
import type { Id } from './_generated/dataModel'
import schema from './schema'

type Kind = 'avatar' | 'banner'
const modules = import.meta.glob(['./_generated/**/*.*', './{profileMedia,profiles,users}.ts'])
const generateUploadUrl = makeFunctionReference<'mutation', { kind: Kind }, string>(
  'profileMedia:generateUploadUrl',
)
const registerPending = makeFunctionReference<
  'mutation',
  { kind: Kind; storageId: Id<'_storage'> },
  null
>('profileMedia:registerPending')
const finalize = makeFunctionReference<
  'action',
  { kind: Kind; storageId: Id<'_storage'> },
  null
>('profileMedia:finalize')
const remove = makeFunctionReference<'mutation', { kind: Kind }, null>('profileMedia:remove')
const cleanupExpired = makeFunctionReference<
  'action',
  { cursor: string | null; now: number },
  null
>('profileMedia:cleanupExpired')
const cleanupExpiredCandidate = makeFunctionReference<
  'mutation',
  { uploadId: Id<'profileMediaUploads'>; now: number },
  null
>('profileMedia:cleanupExpiredCandidate')

const text = (value: string): number[] => [...new TextEncoder().encode(value)]
const u24 = (value: number): number[] => [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff]
const u32 = (value: number): number[] => [
  value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff,
]
const validWebp = (kind: Kind): Uint8Array => {
  const [width, height] = kind === 'avatar' ? [512, 512] : [1600, 400]
  const payload = [0, 0, 0, 0, ...u24(width - 1), ...u24(height - 1)]
  const chunk = [...text('VP8X'), ...u32(payload.length), ...payload]
  return Uint8Array.from([...text('RIFF'), ...u32(chunk.length + 4), ...text('WEBP'), ...chunk])
}
const createHarness = () => {
  const t = convexTest(schema, modules)
  betterAuthTest.register(t)
  return t
}
type Harness = ReturnType<typeof createHarness>

const createOwner = async (t: Harness, label: string) => {
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
  const profileId = await t.run(async (ctx) => await ctx.db.insert('users', {
    authId: user._id,
    username: label,
    usernameKey: label,
    name: label,
    profileVisibility: 'public',
    visibility: 'private',
    createdAt: now,
    updatedAt: now,
  }))
  return {
    client: t.withIdentity({ subject: user._id, sessionId: session._id } as never),
    profileId,
  }
}
const store = async (t: Harness, bytes: Uint8Array): Promise<Id<'_storage'>> =>
  await t.action(async (ctx) => await ctx.storage.store(new Blob([Uint8Array.from(bytes)])))
const exists = async (t: Harness, storageId: Id<'_storage'>): Promise<boolean> =>
  await t.run(async (ctx) => Boolean(await ctx.db.system.get('_storage', storageId)))
const pending = async (t: Harness, storageId: Id<'_storage'>) =>
  await t.run(async (ctx) => await ctx.db
    .query('profileMediaUploads')
    .withIndex('by_storage', (q) => q.eq('storageId', storageId))
    .unique())
const setReference = async (
  t: Harness,
  profileId: Id<'users'>,
  kind: Kind,
  storageId: Id<'_storage'>,
) => await t.run(async (ctx) => await ctx.db.patch('users', profileId, {
  [kind === 'avatar' ? 'avatarStorageId' : 'bannerStorageId']: storageId,
}))
const errorCode = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise
  } catch (error) {
    return (error as { data?: { code?: string } }).data?.code ?? ''
  }
  throw new Error('Expected function to reject.')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Profile media registration', () => {
  test('requires a Profile owner and verifies storage exists', async () => {
    const t = createHarness()
    await expect(t.mutation(generateUploadUrl, { kind: 'avatar' })).rejects.toThrow('Unauthenticated')
    const owner = await createOwner(t, 'media-owner')
    await expect(owner.client.mutation(generateUploadUrl, { kind: 'avatar' })).resolves.toContain('/upload?')
    const missing = await store(t, validWebp('avatar'))
    await t.action(async (ctx) => await ctx.storage.delete(missing))
    expect(await errorCode(owner.client.mutation(registerPending, {
      kind: 'avatar',
      storageId: missing,
    }))).toBe('PROFILE_MEDIA_NOT_FOUND')
  })

  test('rejects duplicate, current avatar/banner, and another pending claim', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'register-owner')
    const other = await createOwner(t, 'register-other')
    const pendingStorage = await store(t, validWebp('avatar'))
    await owner.client.mutation(registerPending, { kind: 'avatar', storageId: pendingStorage })
    expect(await errorCode(other.client.mutation(registerPending, {
      kind: 'banner',
      storageId: pendingStorage,
    }))).toBe('PROFILE_MEDIA_ALREADY_CLAIMED')

    for (const kind of ['avatar', 'banner'] as const) {
      const claimed = await store(t, validWebp(kind))
      await setReference(t, other.profileId, kind, claimed)
      expect(await errorCode(owner.client.mutation(registerPending, {
        kind,
        storageId: claimed,
      }))).toBe('PROFILE_MEDIA_ALREADY_CLAIMED')
    }
  })
})

describe('Profile media finalization', () => {
  test('rejects wrong owner, purpose, and expired registration', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'finalize-owner')
    const other = await createOwner(t, 'finalize-other')
    const storageId = await store(t, validWebp('avatar'))
    await owner.client.mutation(registerPending, { kind: 'avatar', storageId })

    expect(await errorCode(other.client.action(finalize, { kind: 'avatar', storageId })))
      .toBe('PROFILE_MEDIA_FORBIDDEN')
    expect(await errorCode(owner.client.action(finalize, { kind: 'banner', storageId })))
      .toBe('PROFILE_MEDIA_PURPOSE_MISMATCH')
    await t.run(async (ctx) => {
      const row = await ctx.db.query('profileMediaUploads')
        .withIndex('by_storage', (q) => q.eq('storageId', storageId)).unique()
      if (!row) throw new Error('Missing pending row.')
      await ctx.db.patch('profileMediaUploads', row._id, { expiresAt: Date.now() - 1 })
    })
    expect(await errorCode(owner.client.action(finalize, { kind: 'avatar', storageId })))
      .toBe('PROFILE_MEDIA_EXPIRED')
    expect(await pending(t, storageId)).toBeNull()
    expect(await exists(t, storageId)).toBe(false)
  })

  test('invalid bytes delete only owned unreferenced candidate', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'invalid-owner')
    const storageId = await store(t, Uint8Array.from([1, 2, 3]))
    await owner.client.mutation(registerPending, { kind: 'avatar', storageId })
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(new Blob([Uint8Array.from([1, 2, 3])]))))

    expect(await errorCode(owner.client.action(finalize, { kind: 'avatar', storageId })))
      .toBe('PROFILE_MEDIA_INVALID')
    expect(await pending(t, storageId)).toBeNull()
    expect(await exists(t, storageId)).toBe(false)
  })

  test('successful swap commits new reference before deleting old storage', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'swap-owner')
    const oldStorage = await store(t, validWebp('avatar'))
    const newStorage = await store(t, validWebp('avatar'))
    await setReference(t, owner.profileId, 'avatar', oldStorage)
    await owner.client.mutation(registerPending, { kind: 'avatar', storageId: newStorage })
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(new Blob([Uint8Array.from(validWebp('avatar'))]))))

    await owner.client.action(finalize, { kind: 'avatar', storageId: newStorage })

    const profile = await t.run(async (ctx) => await ctx.db.get('users', owner.profileId))
    expect(profile?.avatarStorageId).toBe(newStorage)
    expect(await pending(t, newStorage)).toBeNull()
    expect(await exists(t, newStorage)).toBe(true)
    expect(await exists(t, oldStorage)).toBe(false)
  })

  test('finalize race preserves candidate claimed by a new reference', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'race-owner')
    const other = await createOwner(t, 'race-other')
    const storageId = await store(t, validWebp('avatar'))
    await owner.client.mutation(registerPending, { kind: 'avatar', storageId })
    vi.stubGlobal('fetch', vi.fn(async () => {
      await setReference(t, other.profileId, 'avatar', storageId)
      return new Response(new Blob([Uint8Array.from(validWebp('avatar'))]))
    }))

    expect(await errorCode(owner.client.action(finalize, { kind: 'avatar', storageId })))
      .toBe('PROFILE_MEDIA_ALREADY_CLAIMED')
    expect(await pending(t, storageId)).toBeNull()
    expect(await exists(t, storageId)).toBe(true)
  })
})

describe('Profile media removal and expiry cleanup', () => {
  test('removal clears owner reference but preserves shared or pending storage', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'remove-owner')
    const other = await createOwner(t, 'remove-other')
    const storageId = await store(t, validWebp('avatar'))
    await setReference(t, owner.profileId, 'avatar', storageId)
    await setReference(t, other.profileId, 'banner', storageId)

    await owner.client.mutation(remove, { kind: 'avatar' })

    const profile = await t.run(async (ctx) => await ctx.db.get('users', owner.profileId))
    expect(profile?.avatarStorageId).toBeUndefined()
    expect(await exists(t, storageId)).toBe(true)
  })

  test('cleanup deletes expired registered storage only', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'cleanup-owner')
    const expired = await store(t, validWebp('avatar'))
    const active = await store(t, validWebp('banner'))
    const unrelated = await store(t, validWebp('avatar'))
    await owner.client.mutation(registerPending, { kind: 'avatar', storageId: expired })
    await owner.client.mutation(registerPending, { kind: 'banner', storageId: active })
    const now = Date.now()
    await t.run(async (ctx) => {
      const row = await ctx.db.query('profileMediaUploads')
        .withIndex('by_storage', (q) => q.eq('storageId', expired)).unique()
      if (!row) throw new Error('Missing expired row.')
      await ctx.db.patch('profileMediaUploads', row._id, { expiresAt: now - 1 })
    })

    await t.action(cleanupExpired, { cursor: null, now })

    expect(await exists(t, expired)).toBe(false)
    expect(await exists(t, active)).toBe(true)
    expect(await exists(t, unrelated)).toBe(true)
  })

  test('cleanup race recheck preserves storage finalized after stale selection', async () => {
    const t = createHarness()
    const owner = await createOwner(t, 'cleanup-race-owner')
    const storageId = await store(t, validWebp('avatar'))
    await owner.client.mutation(registerPending, { kind: 'avatar', storageId })
    const row = await pending(t, storageId)
    if (!row) throw new Error('Missing pending row.')
    await t.run(async (ctx) => {
      await ctx.db.patch('users', owner.profileId, { avatarStorageId: storageId })
      await ctx.db.delete('profileMediaUploads', row._id)
    })

    await t.mutation(cleanupExpiredCandidate, { uploadId: row._id, now: Date.now() + 60 * 60 * 1000 })

    expect(await exists(t, storageId)).toBe(true)
  })
})
