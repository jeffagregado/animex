export const DISCOVER_CACHE_SECTION_CONFIG = {
  trending: { ttlMs: 3 * 60 * 60 * 1000, itemLimit: 12 },
  seasonal: { ttlMs: 24 * 60 * 60 * 1000, itemLimit: 12 },
  recommendations: { ttlMs: 24 * 60 * 60 * 1000, itemLimit: 16 },
  upcoming: { ttlMs: 6 * 60 * 60 * 1000, itemLimit: 10 },
} as const

export const SECTION_LEASE_DURATION_MS = 30_000

export type DiscoverCacheSectionKey = keyof typeof DISCOVER_CACHE_SECTION_CONFIG

export type SectionLease = {
  leaseId: string
  leaseUntil: number
}

type SummaryIdentity = {
  anilistId: number
}

export type CachedDiscoverSection = {
  animeIds: number[]
  refreshedAt: number
  expiresAt: number
}

export type DiscoverSectionRead<T extends SummaryIdentity> =
  | {
    key: DiscoverCacheSectionKey
    status: 'fresh'
    section: {
      key: DiscoverCacheSectionKey
      items: T[]
      refreshedAt: number
      expiresAt: number
    }
  }
  | {
    key: DiscoverCacheSectionKey
    status: 'missing' | 'expired'
    section: null
  }

export type DiscoverCachePolicyErrorCode =
  | 'DUPLICATE_ANILIST_ID'
  | 'CACHE_WRITE_TOKEN_MISSING'
  | 'CACHE_WRITE_UNAUTHORIZED'
  | 'EMPTY_SECTION'
  | 'INVALID_LEASE_WINDOW'
  | 'INVALID_SECTION_WINDOW'
  | 'LEASE_NOT_ACTIVE'
  | 'LEASE_NOT_OWNED'
  | 'SECTION_LIMIT_EXCEEDED'
  | 'SUMMARY_MISSING'

/** Signals a cache request that violates its explicit cache contract. */
export class DiscoverCachePolicyError extends Error {
  readonly code: DiscoverCachePolicyErrorCode

  constructor(code: DiscoverCachePolicyErrorCode, message: string) {
    super(message)
    this.name = 'DiscoverCachePolicyError'
    this.code = code
  }
}

/** Derives cache refresh timestamps from trusted server time. */
export const createSectionTiming = (
  key: DiscoverCacheSectionKey,
  now: number,
): { refreshedAt: number; expiresAt: number } => ({
  refreshedAt: now,
  expiresAt: now + DISCOVER_CACHE_SECTION_CONFIG[key].ttlMs,
})

/** Identifies sections that may return cached content. */
export const isSectionFresh = (
  section: CachedDiscoverSection | null,
  now: number,
): section is CachedDiscoverSection => section !== null && section.expiresAt > now

/** Validates a write token without exposing token values. */
export const validateCacheWriteToken = (
  token: string,
  configuredToken: string | undefined,
): void => {
  if (!configuredToken) {
    throw new DiscoverCachePolicyError(
      'CACHE_WRITE_TOKEN_MISSING',
      'Discover cache write token is not configured.',
    )
  }
  if (token !== configuredToken) {
    throw new DiscoverCachePolicyError(
      'CACHE_WRITE_UNAUTHORIZED',
      'Discover cache write token is invalid.',
    )
  }
}

/** Selects whether a worker may create or renew a cache lease. */
export const decideSectionLease = (
  current: SectionLease | null,
  leaseId: string,
  now: number,
  leaseUntil: number,
): { acquired: boolean; leaseUntil: number | null } => {
  if (leaseUntil <= now) {
    throw new DiscoverCachePolicyError(
      'INVALID_LEASE_WINDOW',
      'Discover cache lease must end after its current time.',
    )
  }
  if (current && current.leaseUntil > now && current.leaseId !== leaseId) {
    return { acquired: false, leaseUntil: current.leaseUntil }
  }
  return { acquired: true, leaseUntil }
}

/** Rejects writes without a current matching cache lease. */
export const assertActiveSectionLease: (
  current: SectionLease | null,
  leaseId: string,
  now: number,
) => asserts current is SectionLease = (
  current: SectionLease | null,
  leaseId: string,
  now: number,
): void => {
  if (!current || current.leaseUntil <= now) {
    throw new DiscoverCachePolicyError(
      'LEASE_NOT_ACTIVE',
      'Discover cache lease is missing or expired.',
    )
  }
  if (current.leaseId !== leaseId) {
    throw new DiscoverCachePolicyError(
      'LEASE_NOT_OWNED',
      'Discover cache lease belongs to another worker.',
    )
  }
}

/** Selects whether a worker may remove a cache lease. */
export const decideSectionLeaseRelease = (
  current: SectionLease | null,
  leaseId: string,
  now: number,
): boolean => {
  if (!current) return false
  if (current.leaseUntil <= now) return false
  if (current.leaseId === leaseId) return true
  throw new DiscoverCachePolicyError(
    'LEASE_NOT_OWNED',
    'Discover cache lease belongs to another active worker.',
  )
}

/** Reads a section without returning expired or incomplete cache data. */
export const resolveSectionRead = <T extends SummaryIdentity>(
  key: DiscoverCacheSectionKey,
  section: CachedDiscoverSection | null,
  summaries: T[],
  now: number,
): DiscoverSectionRead<T> => {
  if (!section) return { key, status: 'missing', section: null }
  if (section.expiresAt <= now) return { key, status: 'expired', section: null }

  const summariesById = new Map(summaries.map((summary) => [summary.anilistId, summary]))
  const items = section.animeIds.map((anilistId) => {
    const summary = summariesById.get(anilistId)
    if (!summary) {
      throw new DiscoverCachePolicyError(
        'SUMMARY_MISSING',
        `Discover cache section ${key} references missing AniList summary ${anilistId}.`,
      )
    }
    return summary
  })

  return {
    key,
    status: 'fresh',
    section: {
      key,
      items,
      refreshedAt: section.refreshedAt,
      expiresAt: section.expiresAt,
    },
  }
}

/** Validates an atomic section replacement before persistence. */
export const validateSectionCommit = (
  key: DiscoverCacheSectionKey,
  summaries: SummaryIdentity[],
  refreshedAt: number,
  expiresAt: number,
): void => {
  if (expiresAt <= refreshedAt) {
    throw new DiscoverCachePolicyError(
      'INVALID_SECTION_WINDOW',
      'Discover cache section expiry must be after refresh time.',
    )
  }
  if (summaries.length === 0) {
    throw new DiscoverCachePolicyError(
      'EMPTY_SECTION',
      'Discover cache section must include at least one anime summary.',
    )
  }
  if (summaries.length > DISCOVER_CACHE_SECTION_CONFIG[key].itemLimit) {
    throw new DiscoverCachePolicyError(
      'SECTION_LIMIT_EXCEEDED',
      `Discover cache section ${key} exceeds its ${DISCOVER_CACHE_SECTION_CONFIG[key].itemLimit} item limit.`,
    )
  }
  const ids = new Set(summaries.map((summary) => summary.anilistId))
  if (ids.size !== summaries.length) {
    throw new DiscoverCachePolicyError(
      'DUPLICATE_ANILIST_ID',
      'Discover cache section cannot include duplicate AniList IDs.',
    )
  }
}
