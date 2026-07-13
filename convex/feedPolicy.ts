export type FeedView = 'home' | 'global'

type FeedCursorPayload = {
  view: FeedView
  viewerId: string | null
  prioritizedAnchor: string | null
  globalAnchor: string | null
  cycleIndex: number
}

const checksum = (value: string): string => {
  let hash = 5381
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) + hash) ^ value.charCodeAt(index)
  return (hash >>> 0).toString(36)
}

/** Builds newest-first lexicographic key with stable tie-break. */
export const makeOrderKey = (occurredAt: number, sourceKey: string): string => {
  if (!Number.isSafeInteger(occurredAt) || occurredAt < 0) throw new RangeError('Feed timestamp must be a nonnegative safe integer.')
  return `${String(Number.MAX_SAFE_INTEGER - occurredAt).padStart(16, '0')}:${sourceKey}`
}

/** Encodes lane anchors into one opaque feed cursor. */
export const encodeFeedCursor = (payload: FeedCursorPayload): string => {
  const json = JSON.stringify(payload)
  return btoa(`${checksum(json)}:${json}`)
}

const parseCursorPayload = (cursor: string): FeedCursorPayload => {
  const decoded = atob(cursor)
  const separator = decoded.indexOf(':')
  const providedChecksum = decoded.slice(0, separator)
  const json = decoded.slice(separator + 1)
  if (separator < 1 || checksum(json) !== providedChecksum) throw new TypeError('Invalid feed cursor checksum.')
  return JSON.parse(json) as FeedCursorPayload
}

const assertCursorAnchors = (payload: FeedCursorPayload): void => {
  const prioritizedValid = payload.prioritizedAnchor === null || typeof payload.prioritizedAnchor === 'string'
  const globalValid = payload.globalAnchor === null || typeof payload.globalAnchor === 'string'
  if (!prioritizedValid || !globalValid) throw new TypeError('Invalid feed cursor anchors.')
  if (!Number.isInteger(payload.cycleIndex) || payload.cycleIndex < 0 || payload.cycleIndex > 2) throw new TypeError('Invalid feed cursor cycle.')
}

/** Validates and unwraps a view/viewer-bound feed cursor. */
export const decodeFeedCursor = (
  cursor: string | null,
  view: FeedView,
  viewerId: string | null,
): Pick<FeedCursorPayload, 'prioritizedAnchor' | 'globalAnchor' | 'cycleIndex'> => {
  if (cursor === null) return { prioritizedAnchor: null, globalAnchor: null, cycleIndex: 0 }
  try {
    const payload = parseCursorPayload(cursor)
    if (payload.view !== view) throw new TypeError('Feed cursor belongs to another view.')
    if (payload.viewerId !== viewerId) throw new TypeError('Feed cursor belongs to another viewer.')
    assertCursorAnchors(payload)
    return { prioritizedAnchor: payload.prioritizedAnchor, globalAnchor: payload.globalAnchor, cycleIndex: payload.cycleIndex }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('view')) throw error
    if (error instanceof TypeError && error.message.includes('viewer')) throw error
    throw new TypeError(`Invalid feed cursor: ${error instanceof Error ? error.message : 'unknown error'}`)
  }
}
