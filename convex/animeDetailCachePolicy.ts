export const ANIME_DETAIL_CACHE_TTL_MS = 24 * 60 * 60 * 1000
export const ANIME_DETAIL_LEASE_MS = 30_000
export const ANIME_PEOPLE_LIMIT = 24

type Lease = { leaseId: string; leaseUntil: number }
type TimedPayload<T> = { payload: T; refreshedAt: number; expiresAt: number }

export class AnimeDetailCachePolicyError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'AnimeDetailCachePolicyError'
  }
}

export const createDetailTiming = (now: number) => ({
  refreshedAt: now,
  expiresAt: now + ANIME_DETAIL_CACHE_TTL_MS,
})

/** Returns fresh cache data and never exposes expired data. */
export const resolveDetailRead = <T>(entry: TimedPayload<T> | null, now: number) => {
  if (!entry) return { status: 'missing' as const, entry: null }
  if (entry.expiresAt <= now) return { status: 'expired' as const, entry: null }
  return { status: 'fresh' as const, entry }
}

/** Selects one refresh lease owner. */
export const decideDetailLease = (
  current: Lease | null,
  leaseId: string,
  now: number,
  leaseUntil: number,
) => {
  if (!leaseId.trim()) throw new AnimeDetailCachePolicyError('INVALID_LEASE_ID', 'Lease ID is required.')
  if (leaseUntil <= now) throw new AnimeDetailCachePolicyError('INVALID_LEASE_WINDOW', 'Lease window must end in the future.')
  if (current && current.leaseUntil > now && current.leaseId !== leaseId) {
    return { acquired: false, leaseUntil: current.leaseUntil }
  }
  return { acquired: true, leaseUntil }
}

/** Requires an active lease held by the caller. */
export const assertDetailLease: (current: Lease | null, leaseId: string, now: number) => asserts current is Lease = (
  current,
  leaseId,
  now,
) => {
  if (!current || current.leaseUntil <= now) throw new AnimeDetailCachePolicyError('LEASE_NOT_ACTIVE', 'Anime detail cache lease is missing or expired.')
  if (current.leaseId !== leaseId) throw new AnimeDetailCachePolicyError('LEASE_NOT_OWNED', 'Anime detail cache lease belongs to another worker.')
}

/** Allows only the active owner to release a lease. */
export const decideDetailLeaseRelease = (current: Lease | null, leaseId: string, now: number): boolean => {
  if (!current || current.leaseUntil <= now) return false
  if (current.leaseId === leaseId) return true
  throw new AnimeDetailCachePolicyError('LEASE_NOT_OWNED', 'Anime detail cache lease belongs to another worker.')
}

/** Validates bounded people-page identity and size. */
export const validatePeoplePage = (
  anilistId: number,
  kind: 'characters' | 'staff',
  page: number,
  items: unknown[],
): void => {
  if (!Number.isSafeInteger(anilistId) || anilistId <= 0) throw new AnimeDetailCachePolicyError('INVALID_ANILIST_ID', 'AniList ID must be a positive safe integer.')
  if (!Number.isSafeInteger(page) || page <= 0) throw new AnimeDetailCachePolicyError('INVALID_PAGE', 'Page must be a positive safe integer.')
  if (items.length > ANIME_PEOPLE_LIMIT) throw new AnimeDetailCachePolicyError('PEOPLE_PAGE_LIMIT_EXCEEDED', 'Anime people page cannot exceed 24 items.')
  const characterItemCount = items.filter((item) => typeof item === 'object' && item !== null && 'japaneseVoiceActor' in item).length
  if ((kind === 'characters' && characterItemCount !== items.length) || (kind === 'staff' && characterItemCount > 0)) {
    throw new AnimeDetailCachePolicyError('INVALID_PEOPLE_KIND', `Anime people page items do not match ${kind} kind.`)
  }
}
