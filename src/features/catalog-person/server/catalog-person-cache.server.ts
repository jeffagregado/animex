import { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'

import { AniListRequestError, createAniListDependencies } from '../../../lib/anilist-client.server'
import { type AnimeSummaryProvider } from '../../discover/server/discover-provider-cache-contracts.server'
import {
  type CatalogPersonProviderDetail,
  type CatalogPersonProviderKind,
  type CatalogPersonProviderWorkPage,
} from './catalog-person-provider-cache-contracts.server'
import {
  fetchCatalogPersonFromAniList,
  fetchCatalogPersonWorksFromAniList,
} from './anilist-person.server'

const CONTENTION_READS = 6
const CONTENTION_DELAY_MS = 500
type CacheRead<T> = { status: 'fresh'; entry: { payload: T; refreshedAt: number; expiresAt: number } } | { status: 'missing' | 'expired'; entry: null }
type ErrorState = { status: 'error'; code: 'UPSTREAM' | 'RATE_LIMITED'; message: string; retryAfterSeconds: number | null }
export type CatalogPersonState = { status: 'ready'; entry: { detail: CatalogPersonProviderDetail; refreshedAt: number; expiresAt: number } } | { status: 'not-found' } | ErrorState
export type CatalogPersonWorksState = { status: 'ready'; page: CatalogPersonProviderWorkPage } | { status: 'not-found' } | ErrorState
type WorkFetch = { page: CatalogPersonProviderWorkPage; summaries: AnimeSummaryProvider[] }

export interface CatalogPersonCacheClient {
  readDetail: (kind: CatalogPersonProviderKind, personId: number) => Promise<CacheRead<CatalogPersonProviderDetail>>
  readWorkPage: (kind: CatalogPersonProviderKind, personId: number, page: number) => Promise<CacheRead<CatalogPersonProviderWorkPage>>
  acquireLease: (key: string, leaseId: string, token: string) => Promise<{ acquired: boolean; leaseUntil: number | null }>
  commitDetail: (kind: CatalogPersonProviderKind, personId: number, detail: CatalogPersonProviderDetail, leaseId: string, token: string) => Promise<void>
  commitWorkPage: (kind: CatalogPersonProviderKind, personId: number, page: number, payload: WorkFetch, leaseId: string, token: string) => Promise<void>
  releaseLease: (key: string, leaseId: string, token: string) => Promise<boolean>
}

export interface CatalogPersonCacheDependencies {
  client: CatalogPersonCacheClient
  writeToken: string
  createLeaseId: () => string
  delay: (milliseconds: number) => Promise<void>
  warn: (message: string) => void
  fetchDetail: (kind: CatalogPersonProviderKind, id: number) => Promise<CatalogPersonProviderDetail | null>
  fetchWorks: (kind: CatalogPersonProviderKind, id: number, page: number) => Promise<WorkFetch | null>
}

const readDetailRef = makeFunctionReference<'query', { kind: CatalogPersonProviderKind; personId: number }, CacheRead<CatalogPersonProviderDetail>>('catalogPersonCache:readDetail')
const readWorkRef = makeFunctionReference<'query', { kind: CatalogPersonProviderKind; personId: number; page: number }, CacheRead<CatalogPersonProviderWorkPage>>('catalogPersonCache:readWorkPage')
const acquireRef = makeFunctionReference<'mutation', { key: string; leaseId: string; token: string }, { acquired: boolean; leaseUntil: number | null }>('catalogPersonCache:acquireLease')
const commitDetailRef = makeFunctionReference<'mutation', { kind: CatalogPersonProviderKind; personId: number; detail: CatalogPersonProviderDetail; leaseId: string; token: string }, null>('catalogPersonCache:commitDetail')
const commitWorkRef = makeFunctionReference<'mutation', { kind: CatalogPersonProviderKind; personId: number; page: number; items: Array<{ animeId: number; role: string | null }>; hasNextPage: boolean; summaries: AnimeSummaryProvider[]; leaseId: string; token: string }, null>('catalogPersonCache:commitWorkPage')
const releaseRef = makeFunctionReference<'mutation', { key: string; leaseId: string; token: string }, boolean>('catalogPersonCache:releaseLease')

const errorState = (error: unknown): ErrorState => error instanceof AniListRequestError
  ? { status: 'error', code: error.code, message: error.message, retryAfterSeconds: error.retryAfterSeconds }
  : { status: 'error', code: 'UPSTREAM', message: 'Catalog person is temporarily unavailable.', retryAfterSeconds: null }

const detailKey = (kind: CatalogPersonProviderKind, id: number): string => `person:${kind}:${id}`
const workKey = (kind: CatalogPersonProviderKind, id: number, page: number): string => `person-work:${kind}:${id}:${page}`

const release = async (dependencies: CatalogPersonCacheDependencies, key: string, leaseId: string): Promise<void> => {
  const released = await dependencies.client.releaseLease(key, leaseId, dependencies.writeToken)
  if (!released) throw new TypeError('Catalog person cache lease was not released.')
}

const releasePreserving = async (dependencies: CatalogPersonCacheDependencies, key: string, leaseId: string): Promise<void> => {
  try { await release(dependencies, key, leaseId) } catch { dependencies.warn('Catalog person cache lease release failed while preserving the primary error.') }
}

const readDetailState = async (kind: CatalogPersonProviderKind, id: number, dependencies: CatalogPersonCacheDependencies): Promise<CatalogPersonState | null> => {
  try {
    const read = await dependencies.client.readDetail(kind, id)
    return read.status === 'fresh' ? { status: 'ready', entry: { detail: read.entry.payload, refreshedAt: read.entry.refreshedAt, expiresAt: read.entry.expiresAt } } : null
  } catch (error) { return errorState(error) }
}

const readWorkState = async (kind: CatalogPersonProviderKind, id: number, page: number, dependencies: CatalogPersonCacheDependencies): Promise<CatalogPersonWorksState | null> => {
  try {
    const read = await dependencies.client.readWorkPage(kind, id, page)
    return read.status === 'fresh' ? { status: 'ready', page: read.entry.payload } : null
  } catch (error) { return errorState(error) }
}

const waitDetail = async (kind: CatalogPersonProviderKind, id: number, dependencies: CatalogPersonCacheDependencies): Promise<CatalogPersonState> => {
  for (let attempt = 0; attempt < CONTENTION_READS; attempt += 1) {
    await dependencies.delay(CONTENTION_DELAY_MS)
    const state = await readDetailState(kind, id, dependencies)
    if (state) return state
  }
  return errorState(new Error('Catalog person detail refresh contention.'))
}

const waitWork = async (kind: CatalogPersonProviderKind, id: number, page: number, dependencies: CatalogPersonCacheDependencies): Promise<CatalogPersonWorksState> => {
  for (let attempt = 0; attempt < CONTENTION_READS; attempt += 1) {
    await dependencies.delay(CONTENTION_DELAY_MS)
    const state = await readWorkState(kind, id, page, dependencies)
    if (state) return state
  }
  return errorState(new Error('Catalog person work refresh contention.'))
}

/** Reads or refreshes one person detail without stale success. */
export const getCatalogPersonServer = async (kind: CatalogPersonProviderKind, id: number, dependencies: CatalogPersonCacheDependencies): Promise<CatalogPersonState> => {
  const cached = await readDetailState(kind, id, dependencies)
  if (cached) return cached
  const key = detailKey(kind, id); const leaseId = dependencies.createLeaseId()
  let lease
  try { lease = await dependencies.client.acquireLease(key, leaseId, dependencies.writeToken) } catch (error) { return errorState(error) }
  if (!lease.acquired) return await waitDetail(kind, id, dependencies)
  try {
    const detail = await dependencies.fetchDetail(kind, id)
    if (!detail) { await release(dependencies, key, leaseId); return { status: 'not-found' } }
    await dependencies.client.commitDetail(kind, id, detail, leaseId, dependencies.writeToken)
    return await readDetailState(kind, id, dependencies) ?? errorState(new Error('Committed catalog person detail was unavailable.'))
  } catch (error) {
    await releasePreserving(dependencies, key, leaseId)
    return errorState(error)
  }
}

/** Reads or refreshes one ordered work page without stale success. */
export const getCatalogPersonWorksServer = async (kind: CatalogPersonProviderKind, id: number, page: number, dependencies: CatalogPersonCacheDependencies): Promise<CatalogPersonWorksState> => {
  const cached = await readWorkState(kind, id, page, dependencies)
  if (cached) return cached
  const key = workKey(kind, id, page); const leaseId = dependencies.createLeaseId()
  let lease
  try { lease = await dependencies.client.acquireLease(key, leaseId, dependencies.writeToken) } catch (error) { return errorState(error) }
  if (!lease.acquired) return await waitWork(kind, id, page, dependencies)
  try {
    const payload = await dependencies.fetchWorks(kind, id, page)
    if (!payload) { await release(dependencies, key, leaseId); return { status: 'not-found' } }
    await dependencies.client.commitWorkPage(kind, id, page, payload, leaseId, dependencies.writeToken)
    return await readWorkState(kind, id, page, dependencies) ?? errorState(new Error('Committed catalog person work was unavailable.'))
  } catch (error) {
    await releasePreserving(dependencies, key, leaseId)
    return errorState(error)
  }
}

const requireServerEnv = (name: 'VITE_CONVEX_URL' | 'DISCOVER_CACHE_WRITE_TOKEN'): string => {
  const value = process.env[name]
  if (!value) throw new TypeError(`${name} must be configured on the server.`)
  return value
}

/** Creates production person-cache dependencies from existing server configuration. */
export const createCatalogPersonCacheDependencies = (): CatalogPersonCacheDependencies => {
  const convex = new ConvexHttpClient(requireServerEnv('VITE_CONVEX_URL'))
  const client: CatalogPersonCacheClient = {
    readDetail: async (kind, personId) => await convex.query(readDetailRef, { kind, personId }),
    readWorkPage: async (kind, personId, page) => await convex.query(readWorkRef, { kind, personId, page }),
    acquireLease: async (key, leaseId, token) => await convex.mutation(acquireRef, { key, leaseId, token }),
    commitDetail: async (kind, personId, detail, leaseId, token) => { await convex.mutation(commitDetailRef, { kind, personId, detail, leaseId, token }) },
    commitWorkPage: async (kind, personId, page, payload, leaseId, token) => {
      await convex.mutation(commitWorkRef, { kind, personId, page, items: payload.page.items.map((item) => ({ animeId: item.anime.id, role: item.role })), hasNextPage: payload.page.hasNextPage, summaries: payload.summaries, leaseId, token })
    },
    releaseLease: async (key, leaseId, token) => await convex.mutation(releaseRef, { key, leaseId, token }),
  }
  return {
    client,
    writeToken: requireServerEnv('DISCOVER_CACHE_WRITE_TOKEN'),
    createLeaseId: () => crypto.randomUUID(),
    delay: async (milliseconds) => await new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds)),
    warn: (message) => console.warn(message),
    fetchDetail: async (kind, id) => await fetchCatalogPersonFromAniList(kind, id, createAniListDependencies()),
    fetchWorks: async (kind, id, page) => await fetchCatalogPersonWorksFromAniList(kind, id, page, createAniListDependencies()),
  }
}
