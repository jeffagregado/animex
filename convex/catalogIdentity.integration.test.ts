/// <reference types="vite/client" />

import { makeFunctionReference } from 'convex/server'
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { resolveCatalogEntityByPublicId } from './catalogIdentityModel'
import schema from './schema'

type Kind = 'anime' | 'character' | 'staff'
type ProviderRef = {
  provider: 'anilist'
  kind: Kind
  providerId: number
}
type PublicIdentity = {
  publicId: string
  kind: Kind
}

const modules = import.meta.glob(['./_generated/**/*.*', './{animeCache,catalogIdentity}.ts'])
const ensureProviderRefs = makeFunctionReference<
  'mutation',
  { token: string; refs: ProviderRef[] },
  PublicIdentity[]
>('catalogIdentity:ensureProviderRefs')
const resolveProviderRefs = makeFunctionReference<
  'query',
  { token: string; refs: ProviderRef[] },
  PublicIdentity[]
>('catalogIdentity:resolveProviderRefs')

const token = 'catalog-identity-test-token'
const ref = (providerId: number, kind: Kind = 'anime'): ProviderRef => ({
  provider: 'anilist',
  kind,
  providerId,
})
const createHarness = () => convexTest(schema, modules)

beforeEach(() => {
  vi.stubEnv('DISCOVER_CACHE_WRITE_TOKEN', token)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('catalog identity registry', () => {
  test('requires cache-write authorization and strict registered arguments', async () => {
    const t = createHarness()
    await expect(t.mutation(ensureProviderRefs, {
      token: 'wrong',
      refs: [ref(1)],
    })).rejects.toThrow('CACHE_WRITE_UNAUTHORIZED')
    await expect(t.query(resolveProviderRefs, {
      token: 'wrong',
      refs: [ref(1)],
    })).rejects.toThrow('CACHE_WRITE_UNAUTHORIZED')
    await expect(t.mutation(ensureProviderRefs, {
      refs: [ref(1)],
    } as never)).rejects.toThrow()
    await expect(t.query(resolveProviderRefs, {
      token,
      refs: [ref(1)],
      unexpected: true,
    } as never)).rejects.toThrow()
  })

  test('returns stable serialized public IDs in input order under retries', async () => {
    const t = createHarness()
    const refs = [ref(22, 'staff'), ref(11), ref(33, 'character')]

    const first = await t.mutation(ensureProviderRefs, { token, refs })
    const second = await t.mutation(ensureProviderRefs, { token, refs })
    expect(second).toEqual(first)
    expect(first.map((identity) => identity.kind)).toEqual(['staff', 'anime', 'character'])

    const rows = await t.run(async (ctx) => await ctx.db.query('catalogProviderRefs').collect())
    expect(rows).toHaveLength(3)
    for (const identity of first) {
      const row = rows.find((candidate) => String(candidate.entityId) === identity.publicId)
      expect(row).toBeDefined()
    }
    const entities = await t.run(async (ctx) => await ctx.db.query('catalogEntities').collect())
    expect(entities).toHaveLength(3)
    expect(entities.every((entity) => !('publicId' in entity))).toBe(true)
  })

  test('keeps Character and Staff provider namespaces separate', async () => {
    const t = createHarness()
    const identities = await t.mutation(ensureProviderRefs, {
      token,
      refs: [ref(1, 'character'), ref(1, 'staff')],
    })

    expect(identities[0]?.publicId).not.toBe(identities[1]?.publicId)
    await expect(t.query(resolveProviderRefs, {
      token,
      refs: [ref(1, 'staff'), ref(1, 'character')],
    })).resolves.toEqual([identities[1], identities[0]])
  })

  test('resolves public IDs through Convex table-ID validation', async () => {
    const t = createHarness()
    const [identity] = await t.mutation(ensureProviderRefs, {
      token,
      refs: [ref(1, 'character')],
    })
    expect(identity).toBeDefined()
    await expect(t.run(async (ctx) => await resolveCatalogEntityByPublicId(
      ctx,
      identity?.publicId ?? '',
    ))).resolves.toMatchObject({ kind: 'character' })
    await expect(t.run(async (ctx) => await resolveCatalogEntityByPublicId(
      ctx,
      ` ${identity?.publicId ?? ''} `,
    ))).resolves.toMatchObject({ kind: 'character' })
    await expect(t.run(async (ctx) => await resolveCatalogEntityByPublicId(
      ctx,
      '52991',
    ))).rejects.toThrow('CATALOG_PUBLIC_ID_INVALID')
  })

  test('rejects invalid, duplicate, oversized, and missing references explicitly', async () => {
    const t = createHarness()
    await expect(t.mutation(ensureProviderRefs, {
      token,
      refs: [ref(0)],
    })).rejects.toThrow('PROVIDER_REF_INVALID')
    await expect(t.mutation(ensureProviderRefs, {
      token,
      refs: [ref(1), ref(1)],
    })).rejects.toThrow('PROVIDER_REF_DUPLICATE')
    await expect(t.mutation(ensureProviderRefs, {
      token,
      refs: Array.from({ length: 101 }, (_, index) => ref(index + 1)),
    })).rejects.toThrow('PROVIDER_REF_BATCH_LIMIT_EXCEEDED')
    await expect(t.query(resolveProviderRefs, {
      token,
      refs: [ref(404)],
    })).rejects.toThrow('CATALOG_PROVIDER_REF_MISSING')
  })

  test('rejects corrupt entity-kind and duplicate entity-provider mappings', async () => {
    const t = createHarness()
    await t.run(async (ctx) => {
      const now = Date.now()
      const entityId = await ctx.db.insert('catalogEntities', {
        kind: 'character',
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('catalogProviderRefs', {
        entityId,
        provider: 'anilist',
        kind: 'staff',
        providerId: 41,
        createdAt: now,
        updatedAt: now,
      })
    })
    await expect(t.query(resolveProviderRefs, {
      token,
      refs: [ref(41, 'staff')],
    })).rejects.toThrow('CATALOG_ENTITY_KIND_CONFLICT')

    const second = createHarness()
    await second.run(async (ctx) => {
      const now = Date.now()
      const entityId = await ctx.db.insert('catalogEntities', {
        kind: 'anime',
        createdAt: now,
        updatedAt: now,
      })
      for (const providerId of [51, 52]) {
        await ctx.db.insert('catalogProviderRefs', {
          entityId,
          provider: 'anilist',
          kind: 'anime',
          providerId,
          createdAt: now,
          updatedAt: now,
        })
      }
    })
    await expect(second.query(resolveProviderRefs, {
      token,
      refs: [ref(51)],
    })).rejects.toThrow('CATALOG_ENTITY_PROVIDER_CONFLICT')
  })
})
