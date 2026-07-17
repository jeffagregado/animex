import { describe, expect, test } from 'vitest'

import { AniListRequestError } from '../../../lib/anilist-client.server'
import {
  getCatalogPersonServer,
  getCatalogPersonWorksServer,
  type CatalogPersonCacheDependencies,
} from './catalog-person-cache.server'

const detail = { kind: 'character' as const, id: 12, name: 'Frieren', nativeName: null, imageUrl: null, description: null, age: null, gender: null, birthday: null, bloodType: null }
const page = { items: [], currentPage: 1, hasNextPage: false, perPage: 20 as const }
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
})

describe('catalog person cache orchestration', () => {
  test('returns fresh detail without upstream request', async () => {
    const dependencies = deps()
    dependencies.client.readDetail = async () => ({ status: 'fresh', entry: { payload: detail, refreshedAt: 1, expiresAt: 2 } })
    dependencies.fetchDetail = async () => { throw new Error('must not fetch') }
    await expect(getCatalogPersonServer('character', 12, dependencies)).resolves.toMatchObject({ status: 'ready', entry: { detail } })
  })

  test('winner commits and rereads work while preserving order', async () => {
    const dependencies = deps()
    let reads = 0
    dependencies.client.readWorkPage = async () => ++reads === 1
      ? { status: 'expired', entry: null }
      : { status: 'fresh', entry: { payload: page, refreshedAt: 1, expiresAt: 2 } }
    dependencies.client.acquireLease = async () => ({ acquired: true, leaseUntil: 60_000 })
    let committed = false
    dependencies.client.commitWorkPage = async () => { committed = true }
    await expect(getCatalogPersonWorksServer('character', 12, 1, dependencies)).resolves.toEqual({ status: 'ready', page })
    expect(committed).toBe(true)
  })

  test('contender rereads six times and never returns expired data', async () => {
    const dependencies = deps()
    let delays = 0
    dependencies.delay = async () => { delays += 1 }
    await expect(getCatalogPersonServer('character', 12, dependencies)).resolves.toMatchObject({ status: 'error', code: 'UPSTREAM' })
    expect(delays).toBe(6)
  })

  test('releases missing detail and preserves rate-limit error', async () => {
    const dependencies = deps()
    dependencies.client.acquireLease = async () => ({ acquired: true, leaseUntil: 60_000 })
    let releases = 0
    dependencies.client.releaseLease = async () => { releases += 1; return true }
    dependencies.fetchDetail = async () => null
    await expect(getCatalogPersonServer('character', 12, dependencies)).resolves.toEqual({ status: 'not-found' })
    dependencies.fetchDetail = async () => { throw new AniListRequestError('RATE_LIMITED', 'AniList rate limit exceeded.', 10) }
    await expect(getCatalogPersonServer('character', 12, dependencies)).resolves.toMatchObject({ status: 'error', code: 'RATE_LIMITED', retryAfterSeconds: 10 })
    expect(releases).toBe(2)
  })
})
