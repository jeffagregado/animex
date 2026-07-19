import { ConvexHttpClient } from 'convex/browser'

import { api } from '../../../../convex/_generated/api'
import { AniListRequestError, createAniListDependencies } from '../../../lib/anilist-client.server'
import {
  CatalogIdentityGatewayError,
  ensurePublicIds,
  resolveProviderByPublicId,
  resolvePublicIds,
  type CatalogIdentityGateway,
} from '../../catalog-identity/server/catalog-identity.server'
import { parseCatalogPublicId } from '../../catalog-identity/shared/catalog-identity-contracts'
import {
  type AnimeCharacter,
  type AnimePeoplePage,
  type AnimeStaff,
  type PublicAnimeDetailState,
} from '../shared/anime-detail-contracts'
import {
  parseProviderAnimePage,
  parseProviderAnilistId,
  type AnimeDetailProvider,
  type AnimeProviderCharacter,
  type AnimeProviderPeopleKind,
  type AnimeProviderPeoplePage,
  type AnimeProviderStaff,
  type AnimeSummaryProvider,
} from './anime-detail-provider-cache-contracts.server'
import { fetchAnimeDetailCachePayload, fetchAnimePeoplePageFromAniList } from './anilist-detail.server'
import { mapAnimeDetail, mapAnimePeoplePage } from './anime-detail-public-mapper.server'

const CONTENTION_READS = 6
const CONTENTION_DELAY_MS = 500

type CacheRead<T> = { status: 'fresh'; entry: { payload: T; refreshedAt: number; expiresAt: number } } | { status: 'missing' | 'expired'; entry: null }
type PeoplePage = AnimeProviderPeoplePage<AnimeProviderCharacter> | AnimeProviderPeoplePage<AnimeProviderStaff>
type PublicPeoplePage = AnimePeoplePage<AnimeCharacter> | AnimePeoplePage<AnimeStaff>
type CacheLease = { acquired: boolean; leaseUntil: number | null }

export type AnimePeoplePageState = { status: 'ready'; page: PublicPeoplePage } | { status: 'not-found' } | { status: 'error'; code: 'UPSTREAM' | 'RATE_LIMITED' | 'CATALOG_IDENTITY_MISSING'; message: string; retryAfterSeconds: number | null }
type AnimeDetailServerState = Extract<PublicAnimeDetailState, { status: 'ready' | 'not-found' | 'error' }>
type CacheErrorState = Extract<PublicAnimeDetailState, { status: 'error' }>

export interface AnimeDetailCacheClient {
  readDetail: (anilistId: number, token: string) => Promise<CacheRead<AnimeDetailProvider>>
  readPeoplePage: (anilistId: number, kind: AnimeProviderPeopleKind, page: number, token: string) => Promise<CacheRead<PeoplePage>>
  acquireLease: (key: string, leaseId: string, token: string) => Promise<{ acquired: boolean; leaseUntil: number | null }>
  commitDetail: (leaseId: string, summary: AnimeSummaryProvider, detail: AnimeDetailProvider, token: string) => Promise<void>
  commitPeoplePage: (anilistId: number, kind: AnimeProviderPeopleKind, page: number, payload: PeoplePage, leaseId: string, token: string) => Promise<void>
  releaseLease: (key: string, leaseId: string, token: string) => Promise<boolean>
}

export interface AnimeDetailCacheDependencies {
  client: AnimeDetailCacheClient
  writeToken: string
  createLeaseId: () => string
  delay: (milliseconds: number) => Promise<void>
  warn: (message: string) => void
  fetchDetail: (anilistId: number) => Promise<{ detail: AnimeDetailProvider; summary: AnimeSummaryProvider } | null>
  fetchPeople: (anilistId: number, kind: AnimeProviderPeopleKind, page: number) => Promise<PeoplePage | null>
  identity: Pick<CatalogIdentityGateway, 'ensurePublicIds' | 'resolvePublicIds' | 'resolveProviderByPublicId'>
}

const errorState = (error: unknown): CacheErrorState => {
  if (error instanceof AniListRequestError) {
    return { status: 'error', code: error.code, message: error.message, retryAfterSeconds: error.retryAfterSeconds }
  }
  if (error instanceof CatalogIdentityGatewayError && error.code === 'CATALOG_IDENTITY_MISSING') {
    return { status: 'error', code: error.code, message: error.message, retryAfterSeconds: null }
  }
  return { status: 'error', code: 'UPSTREAM', message: 'Anime detail is temporarily unavailable.', retryAfterSeconds: null }
}

const peopleErrorState = (error: unknown): Extract<AnimePeoplePageState, { status: 'error' }> => errorState(error)

/** Reverse-resolves one browser-safe Anime identity to the numeric cache key. */
const resolveAnimeProviderId = async (
  publicId: string,
  dependencies: AnimeDetailCacheDependencies,
): Promise<number> => parseProviderAnilistId((await dependencies.identity.resolveProviderByPublicId({
  publicId: parseCatalogPublicId(publicId),
  kind: 'anime',
})).providerId)

