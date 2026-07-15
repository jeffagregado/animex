import type {
  ReviewDiscoverySort,
  ReviewDiscoveryVisibility,
  ReviewRatingBand,
  StoredReviewRatingBand,
} from '../src/features/reviews/shared/review-discovery-contracts'

export type ReviewDiscoveryLane = 'followers' | 'private' | 'public'
export type ReviewDiscoveryCursorScope = {
  viewerId: string | null
  query: string | null
  sort: ReviewDiscoverySort
  ratingBand: ReviewRatingBand | null
  visibility: ReviewDiscoveryVisibility
}
export type OrderedLaneState = { anchor: string | null; done: boolean }
export type ReviewDiscoveryCursorState = {
  mode: 'ordered'
  lanes: Record<ReviewDiscoveryLane, OrderedLaneState>
} | {
  mode: 'search'
  phase: ReviewDiscoveryLane
  cursors: Record<ReviewDiscoveryLane, string | null>
  done: Record<ReviewDiscoveryLane, boolean>
}
export type ReviewDiscoveryCursor = { scope: ReviewDiscoveryCursorScope; state: ReviewDiscoveryCursorState }

const CURSOR_VERSION = 1 as const
const DISCOVERY_LANES: ReviewDiscoveryLane[] = ['followers', 'private', 'public']

const checksum = (value: string): string => {
  let hash = 5381
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) + hash) ^ value.charCodeAt(index)
  return (hash >>> 0).toString(36)
}

const encodeBase64Utf8 = (value: string): string => {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const decodeBase64Utf8 = (value: string): string => {
  const binary = atob(value)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

/** Maps nullable Review Rating to its migration-safe storage band. */
export const getStoredReviewRatingBand = (rating: number | null): StoredReviewRatingBand => {
  if (rating === null) return 'none'
  if (!Number.isFinite(rating) || rating < 0 || rating > 100) throw new RangeError('Review Rating must be between 0 and 100.')
  if (rating >= 90) return '90-100'
  const floor = Math.floor(rating / 10) * 10
  return `${floor}-${floor + 9}` as ReviewRatingBand
}

/** Normalizes a bounded Review discovery query. */
export const normalizeReviewDiscoveryQuery = (query: string): string => {
  const normalized = query.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
  if (normalized.length < 2) throw new RangeError('Review search query must contain at least 2 characters.')
  if (normalized.length > 100) throw new RangeError('Review search query must not exceed 100 characters.')
  return normalized
}

/** Builds bounded search text from indexed Review source metadata. */
export const buildReviewSearchText = (animeTitle: string, displayName: string, username: string): string => [animeTitle, displayName, username]
  .map((value) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase())
  .join(' ')

/** Encodes versioned, access-scoped Review discovery state. */
export const encodeReviewDiscoveryCursor = (cursor: ReviewDiscoveryCursor): string => {
  const json = JSON.stringify({ version: CURSOR_VERSION, ...cursor })
  return encodeBase64Utf8(`${checksum(json)}:${json}`)
}

const assertScope = (actual: ReviewDiscoveryCursorScope, expected: ReviewDiscoveryCursorScope): void => {
  if (actual.viewerId !== expected.viewerId) throw new TypeError('Review discovery cursor belongs to another viewer.')
  if (actual.query !== expected.query) throw new TypeError('Review discovery cursor belongs to another query.')
  if (actual.sort !== expected.sort) throw new TypeError('Review discovery cursor belongs to another sort.')
  if (actual.ratingBand !== expected.ratingBand) throw new TypeError('Review discovery cursor belongs to another Rating band.')
  if (actual.visibility !== expected.visibility) throw new TypeError('Review discovery cursor belongs to another visibility.')
}

const isLane = (value: unknown): value is ReviewDiscoveryLane => typeof value === 'string' && DISCOVERY_LANES.includes(value as ReviewDiscoveryLane)
const isCursorValue = (value: unknown): value is string | null => value === null || typeof value === 'string'

/** Validates one ordered discovery lane record. */
const assertOrderedLaneRecord = (laneState: OrderedLaneState | undefined): void => {
  if (!laneState || !isCursorValue(laneState.anchor) || typeof laneState.done !== 'boolean') {
    throw new TypeError('Invalid ordered Review discovery cursor state.')
  }
}

/** Validates one search discovery lane record. */
const assertSearchLaneRecord = (state: Extract<ReviewDiscoveryCursorState, { mode: 'search' }>, lane: ReviewDiscoveryLane): void => {
  if (!isCursorValue(state.cursors?.[lane]) || typeof state.done?.[lane] !== 'boolean') {
    throw new TypeError('Invalid search Review discovery cursor state.')
  }
}

const assertLaneRecords = (state: ReviewDiscoveryCursorState): void => {
  if (state.mode === 'ordered') {
    for (const lane of DISCOVERY_LANES) assertOrderedLaneRecord(state.lanes?.[lane])
    return
  }
  for (const lane of DISCOVERY_LANES) assertSearchLaneRecord(state, lane)
  if (!isLane(state.phase)) throw new TypeError('Invalid Review discovery search phase.')
}

/** Validates and decodes an access-scoped Review discovery cursor. */
export const decodeReviewDiscoveryCursor = (encoded: string, scope: ReviewDiscoveryCursorScope): ReviewDiscoveryCursor => {
  try {
    const decoded = decodeBase64Utf8(encoded)
    const separator = decoded.indexOf(':')
    const providedChecksum = decoded.slice(0, separator)
    const json = decoded.slice(separator + 1)
    if (separator < 1 || providedChecksum !== checksum(json)) throw new TypeError('Invalid Review discovery cursor checksum.')
    const payload = JSON.parse(json) as ReviewDiscoveryCursor & { version?: unknown }
    if (payload.version !== CURSOR_VERSION) throw new TypeError('Unsupported Review discovery cursor version.')
    if (!payload.scope || !payload.state || (payload.state.mode !== 'ordered' && payload.state.mode !== 'search')) throw new TypeError('Invalid Review discovery cursor payload.')
    assertScope(payload.scope, scope)
    assertLaneRecords(payload.state)
    return { scope: payload.scope, state: payload.state }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('belongs')) throw error
    throw new TypeError(`Invalid Review discovery cursor: ${error instanceof Error ? error.message : 'unknown error'}`)
  }
}

type OrderedItem = { key: string; id: string }

/** Merges comparable ordered lanes and consumes duplicates exactly once. */
export const mergeOrderedReviewLanes = <T extends OrderedItem>(
  lanes: Record<ReviewDiscoveryLane, readonly T[]>,
  limit: number,
): { items: T[]; consumed: Record<ReviewDiscoveryLane, number> } => {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('Review discovery page limit must be a positive integer.')
  const candidates = DISCOVERY_LANES.flatMap((lane) => lanes[lane].map((item, index) => ({ item, lane, index })))
    .sort((left, right) => left.item.key.localeCompare(right.item.key) || left.lane.localeCompare(right.lane) || left.index - right.index)
  const consumed: Record<ReviewDiscoveryLane, number> = { followers: 0, private: 0, public: 0 }
  const seen = new Set<string>()
  const items: T[] = []
  for (const candidate of candidates) {
    if (items.length >= limit) break
    consumed[candidate.lane] = Math.max(consumed[candidate.lane], candidate.index + 1)
    if (seen.has(candidate.item.id)) continue
    seen.add(candidate.item.id)
    items.push(candidate.item)
  }
  return { items, consumed }
}
