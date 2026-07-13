import { ConvexHttpClient } from 'convex/browser'

import { api } from '../../../../convex/_generated/api'
import { AniListRequestError, createAniListDependencies } from '../../../lib/anilist-client.server'
import { type AnimeSummary } from '../../discover/shared/discover-contracts'
import {
  parseAnilistId,
  parseAnimePage,
  type AnimeCharacter,
  type AnimeDetail,
  type AnimePeopleKind,
  type AnimePeoplePage,
  type AnimeStaff,
  type PublicAnimeDetailState,
} from '../shared/anime-detail-contracts'
import { fetchAnimeDetailCachePayload, fetchAnimePeoplePageFromAniList } from './anilist-detail.server'

const CONTENTION_READS = 6
const CONTENTION_DELAY_MS = 500

type CacheRead<T> = { status: 'fresh'; entry: { payload: T; refreshedAt: number; expiresAt: number } } | { status: 'missing' | 'expired'; entry: null }
type PeoplePage = AnimePeoplePage<AnimeCharacter> | AnimePeoplePage<AnimeStaff>
type CacheLease = { acquired: boolean; leaseUntil: number | null }

export type AnimePeoplePageState = { status: 'ready'; page: PeoplePage } | { status: 'not-found' } | { status: 'error'; code: 'UPSTREAM' | 'RATE_LIMITED'; message: string; retryAfterSeconds: number | null }
type CacheErrorState = Extract<PublicAnimeDetailState, { status: 'error' }>

export interface AnimeDetailCacheClient {
  readDetail: (anilistId: number) => Promise<CacheRead<AnimeDetail>>
  readPeoplePage: (anilistId: number, kind: AnimePeopleKind, page: number) => Promise<CacheRead<PeoplePage>>
  acquireLease: (key: string, leaseId: string, token: string) => Promise<{ acquired: boolean; leaseUntil: number | null }>
  commitDetail: (leaseId: string, summary: AnimeSummary, detail: AnimeDetail, token: string) => Promise<void>
  commitPeoplePage: (anilistId: number, kind: AnimePeopleKind, page: number, payload: PeoplePage, leaseId: string, token: string) => Promise<void>
  releaseLease: (key: string, leaseId: string, token: string) => Promise<boolean>
}

export interface AnimeDetailCacheDependencies {
  client: AnimeDetailCacheClient
  writeToken: string
  createLeaseId: () => string
  delay: (milliseconds: number) => Promise<void>
  warn: (message: string) => void
  fetchDetail: (anilistId: number) => Promise<{ detail: AnimeDetail; summary: AnimeSummary } | null>
  fetchPeople: (anilistId: number, kind: AnimePeopleKind, page: number) => Promise<PeoplePage | null>
}

const errorState = (error: unknown): CacheErrorState => error instanceof AniListRequestError
  ? { status: 'error', code: error.code, message: error.message, retryAfterSeconds: error.retryAfterSeconds }
  : { status: 'error', code: 'UPSTREAM', message: 'Anime detail is temporarily unavailable.', retryAfterSeconds: null }

const peopleErrorState = (error: unknown): Extract<AnimePeoplePageState, { status: 'error' }> => errorState(error)

const ready = (read: CacheRead<AnimeDetail>): PublicAnimeDetailState | null => read.status === 'fresh'
  ? { status: 'ready', entry: { detail: read.entry.payload, refreshedAt: read.entry.refreshedAt, expiresAt: read.entry.expiresAt } }
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
const readDetailState = async (anilistId: number, dependencies: AnimeDetailCacheDependencies): Promise<PublicAnimeDetailState | null> => {
  try {
    return ready(await dependencies.client.readDetail(anilistId))
  } catch (error) {
    return errorState(error)
  }
}

/** Waits for another request to commit one fresh detail. */
const waitForDetail = async (anilistId: number, dependencies: AnimeDetailCacheDependencies): Promise<PublicAnimeDetailState> => {
  for (let attempt = 0; attempt < CONTENTION_READS; attempt += 1) {
    await dependencies.delay(CONTENTION_DELAY_MS)
    const reread = await readDetailState(anilistId, dependencies)
    if (reread) return reread
  }
  return errorState(new Error('Detail refresh lease contention.'))
}

/** Fetches and commits one detail while holding its lease. */
const refreshDetail = async (anilistId: number, key: string, leaseId: string, dependencies: AnimeDetailCacheDependencies): Promise<PublicAnimeDetailState> => {
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
    await dependencies.client.commitDetail(leaseId, fetched.summary, fetched.detail, dependencies.writeToken)
    const reread = ready(await dependencies.client.readDetail(anilistId))
    return reread ?? errorState(new Error('Committed detail was unavailable.'))
  } catch (error) {
    await releasePreservingError(dependencies, key, leaseId)
    return errorState(error)
  }
}

/** Reads or refreshes one public detail without serving expired data. */
export const getAnimeDetailServer = async (anilistId: number, dependencies: AnimeDetailCacheDependencies): Promise<PublicAnimeDetailState> => {
  const id = parseAnilistId(anilistId)
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
const readPeoplePageState = async (anilistId: number, kind: AnimePeopleKind, page: number, dependencies: AnimeDetailCacheDependencies): Promise<AnimePeoplePageState | null> => {
  try {
    const cached = await dependencies.client.readPeoplePage(anilistId, kind, page)
    return cached.status === 'fresh' ? { status: 'ready', page: cached.entry.payload } : null
  } catch (error) {
    return peopleErrorState(error)
  }
}

/** Waits for another request to commit one fresh people page. */
const waitForPeoplePage = async (anilistId: number, kind: AnimePeopleKind, page: number, dependencies: AnimeDetailCacheDependencies): Promise<AnimePeoplePageState> => {
  for (let attempt = 0; attempt < CONTENTION_READS; attempt += 1) {
    await dependencies.delay(CONTENTION_DELAY_MS)
    const reread = await readPeoplePageState(anilistId, kind, page, dependencies)
    if (reread) return reread
  }
  return { status: 'error', code: 'UPSTREAM', message: 'Anime people page is temporarily unavailable.', retryAfterSeconds: null }
}

/** Fetches and commits one people page while holding its lease. */
const refreshPeoplePage = async (anilistId: number, kind: AnimePeopleKind, page: number, key: string, leaseId: string, dependencies: AnimeDetailCacheDependencies): Promise<AnimePeoplePageState> => {
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
    await dependencies.client.commitPeoplePage(anilistId, kind, page, fetched, leaseId, dependencies.writeToken)
    const reread = await dependencies.client.readPeoplePage(anilistId, kind, page)
    if (reread.status !== 'fresh') throw new TypeError('Committed anime people page was unavailable.')
    return { status: 'ready', page: reread.entry.payload }
  } catch (error) {
    await releasePreservingError(dependencies, key, leaseId)
    return peopleErrorState(error)
  }
}

/** Reads or refreshes one independent people page without stale fallback. */
export const getAnimePeoplePageServer = async (anilistId: number, kind: AnimePeopleKind, page: number, dependencies: AnimeDetailCacheDependencies): Promise<AnimePeoplePageState> => {
  const id = parseAnilistId(anilistId)
  const validPage = parseAnimePage(page)
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
    readDetail: async (anilistId) => await convex.query(api.animeDetailCache.readDetail, { anilistId }) as CacheRead<AnimeDetail>,
    readPeoplePage: async (anilistId, kind, page) => await convex.query(api.animeDetailCache.readPeoplePage, { anilistId, kind, page }) as CacheRead<PeoplePage>,
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
  }
}