const ready = async (
  read: CacheRead<AnimeDetailProvider>,
  dependencies: AnimeDetailCacheDependencies,
): Promise<AnimeDetailServerState | null> => read.status === 'fresh'
  ? {
      status: 'ready',
      entry: {
        detail: await mapAnimeDetail(read.entry.payload, dependencies.identity.resolvePublicIds),
        refreshedAt: read.entry.refreshedAt,
        expiresAt: read.entry.expiresAt,
      },
    }
  : null

const releaseLease = async (dependencies: AnimeDetailCacheDependencies, key: string, leaseId: string): Promise<void> => {
  const released = await dependencies.client.releaseLease(key, leaseId, dependencies.writeToken)
  if (!released) throw new TypeError('Anime detail cache lease was not released.')
}

const releasePreservingError = async (dependencies: AnimeDetailCacheDependencies, key: string, leaseId: string): Promise<void> => {
  try {
    await releaseLease(dependencies, key, leaseId)
  } catch {
    dependencies.warn('Anime detail cache lease release failed while preserving the primary error.')
  }
}

/** Reads one detail and converts cache failures to public errors. */
const readDetailState = async (anilistId: number, dependencies: AnimeDetailCacheDependencies): Promise<AnimeDetailServerState | null> => {
  try {
    return await ready(await dependencies.client.readDetail(anilistId, dependencies.writeToken), dependencies)
  } catch (error) {
    return errorState(error)
  }
}

/** Waits for another request to commit one fresh detail. */
const waitForDetail = async (anilistId: number, dependencies: AnimeDetailCacheDependencies): Promise<AnimeDetailServerState> => {
  for (let attempt = 0; attempt < CONTENTION_READS; attempt += 1) {
    await dependencies.delay(CONTENTION_DELAY_MS)
    const reread = await readDetailState(anilistId, dependencies)
    if (reread) return reread
  }
  return errorState(new Error('Detail refresh lease contention.'))
}

/** Fetches and commits one detail while holding its lease. */
const refreshDetail = async (anilistId: number, key: string, leaseId: string, dependencies: AnimeDetailCacheDependencies): Promise<AnimeDetailServerState> => {
  try {
    const fetched = await dependencies.fetchDetail(anilistId)
    if (fetched === null) {
      try {
        await releaseLease(dependencies, key, leaseId)
      } catch (error) {
        return errorState(error)
      }
      return { status: 'not-found', code: 'NOT_FOUND', message: 'Anime was not found.' }
    }
    const detail = await mapAnimeDetail(fetched.detail, dependencies.identity.ensurePublicIds)
    await dependencies.client.commitDetail(leaseId, fetched.summary, fetched.detail, dependencies.writeToken)
    const reread = await dependencies.client.readDetail(anilistId, dependencies.writeToken)
    return reread.status === 'fresh'
      ? { status: 'ready', entry: { detail, refreshedAt: reread.entry.refreshedAt, expiresAt: reread.entry.expiresAt } }
      : errorState(new Error('Committed detail was unavailable.'))
  } catch (error) {
    await releasePreservingError(dependencies, key, leaseId)
    return errorState(error)
  }
}

/** Reads or refreshes one public detail without serving expired data. */
export const getAnimeDetailServer = async (publicId: string, dependencies: AnimeDetailCacheDependencies): Promise<AnimeDetailServerState> => {
  let id: number
  try {
    id = await resolveAnimeProviderId(publicId, dependencies)
  } catch (error) {
    return errorState(error)
  }
  const cached = await readDetailState(id, dependencies)
  if (cached) return cached
  const key = `detail:${id}`
  const leaseId = dependencies.createLeaseId()
  let lease: CacheLease
  try { lease = await dependencies.client.acquireLease(key, leaseId, dependencies.writeToken) } catch (error) { return errorState(error) }
  if (!lease.acquired) return await waitForDetail(id, dependencies)
  return await refreshDetail(id, key, leaseId, dependencies)
}

/** Reads one people page and converts cache failures to public errors. */
const readPeoplePageState = async (anilistId: number, kind: AnimeProviderPeopleKind, page: number, dependencies: AnimeDetailCacheDependencies): Promise<AnimePeoplePageState | null> => {
  try {
    const cached = await dependencies.client.readPeoplePage(anilistId, kind, page, dependencies.writeToken)
    return cached.status === 'fresh'
      ? { status: 'ready', page: await mapAnimePeoplePage(cached.entry.payload, kind, dependencies.identity.resolvePublicIds) }
      : null
  } catch (error) {
    return peopleErrorState(error)
  }
}

