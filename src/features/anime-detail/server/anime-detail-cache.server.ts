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

const errorState = (error: unknown): PublicAnimeDetailState => error instanceof AniListRequestError
  ? { status: 'error', code: error.code, message: error.message, retryAfterSeconds: error.retryAfterSeconds }
  : { status: 'error', code: 'UPSTREAM', message: 'Anime detail is temporarily unavailable.', retryAfterSeconds: null }

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

/** Reads or refreshes one public detail without serving expired data. */
export const getAnimeDetailServer = async (anilistId: number, dependencies: AnimeDetailCacheDependencies): Promise<PublicAnimeDetailState> => {
  const id = parseAnilistId(anilistId)
  let cached: PublicAnimeDetailState | null
  try { cached = ready(await dependencies.client.readDetail(id)) } catch (error) { return errorState(error) }
  if (cached) return cached
  const key = `detail:${id}`
  const leaseId = dependencies.createLeaseId()
  let lease: { acquired: boolean; leaseUntil: number | null }
  try { lease = await dependencies.client.acquireLease(key, leaseId, dependencies.writeToken) } catch (error) { return errorState(error) }
  if (!lease.acquired) {
    for (let attempt = 0; attempt < CONTENTION_READS; attempt += 1) {
      await dependencies.delay(CONTENTION_DELAY_MS)
      let reread: PublicAnimeDetailState | null
      try { reread = ready(await dependencies.client.readDetail(id)) } catch (error) { return errorState(error) }
      if (reread) return reread
    }
    return errorState(new Error('Detail refresh lease contention.'))
  }
  try {
    const fetched = await dependencies.fetchDetail(id)
    if (fetched === null) {
      try {
        await releaseLease(dependencies, key, leaseId)
      } catch (error) {
        return errorState(error)
      }
      return { status: 'not-found', code: 'NOT_FOUND', message: 'Anime was not found.' }
    }
    await dependencies.client.commitDetail(leaseId, fetched.summary, fetched.detail, dependencies.writeToken)
    const reread = ready(await dependencies.client.readDetail(id))
    return reread ?? errorState(new Error('Committed detail was unavailable.'))
  } catch (error) {
    await releasePreservingError(dependencies, key, leaseId)
    return errorState(error)
  }
}

export type AnimePeoplePageState = { status: 'ready'; page: PeoplePage } | { status: 'not-found' } | { status: 'error'; code: 'UPSTREAM' | 'RATE_LIMITED'; message: string; retryAfterSeconds: number | null }

/** Reads or refreshes one independent people page without stale fallback. */
export const getAnimePeoplePageServer = async (anilistId: number, kind: AnimePeopleKind, page: number, dependencies: AnimeDetailCacheDependencies): Promise<AnimePeoplePageState> => {
  const id = parseAnilistId(anilistId)
  const validPage = parseAnimePage(page)
  let cached: CacheRead<PeoplePage>
  try { cached = await dependencies.client.readPeoplePage(id, kind, validPage) } catch (error) {
    const state = errorState(error)
    return state.status === 'error' ? state : { status: 'error', code: 'UPSTREAM', message: 'Anime people page is temporarily unavailable.', retryAfterSeconds: null }
  }
  if (cached.status === 'fresh') return { status: 'ready', page: cached.entry.payload }
  const key = `people:${id}:${kind}:${validPage}`
  const leaseId = dependencies.createLeaseId()
  let lease: { acquired: boolean; leaseUntil: number | null }
  try { lease = await dependencies.client.acquireLease(key, leaseId, dependencies.writeToken) } catch (error) {
    const state = errorState(error)
    return state.status === 'error' ? state : { status: 'error', code: 'UPSTREAM', message: 'Anime people page is temporarily unavailable.', retryAfterSeconds: null }
  }
  if (!lease.acquired) {
    for (let attempt = 0; attempt < CONTENTION_READS; attempt += 1) {
      await dependencies.delay(CONTENTION_DELAY_MS)
      let reread: CacheRead<PeoplePage>
      try { reread = await dependencies.client.readPeoplePage(id, kind, validPage) } catch (error) {
        const state = errorState(error)
        return state.status === 'error' ? state : { status: 'error', code: 'UPSTREAM', message: 'Anime people page is temporarily unavailable.', retryAfterSeconds: null }
      }
      if (reread.status === 'fresh') return { status: 'ready', page: reread.entry.payload }
    }
    return { status: 'error', code: 'UPSTREAM', message: 'Anime people page is temporarily unavailable.', retryAfterSeconds: null }
  }
  try {
    const fetched = await dependencies.fetchPeople(id, kind, validPage)
    if (fetched === null) {
      try {
        await releaseLease(dependencies, key, leaseId)
      } catch (error) {
        const state = errorState(error)
        return state.status === 'error' ? state : { status: 'error', code: 'UPSTREAM', message: 'Anime people page is temporarily unavailable.', retryAfterSeconds: null }
      }
      return { status: 'not-found' }
    }
    await dependencies.client.commitPeoplePage(id, kind, validPage, fetched, leaseId, dependencies.writeToken)
    const reread = await dependencies.client.readPeoplePage(id, kind, validPage)
    if (reread.status !== 'fresh') throw new TypeError('Committed anime people page was unavailable.')
    return { status: 'ready', page: reread.entry.payload }
  } catch (error) {
    await releasePreservingError(dependencies, key, leaseId)
    const state = errorState(error)
    return state.status === 'error' ? state : { status: 'error', code: 'UPSTREAM', message: 'Anime people page is temporarily unavailable.', retryAfterSeconds: null }
  }
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
