import { ConvexHttpClient } from 'convex/browser'

import { api } from '../../../../convex/_generated/api'
import {
  type AnimeSummary,
  type DiscoverPageData,
  type DiscoverSection,
  type DiscoverSectionKey,
  type DiscoverSectionState,
} from '../shared/discover-contracts'
import {
  AniListRequestError,
  createAniListDependencies,
  fetchDiscoverSectionFromAniList,
} from './anilist.server'

const DISCOVER_KEYS: DiscoverSectionKey[] = ['trending', 'seasonal', 'recommendations', 'upcoming']
const CONTENTION_READS = 6
const CONTENTION_DELAY_MS = 500

type CacheRead =
  | { key: DiscoverSectionKey; status: 'fresh'; section: DiscoverSection }
  | { key: DiscoverSectionKey; status: 'missing' | 'expired'; section: null }

export interface DiscoverCacheClient {
  readSections: (keys: DiscoverSectionKey[]) => Promise<CacheRead[]>
  acquireSectionLease: (key: DiscoverSectionKey, leaseId: string, token: string) => Promise<{ acquired: boolean; leaseUntil: number | null }>
  commitSection: (key: DiscoverSectionKey, leaseId: string, summaries: AnimeSummary[], token: string) => Promise<void>
  releaseSectionLease: (key: DiscoverSectionKey, leaseId: string, token: string) => Promise<boolean>
}

export interface DiscoverCacheDependencies {
  createClient: (url: string) => DiscoverCacheClient
  convexUrl: string
  writeToken: string
  createLeaseId: () => string
  delay: (milliseconds: number) => Promise<void>
  fetchSection: (key: DiscoverSectionKey) => Promise<AnimeSummary[]>
}

/** Requires a non-empty server environment value. */
const requireServerEnv = (name: 'VITE_CONVEX_URL' | 'DISCOVER_CACHE_WRITE_TOKEN'): string => {
  const value = process.env[name]
  if (!value) throw new TypeError(`${name} must be configured on the server.`)
  return value
}

/** Creates a short-lived gateway backed by the public Convex API. */
const createConvexCacheClient = (url: string): DiscoverCacheClient => {
  const client = new ConvexHttpClient(url)
  return {
    readSections: async (keys) => await client.query(api.animeCache.readSections, { keys }) as CacheRead[],
    acquireSectionLease: async (key, leaseId, token) => await client.mutation(api.animeCache.acquireSectionLease, { key, leaseId, token }),
    commitSection: async (key, leaseId, summaries, token) => {
      await client.mutation(api.animeCache.commitSection, { key, leaseId, summaries, token })
    },
    releaseSectionLease: async (key, leaseId, token) => await client.mutation(api.animeCache.releaseSectionLease, { key, leaseId, token }),
  }
}

/** Supplies production dependencies with explicit server configuration. */
export const createDiscoverCacheDependencies = (): DiscoverCacheDependencies => ({
  createClient: createConvexCacheClient,
  convexUrl: requireServerEnv('VITE_CONVEX_URL'),
  writeToken: requireServerEnv('DISCOVER_CACHE_WRITE_TOKEN'),
  createLeaseId: () => crypto.randomUUID(),
  delay: async (milliseconds) => await new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds)),
  fetchSection: async (key) => await fetchDiscoverSectionFromAniList(key, createAniListDependencies()),
})

const cacheError = (key: DiscoverSectionKey): DiscoverSectionState => ({
  status: 'error', key, code: 'CACHE_REFRESH', retryAfterSeconds: null,
})

const requestError = (key: DiscoverSectionKey, error: unknown): DiscoverSectionState => {
  if (error instanceof AniListRequestError) {
    return { status: 'error', key, code: error.code, retryAfterSeconds: error.retryAfterSeconds }
  }
  return { status: 'error', key, code: 'UPSTREAM', retryAfterSeconds: null }
}

/** Releases an owned lease without masking the primary refresh failure. */
const releaseOwnedLease = async (
  client: DiscoverCacheClient,
  key: DiscoverSectionKey,
  leaseId: string,
  writeToken: string,
): Promise<void> => {
  try {
    await client.releaseSectionLease(key, leaseId, writeToken)
  } catch {
    // Cache cleanup must not replace the explicit upstream or cache failure.
  }
}

const readKey = async (client: DiscoverCacheClient, key: DiscoverSectionKey): Promise<CacheRead> => {
  const results = await client.readSections([key])
  const result = results[0]
  if (!result || result.key !== key) throw new TypeError(`Discover cache did not return section ${key}.`)
  return result
}

const toState = (result: CacheRead): DiscoverSectionState | null => result.status === 'fresh'
  ? { status: 'ready', section: result.section }
  : null

/** Refreshes one expired cache rail under its bounded distributed lease. */
export const refreshDiscoverSectionServer = async (
  key: DiscoverSectionKey,
  dependencies: DiscoverCacheDependencies,
): Promise<DiscoverSectionState> => {
  const client = dependencies.createClient(dependencies.convexUrl)
  let current: CacheRead
  try {
    current = await readKey(client, key)
  } catch {
    return cacheError(key)
  }
  const initialState = toState(current)
  if (initialState) return initialState

  const leaseId = dependencies.createLeaseId()
  let lease
  try {
    lease = await client.acquireSectionLease(key, leaseId, dependencies.writeToken)
  } catch {
    return cacheError(key)
  }
  if (!lease.acquired) {
    for (let attempt = 0; attempt < CONTENTION_READS; attempt += 1) {
      await dependencies.delay(CONTENTION_DELAY_MS)
      try {
        const reread = toState(await readKey(client, key))
        if (reread) return reread
      } catch {
        return cacheError(key)
      }
    }
    return cacheError(key)
  }

  let summaries: AnimeSummary[]
  try {
    summaries = await dependencies.fetchSection(key)
  } catch (error) {
    await releaseOwnedLease(client, key, leaseId, dependencies.writeToken)
    return requestError(key, error)
  }
  try {
    await client.commitSection(key, leaseId, summaries, dependencies.writeToken)
    const reread = toState(await readKey(client, key))
    return reread ?? cacheError(key)
  } catch {
    await releaseOwnedLease(client, key, leaseId, dependencies.writeToken)
    return cacheError(key)
  }
}

/** Reads all rails, refreshing only missing or expired sections in parallel. */
export const getDiscoverPageServer = async (
  dependencies: DiscoverCacheDependencies,
): Promise<DiscoverPageData> => {
  const client = dependencies.createClient(dependencies.convexUrl)
  let reads: CacheRead[]
  try {
    reads = await client.readSections(DISCOVER_KEYS)
  } catch {
    return { sections: Object.fromEntries(DISCOVER_KEYS.map((key) => [key, cacheError(key)])) as DiscoverPageData['sections'] }
  }
  const states = await Promise.all(DISCOVER_KEYS.map(async (key) => {
    const cached = reads.find((read) => read.key === key)
    if (!cached) {
      return [key, cacheError(key)] as const
    }
    const state = toState(cached)
    return [key, state ?? await refreshDiscoverSectionServer(key, dependencies)] as const
  }))
  return { sections: Object.fromEntries(states) as DiscoverPageData['sections'] }
}
