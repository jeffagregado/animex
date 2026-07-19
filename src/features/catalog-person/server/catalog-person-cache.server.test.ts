import { describe, expect, test } from 'vitest'

import { AniListRequestError } from '../../../lib/anilist-client.server'
import { CatalogIdentityGatewayError } from '../../catalog-identity/server/catalog-identity.server'
import {
  getCatalogPersonServer,
  getCatalogPersonWorksServer,
  type CatalogPersonCacheDependencies,
} from './catalog-person-cache.server'

const detail = {
  kind: 'character' as const,
  id: 12,
  name: 'Frieren',
  nativeName: null,
  imageUrl: null,
  description: null,
  age: null,
  gender: null,
  birthday: null,
  bloodType: null,
  voiceActorScope: 'all-languages' as const,
  voiceActors: [],
}
const page = { items: [], currentPage: 1, hasNextPage: false, perPage: 20 as const }
const workPage = {
  items: [{
    anime: {
      id: 1,
      slug: 'one',
      title: 'One',
      coverImageUrl: null,
      format: 'TV' as const,
      seasonYear: 2025,
    },
    role: 'Main',
  }],
  currentPage: 1,
  hasNextPage: false,
  perPage: 20 as const,
}
const deps = (): CatalogPersonCacheDependencies => ({
  client: {
    readDetail: async () => ({ status: 'missing', entry: null }),
    readWorkPage: async () => ({ status: 'missing', entry: null }),
    acquireLease: async () => ({ acquired: false, leaseUntil: 60_000 }),
    commitDetail: async () => {},
    commitWorkPage: async () => {},
    releaseLease: async () => true,
  },
  writeToken: 'token', createLeaseId: () => 'lease', delay: async () => {}, warn: () => {},
  fetchDetail: async () => detail,
  fetchWorks: async () => ({ page, summaries: [] }),
  identity: {
    ensurePublicIds: async (refs) => refs.map((ref) => ({
      kind: ref.kind,
      publicId: `${ref.kind}_${ref.providerId}`,
    })),
    resolvePublicIds: async (refs) => refs.map((ref) => ({
      kind: ref.kind,
      publicId: `${ref.kind}_${ref.providerId}`,
    })),
    resolveProviderByPublicId: async ({ kind }) => ({
      provider: 'anilist',
      kind,
      providerId: 12,
    }),
  },
})