/** Waits for another request to commit one fresh people page. */
const waitForPeoplePage = async (anilistId: number, kind: AnimeProviderPeopleKind, page: number, dependencies: AnimeDetailCacheDependencies): Promise<AnimePeoplePageState> => {
  for (let attempt = 0; attempt < CONTENTION_READS; attempt += 1) {
    await dependencies.delay(CONTENTION_DELAY_MS)
    const reread = await readPeoplePageState(anilistId, kind, page, dependencies)
    if (reread) return reread
  }
  return { status: 'error', code: 'UPSTREAM', message: 'Anime people page is temporarily unavailable.', retryAfterSeconds: null }
}

/** Fetches and commits one people page while holding its lease. */
const refreshPeoplePage = async (anilistId: number, kind: AnimeProviderPeopleKind, page: number, key: string, leaseId: string, dependencies: AnimeDetailCacheDependencies): Promise<AnimePeoplePageState> => {
  try {
    const fetched = await dependencies.fetchPeople(anilistId, kind, page)
    if (fetched === null) {
      try {
        await releaseLease(dependencies, key, leaseId)
      } catch (error) {
        return peopleErrorState(error)
      }
      return { status: 'not-found' }
    }
    const publicPage = await mapAnimePeoplePage(fetched, kind, dependencies.identity.ensurePublicIds)
    await dependencies.client.commitPeoplePage(anilistId, kind, page, fetched, leaseId, dependencies.writeToken)
    const reread = await dependencies.client.readPeoplePage(anilistId, kind, page, dependencies.writeToken)
    if (reread.status !== 'fresh') throw new TypeError('Committed anime people page was unavailable.')
    return { status: 'ready', page: publicPage }
  } catch (error) {
    await releasePreservingError(dependencies, key, leaseId)
    return peopleErrorState(error)
  }
}

/** Reads or refreshes one independent people page without stale fallback. */
export const getAnimePeoplePageServer = async (publicId: string, kind: AnimeProviderPeopleKind, page: number, dependencies: AnimeDetailCacheDependencies): Promise<AnimePeoplePageState> => {
  let id: number
  try {
    id = await resolveAnimeProviderId(publicId, dependencies)
  } catch (error) {
    return peopleErrorState(error)
  }
  const validPage = parseProviderAnimePage(page)
  const cached = await readPeoplePageState(id, kind, validPage, dependencies)
  if (cached) return cached
  const key = `people:${id}:${kind}:${validPage}`
  const leaseId = dependencies.createLeaseId()
  let lease: CacheLease
  try { lease = await dependencies.client.acquireLease(key, leaseId, dependencies.writeToken) } catch (error) { return peopleErrorState(error) }
  if (!lease.acquired) return await waitForPeoplePage(id, kind, validPage, dependencies)
  return await refreshPeoplePage(id, kind, validPage, key, leaseId, dependencies)
}

const requireEnv = (name: 'VITE_CONVEX_URL' | 'DISCOVER_CACHE_WRITE_TOKEN'): string => {
  const value = process.env[name]
  if (!value) throw new TypeError(`${name} must be configured on the server.`)
  return value
}

/** Creates production detail-cache dependencies. */
export const createAnimeDetailCacheDependencies = (): AnimeDetailCacheDependencies => {
  const convex = new ConvexHttpClient(requireEnv('VITE_CONVEX_URL'))
  const client: AnimeDetailCacheClient = {
    readDetail: async (anilistId, token) => await convex.query(api.animeDetailCache.readDetail, { anilistId, token }) as CacheRead<AnimeDetailProvider>,
    readPeoplePage: async (anilistId, kind, page, token) => await convex.query(api.animeDetailCache.readPeoplePage, { anilistId, kind, page, token }) as CacheRead<PeoplePage>,
    acquireLease: async (key, leaseId, token) => await convex.mutation(api.animeDetailCache.acquireLease, { key, leaseId, token }),
    commitDetail: async (leaseId, summary, detail, token) => { await convex.mutation(api.animeDetailCache.commitDetail, { leaseId, summary, detail, token }) },
    commitPeoplePage: async (anilistId, kind, page, payload, leaseId, token) => { await convex.mutation(api.animeDetailCache.commitPeoplePage, { anilistId, kind, page, items: payload.items, hasNextPage: payload.hasNextPage, leaseId, token }) },
    releaseLease: async (key, leaseId, token) => await convex.mutation(api.animeDetailCache.releaseLease, { key, leaseId, token }),
  }
  return {
    client, writeToken: requireEnv('DISCOVER_CACHE_WRITE_TOKEN'), createLeaseId: () => crypto.randomUUID(),
    delay: async (milliseconds) => await new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds)),
    warn: (message) => console.warn(message),
    fetchDetail: async (anilistId) => await fetchAnimeDetailCachePayload(anilistId, createAniListDependencies()),
    fetchPeople: async (anilistId, kind, page) => await fetchAnimePeoplePageFromAniList(anilistId, kind, page, createAniListDependencies()),
    identity: { ensurePublicIds, resolvePublicIds, resolveProviderByPublicId },
  }
}
