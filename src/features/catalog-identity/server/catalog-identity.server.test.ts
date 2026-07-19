import { describe, expect, test } from 'vitest'

import {
  CatalogIdentityGatewayError,
  createCatalogIdentityGateway,
  type CatalogIdentityClient,
} from './catalog-identity.server'

type Kind = 'anime' | 'character' | 'staff'

const ref = (providerId: number, kind: Kind) => ({
  provider: 'anilist' as const,
  kind,
  providerId,
})

const client = (overrides: Partial<CatalogIdentityClient>): CatalogIdentityClient => ({
  ensureProviderRefs: async () => [],
  resolveProviderRefs: async () => [],
  resolveProviderByPublicId: async () => ref(1, 'anime'),
  ...overrides,
})

describe('catalog identity server gateway', () => {
  test('ensures provider tuples once and preserves exact response order', async () => {
    const calls: unknown[] = []
    const gateway = createCatalogIdentityGateway({
      token: 'server-token',
      client: client({
        ensureProviderRefs: async (refs, token) => {
          calls.push({ refs, token })
          return [
            { publicId: 'public_staff', kind: 'staff' },
            { publicId: 'public_anime', kind: 'anime' },
          ]
        },
      }),
    })
    const refs = [ref(2, 'staff'), ref(1, 'anime')]

    await expect(gateway.ensurePublicIds(refs)).resolves.toEqual([
      { publicId: 'public_staff', kind: 'staff' },
      { publicId: 'public_anime', kind: 'anime' },
    ])
    expect(calls).toEqual([{ refs, token: 'server-token' }])
  })

  test('rejects count, order-kind, and invalid-public-ID response corruption', async () => {
    const refs = [ref(1, 'anime'), ref(2, 'staff')]
    const count = createCatalogIdentityGateway({
      token: 'token',
      client: client({
        resolveProviderRefs: async () => [{ publicId: 'public_anime', kind: 'anime' }],
      }),
    })
    const kind = createCatalogIdentityGateway({
      token: 'token',
      client: client({
        resolveProviderRefs: async () => [
          { publicId: 'public_staff', kind: 'staff' },
          { publicId: 'public_anime', kind: 'anime' },
        ],
      }),
    })
    const publicId = createCatalogIdentityGateway({
      token: 'token',
      client: client({
        resolveProviderRefs: async () => [
          { publicId: '1', kind: 'anime' },
          { publicId: 'public_staff', kind: 'staff' },
        ],
      }),
    })

    for (const gateway of [count, kind, publicId]) {
      await expect(gateway.resolvePublicIds(refs)).rejects.toMatchObject({
        code: 'CATALOG_IDENTITY_UNAVAILABLE',
      })
    }
  })

  test('resolves canonical routes through token-gated reverse lookup without leaking provider data', async () => {
    const calls: unknown[] = []
    const gateway = createCatalogIdentityGateway({
      token: 'server-token',
      client: client({
        resolveProviderByPublicId: async (input, token) => {
          calls.push({ input, token })
          return ref(52991, 'anime')
        },
      }),
    })

    const result = await gateway.resolveRouteIdentity({
      rawId: 'public_anime',
      kind: 'anime',
    })

    expect(result).toEqual({
      status: 'resolved',
      source: 'public',
      publicId: 'public_anime',
      kind: 'anime',
    })
    expect(calls).toEqual([{
      input: { publicId: 'public_anime', kind: 'anime' },
      token: 'server-token',
    }])
    expect(JSON.stringify(result)).not.toMatch(/provider|52991|token/)
  })

  test('resolves legacy routes from existing mappings without ensuring new identities', async () => {
    let ensures = 0
    const gateway = createCatalogIdentityGateway({
      token: 'server-token',
      client: client({
        ensureProviderRefs: async () => {
          ensures += 1
          return []
        },
        resolveProviderRefs: async () => [{ publicId: 'public_anime', kind: 'anime' }],
      }),
    })

    await expect(gateway.resolveRouteIdentity({
      rawId: '52991',
      kind: 'anime',
    })).resolves.toEqual({
      status: 'resolved',
      source: 'legacy',
      publicId: 'public_anime',
      kind: 'anime',
    })
    expect(ensures).toBe(0)
  })

  test('returns safe not-found and unavailable route states', async () => {
    const missing = createCatalogIdentityGateway({
      token: 'token',
      client: client({
        resolveProviderRefs: async () => {
          throw new CatalogIdentityGatewayError('CATALOG_IDENTITY_MISSING')
        },
      }),
    })
    const corrupt = createCatalogIdentityGateway({
      token: 'token',
      client: client({
        resolveProviderByPublicId: async () => {
          throw new Error('raw Convex corruption: providerId 52991 token secret')
        },
      }),
    })

    await expect(missing.resolveRouteIdentity({
      rawId: '52991',
      kind: 'anime',
    })).resolves.toEqual({
      status: 'not-found',
      source: 'legacy',
      publicId: null,
      kind: 'anime',
    })
    const unavailable = await corrupt.resolveRouteIdentity({
      rawId: 'public_anime',
      kind: 'anime',
    })
    expect(unavailable).toEqual({
      status: 'unavailable',
      source: 'public',
      publicId: null,
      kind: 'anime',
    })
    expect(JSON.stringify(unavailable)).not.toMatch(/Convex|providerId|52991|token|secret/)
  })
})