describe('catalog person cache orchestration', () => {
  test('passes the configured server token to raw detail and work reads', async () => {
    const detailTokens: Array<string | undefined> = []
    const workTokens: Array<string | undefined> = []
    const dependencies = deps()
    dependencies.client.readDetail = async (_kind, _personId, token) => {
      detailTokens.push(token)
      return { status: 'fresh', entry: { payload: detail, refreshedAt: 1, expiresAt: 2 } }
    }
    dependencies.client.readWorkPage = async (_kind, _personId, _page, token) => {
      workTokens.push(token)
      return { status: 'fresh', entry: { payload: page, refreshedAt: 1, expiresAt: 2 } }
    }

    await getCatalogPersonServer('character', 'character_12', dependencies)
    await getCatalogPersonWorksServer('character', 'character_12', 1, dependencies)

    expect(detailTokens).toEqual(['token'])
    expect(workTokens).toEqual(['token'])
  })

  test('returns fresh detail without upstream request', async () => {
    const dependencies = deps()
    dependencies.client.readDetail = async () => ({ status: 'fresh', entry: { payload: detail, refreshedAt: 1, expiresAt: 2 } })
    dependencies.fetchDetail = async () => { throw new Error('must not fetch') }
    dependencies.identity.ensurePublicIds = async () => { throw new Error('must not ensure cached identities') }
    await expect(getCatalogPersonServer('character', 'character_12', dependencies)).resolves.toMatchObject({
      status: 'ready',
      entry: { detail: { publicId: 'character_12' } },
    })
  })

  test('ensures identities once for a fresh provider detail while caching raw data', async () => {
    const dependencies = deps()
    let reads = 0
    dependencies.client.readDetail = async () => ++reads === 1
      ? { status: 'missing', entry: null }
      : { status: 'fresh', entry: { payload: detail, refreshedAt: 1, expiresAt: 2 } }
    dependencies.client.acquireLease = async () => ({ acquired: true, leaseUntil: 60_000 })
    const ensured: number[][] = []
    dependencies.identity.ensurePublicIds = async (refs) => {
      ensured.push(refs.map((ref) => ref.providerId))
      return refs.map((ref) => ({ kind: ref.kind, publicId: `${ref.kind}_${ref.providerId}` }))
    }
    dependencies.identity.resolvePublicIds = async () => {
      throw new Error('must not resolve fresh provider identities')
    }
    let committed = false
    dependencies.client.commitDetail = async (_kind, _id, raw) => {
      committed = raw.id === 12
    }

    await expect(
      getCatalogPersonServer('character', 'character_12', dependencies),
    ).resolves.toMatchObject({
      status: 'ready',
      entry: { detail: { publicId: 'character_12' } },
    })
    expect(ensured).toEqual([[12]])
    expect(committed).toBe(true)
  })

  test('winner commits and rereads work while preserving order', async () => {
    const dependencies = deps()
    dependencies.fetchWorks = async () => ({ page: workPage, summaries: [] })
    let reads = 0
    dependencies.client.readWorkPage = async () => ++reads === 1
      ? { status: 'expired', entry: null }
      : { status: 'fresh', entry: { payload: workPage, refreshedAt: 1, expiresAt: 2 } }
    dependencies.client.acquireLease = async () => ({ acquired: true, leaseUntil: 60_000 })
    let committed = false
    dependencies.client.commitWorkPage = async () => { committed = true }
    await expect(
      getCatalogPersonWorksServer('character', 'character_12', 1, dependencies),
    ).resolves.toMatchObject({
      status: 'ready',
      page: { items: [{ anime: { publicId: 'anime_1' } }] },
    })
    expect(committed).toBe(true)
  })

  test('resolves cached work identities without writes', async () => {
    const dependencies = deps()
    dependencies.client.readWorkPage = async () => ({
      status: 'fresh',
      entry: { payload: workPage, refreshedAt: 1, expiresAt: 2 },
    })
    const calls: string[] = []
    dependencies.identity.resolvePublicIds = async (refs) => {
      calls.push('resolve')
      return refs.map((ref) => ({ kind: ref.kind, publicId: `${ref.kind}_${ref.providerId}` }))
    }
    dependencies.identity.ensurePublicIds = async () => {
      calls.push('ensure')
      throw new Error('must not ensure cached work identities')
    }

    await expect(
      getCatalogPersonWorksServer('character', 'character_12', 1, dependencies),
    ).resolves.toMatchObject({
      status: 'ready',
      page: { items: [{ anime: { publicId: 'anime_1' } }] },
    })
    expect(calls).toEqual(['resolve'])
  })

  test('contender rereads six times and never returns expired data', async () => {
    const dependencies = deps()
    let delays = 0
    dependencies.delay = async () => { delays += 1 }
    await expect(getCatalogPersonServer('character', 'character_12', dependencies)).resolves.toMatchObject({ status: 'error', code: 'UPSTREAM' })
    expect(delays).toBe(6)
  })

  test('releases missing detail and preserves rate-limit error', async () => {
    const dependencies = deps()
    dependencies.client.acquireLease = async () => ({ acquired: true, leaseUntil: 60_000 })
    let releases = 0
    dependencies.client.releaseLease = async () => { releases += 1; return true }
    dependencies.fetchDetail = async () => null
    await expect(getCatalogPersonServer('character', 'character_12', dependencies)).resolves.toEqual({ status: 'not-found' })
    dependencies.fetchDetail = async () => { throw new AniListRequestError('RATE_LIMITED', 'AniList rate limit exceeded.', 10) }
    await expect(getCatalogPersonServer('character', 'character_12', dependencies)).resolves.toMatchObject({ status: 'error', code: 'RATE_LIMITED', retryAfterSeconds: 10 })
    expect(releases).toBe(2)
  })

  test('returns explicit missing identity without refetching cached detail', async () => {
    const dependencies = deps()
    dependencies.client.readDetail = async () => ({
      status: 'fresh',
      entry: { payload: detail, refreshedAt: 1, expiresAt: 2 },
    })
    dependencies.identity.resolvePublicIds = async () => {
      throw new CatalogIdentityGatewayError('CATALOG_IDENTITY_MISSING')
    }
    dependencies.fetchDetail = async () => {
      throw new Error('must not refetch')
    }

    await expect(
      getCatalogPersonServer('character', 'character_12', dependencies),
    ).resolves.toEqual({
      status: 'error',
      code: 'CATALOG_IDENTITY_MISSING',
      message: 'CATALOG_IDENTITY_MISSING',
      retryAfterSeconds: null,
    })
  })
})
