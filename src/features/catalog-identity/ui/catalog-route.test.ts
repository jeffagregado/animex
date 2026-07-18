import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ensureCatalogRouteIdentity,
  getCatalogStateStaleTime,
} from './catalog-route'

const getCatalogRouteIdentity = vi.hoisted(() => vi.fn())

vi.mock('../server/catalog-identity.functions', () => ({
  getCatalogRouteIdentity,
}))

describe('catalog route identity cache', () => {
  beforeEach(() => {
    getCatalogRouteIdentity.mockReset()
  })

  it('refetches an unavailable identity while caching a resolved identity', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    getCatalogRouteIdentity
      .mockResolvedValueOnce({
        status: 'unavailable',
        source: 'legacy',
        publicId: null,
        kind: 'anime',
      })
      .mockResolvedValueOnce({
        status: 'resolved',
        source: 'legacy',
        publicId: 'anime_frieren',
        kind: 'anime',
      })

    await expect(ensureCatalogRouteIdentity(queryClient, 'anime', '52991'))
      .resolves.toMatchObject({ status: 'unavailable' })
    await expect(ensureCatalogRouteIdentity(queryClient, 'anime', '52991'))
      .resolves.toMatchObject({ status: 'resolved', publicId: 'anime_frieren' })
    await expect(ensureCatalogRouteIdentity(queryClient, 'anime', '52991'))
      .resolves.toMatchObject({ status: 'resolved', publicId: 'anime_frieren' })
    expect(getCatalogRouteIdentity).toHaveBeenCalledTimes(2)
  })

  it('keeps ready data warm while making explicit errors immediately stale', () => {
    expect(getCatalogStateStaleTime('ready', 900_000)).toBe(900_000)
    expect(getCatalogStateStaleTime('resolved', 900_000)).toBe(900_000)
    expect(getCatalogStateStaleTime('error', 900_000)).toBe(0)
    expect(getCatalogStateStaleTime('unavailable', 900_000)).toBe(0)
  })
})
