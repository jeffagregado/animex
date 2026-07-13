import { POST_IMAGE_LIMIT, POST_IMAGE_MAX_BYTES, POST_TEXT_LIMIT, REQUEST_ID_MAX_LENGTH, type ReviewSort, type Visibility } from '../src/features/social/shared/social-contracts'

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export type AggregateRating = { public: boolean; rating: number }
export type AggregateDelta = {
  count: number
  ratingSum: number
  bandDeltas: [number, number, number, number, number, number, number, number, number, number]
}

type ReviewCursorPayload = {
  viewerId: string | null
  anilistId: number
  sort: ReviewSort
  publicAnchor: string | null
  ownPending: boolean
}

const cursorChecksum = (value: string): string => {
  let hash = 5381
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) + hash) ^ value.charCodeAt(index)
  return (hash >>> 0).toString(36)
}

/** Encodes viewer-bound Anime Review pagination state. */
export const encodeReviewCursor = (payload: ReviewCursorPayload): string => {
  const json = JSON.stringify(payload)
  return btoa(`${cursorChecksum(json)}:${json}`)
}

/** Validates and decodes Anime Review pagination state. */
export const decodeReviewCursor = (
  cursor: string | null,
  viewerId: string | null,
  anilistId: number,
  sort: ReviewSort,
): Pick<ReviewCursorPayload, 'publicAnchor' | 'ownPending'> => {
  if (cursor === null) return { publicAnchor: null, ownPending: true }
  try {
    const decoded = atob(cursor)
    const separator = decoded.indexOf(':')
    const checksum = decoded.slice(0, separator)
    const json = decoded.slice(separator + 1)
    if (separator < 1 || checksum !== cursorChecksum(json)) throw new TypeError('Invalid Review cursor checksum.')
    const payload = JSON.parse(json) as ReviewCursorPayload
    if (payload.viewerId !== viewerId) throw new TypeError('Review cursor belongs to another viewer.')
    if (payload.anilistId !== anilistId) throw new TypeError('Review cursor belongs to another anime.')
    if (payload.sort !== sort) throw new TypeError('Review cursor belongs to another sort.')
    if ((payload.publicAnchor !== null && typeof payload.publicAnchor !== 'string') || typeof payload.ownPending !== 'boolean') throw new TypeError('Invalid Review cursor state.')
    return { publicAnchor: payload.publicAnchor, ownPending: payload.ownPending }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('belongs')) throw error
    throw new TypeError(`Invalid Review cursor: ${error instanceof Error ? error.message : 'unknown error'}`)
  }
}

type ReviewPageItem<T> = { key: string; value: T }

/** Merges one optional private Review into sorted public candidates. */
export const mergeReviewPage = <T>(
  publicItems: readonly ReviewPageItem<T>[],
  ownItem: ReviewPageItem<T> | null,
  limit: number,
  ownPending: boolean,
): { items: T[]; publicConsumed: number; ownPending: boolean } => {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('Review page limit must be a positive integer.')
  const candidates: Array<ReviewPageItem<T> & { publicIndex: number | null }> = publicItems.map((item, index) => ({ ...item, publicIndex: index }))
  const ownCandidate = ownPending && ownItem ? { ...ownItem, publicIndex: null } : null
  if (ownCandidate) candidates.push(ownCandidate)
  candidates.sort((left, right) => left.key.localeCompare(right.key))
  const page = candidates.slice(0, limit)
  const publicConsumed = page.reduce((count, item) => count + (item.publicIndex === null ? 0 : 1), 0)
  const ownConsumed = page.some((item) => item.publicIndex === null)
  return { items: page.map((item) => item.value), publicConsumed, ownPending: ownPending && Boolean(ownItem) && !ownConsumed }
}

/** Enforces Phase 5 visibility while follow edges remain read-only. */
export const canReadSocialRecord = (
  visibility: Visibility,
  viewerId: string | null,
  ownerId: string,
): boolean => visibility === 'public' || viewerId === ownerId

/** Trims and validates Post content using locked shared limits. */
export const normalizePostContent = (text: string, imageIds: string[]) => {
  const normalizedText = text.trim()
  if (normalizedText.length > POST_TEXT_LIMIT) throw new RangeError(`Post text must not exceed ${POST_TEXT_LIMIT} characters.`)
  if (imageIds.length > POST_IMAGE_LIMIT) throw new RangeError(`Post must not exceed ${POST_IMAGE_LIMIT} images.`)
  if (new Set(imageIds).size !== imageIds.length) throw new TypeError('Post image IDs must be unique.')
  if (normalizedText.length === 0 && imageIds.length === 0) throw new RangeError('Post requires text or at least one image.')
  return { text: normalizedText, imageIds }
}

/** Rejects unsupported or oversized registered uploads. */
export const assertImageMetadata = (mimeType: string, size: number): void => {
  if (!IMAGE_MIME_TYPES.has(mimeType)) throw new TypeError('Image must be JPEG, PNG, WebP, or GIF.')
  if (!Number.isSafeInteger(size) || size < 1 || size > POST_IMAGE_MAX_BYTES) throw new RangeError('Image must be 5 MiB or smaller.')
}

/** Validates authoritative Convex storage metadata against client preview metadata. */
export const assertStoredImageMetadata = (
  contentType: string | null,
  size: number,
  expectedMimeType: string,
  expectedSize: number,
): { mimeType: string; size: number } => {
  if (contentType === null) throw new TypeError('Stored image content type is required.')
  assertImageMetadata(contentType, size)
  if (contentType !== expectedMimeType || size !== expectedSize) throw new TypeError('Stored image metadata does not match upload metadata.')
  return { mimeType: contentType, size }
}

/** Normalizes bounded shared request and claim IDs. */
export const assertRequestId = (value: string): string => {
  const normalized = value.trim()
  if (normalized.length === 0) throw new TypeError('Request ID must be non-empty.')
  if (normalized.length > REQUEST_ID_MAX_LENGTH) throw new RangeError(`Request ID must not exceed ${REQUEST_ID_MAX_LENGTH} characters.`)
  return normalized
}

const bandIndex = (rating: number): number => rating >= 90 ? 0 : 9 - Math.floor(rating / 10)

/** Calculates one atomic public Review aggregate transition. */
export const transitionReviewAggregate = (
  previous: AggregateRating | null,
  next: AggregateRating | null,
): AggregateDelta => {
  const bandDeltas: AggregateDelta['bandDeltas'] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  let count = 0
  let ratingSum = 0
  if (previous?.public) {
    count -= 1
    ratingSum -= previous.rating
    bandDeltas[bandIndex(previous.rating)] -= 1
  }
  if (next?.public) {
    count += 1
    ratingSum += next.rating
    bandDeltas[bandIndex(next.rating)] += 1
  }
  return { count, ratingSum, bandDeltas }
}
