import {
  catalogPersonProviderDetailSchema,
  type CatalogPersonProviderKind,
} from '../src/features/catalog-person/server/catalog-person-provider-cache-contracts.server'

export const CATALOG_PERSON_CACHE_TTL_MS = 24 * 60 * 60 * 1000
export const CATALOG_PERSON_LEASE_MS = 60_000
export const CATALOG_PERSON_WORK_LIMIT = 20

type Lease = { leaseId: string; leaseUntil: number }
type TimedPayload<T> = { payload: T; refreshedAt: number; expiresAt: number }

export class CatalogPersonCachePolicyError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'CatalogPersonCachePolicyError'
  }
}

const positive = (value: number, name: string): void => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new CatalogPersonCachePolicyError(`INVALID_${name.toUpperCase()}`, `${name} must be a positive safe integer.`)
  }
}

/** Builds a validated detail cache key. */
export const personDetailKey = (kind: CatalogPersonProviderKind, personId: number): string => {
  positive(personId, 'person_id')
  return `person:${kind}:${personId}`
}

/** Builds a validated work-page cache key. */
export const personWorkKey = (kind: CatalogPersonProviderKind, personId: number, page: number): string => {
  positive(personId, 'person_id')
  positive(page, 'page')
  return `person-work:${kind}:${personId}:${page}`
}

export const createCatalogPersonTiming = (now: number) => ({
  refreshedAt: now,
  expiresAt: now + CATALOG_PERSON_CACHE_TTL_MS,
})

/** Returns fresh data only. */
export const resolveCatalogPersonRead = <T>(entry: TimedPayload<T> | null, now: number) => {
  if (!entry) return { status: 'missing' as const, entry: null }
  if (entry.expiresAt <= now) return { status: 'expired' as const, entry: null }
  return { status: 'fresh' as const, entry }
}

/** Selects one active refresh owner. */
export const decideCatalogPersonLease = (
  current: Lease | null,
  leaseId: string,
  now: number,
  leaseUntil: number,
) => {
  if (!leaseId.trim()) throw new CatalogPersonCachePolicyError('INVALID_LEASE_ID', 'Lease ID is required.')
  if (leaseUntil <= now) throw new CatalogPersonCachePolicyError('INVALID_LEASE_WINDOW', 'Lease window must end in the future.')
  if (current && current.leaseUntil > now && current.leaseId !== leaseId) {
    return { acquired: false, leaseUntil: current.leaseUntil }
  }
  return { acquired: true, leaseUntil }
}

/** Requires caller-owned active lease. */
export const assertCatalogPersonLease: (
  current: Lease | null,
  leaseId: string,
  now: number,
) => asserts current is Lease = (current, leaseId, now) => {
  if (!current || current.leaseUntil <= now) {
    throw new CatalogPersonCachePolicyError('LEASE_NOT_ACTIVE', 'Catalog person cache lease is missing or expired.')
  }
  if (current.leaseId !== leaseId) {
    throw new CatalogPersonCachePolicyError('LEASE_NOT_OWNED', 'Catalog person cache lease belongs to another worker.')
  }
}

/** Allows release only by active owner. */
export const decideCatalogPersonLeaseRelease = (current: Lease | null, leaseId: string, now: number): boolean => {
  if (!current || current.leaseUntil <= now) return false
  if (current.leaseId === leaseId) return true
  throw new CatalogPersonCachePolicyError('LEASE_NOT_OWNED', 'Catalog person cache lease belongs to another worker.')
}

/** Validates provider-neutral detail identity. */
export const validateCatalogPersonDetail = (kind: CatalogPersonProviderKind, personId: number, detail: unknown): void => {
  positive(personId, 'person_id')
  const result = catalogPersonProviderDetailSchema.safeParse(detail)
  if (!result.success || result.data.kind !== kind || result.data.id !== personId) {
    throw new CatalogPersonCachePolicyError('INVALID_DETAIL', 'Catalog person detail identity or payload is invalid.')
  }
}

/** Validates bounded work references without changing order. */
export const validateCatalogPersonWorkPage = (
  kind: CatalogPersonProviderKind,
  personId: number,
  page: number,
  items: Array<{ animeId: number; role: string | null }>,
): void => {
  personWorkKey(kind, personId, page)
  if (items.length > CATALOG_PERSON_WORK_LIMIT) {
    throw new CatalogPersonCachePolicyError('WORK_PAGE_LIMIT_EXCEEDED', 'Catalog person work page cannot exceed 20 items.')
  }
  for (const item of items) {
    positive(item.animeId, 'anime_id')
    if (item.role !== null && !item.role.trim()) {
      throw new CatalogPersonCachePolicyError('INVALID_ROLE', 'Catalog person work role must be non-empty or null.')
    }
  }
}
