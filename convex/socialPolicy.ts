import { POST_IMAGE_LIMIT, POST_IMAGE_MAX_BYTES, POST_TEXT_LIMIT, REQUEST_ID_MAX_LENGTH, type Visibility } from '../src/features/social/shared/social-contracts'

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export type AggregateRating = { public: boolean; rating: number }
export type AggregateDelta = {
  count: number
  ratingSum: number
  bandDeltas: [number, number, number, number, number, number, number, number, number, number]
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
