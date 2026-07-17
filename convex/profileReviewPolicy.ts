import type { Doc } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import type { ProfileAccessResolution } from './profiles'
import {
  mergeOrderedReviewLanes,
  type ReviewDiscoveryLane,
} from './reviewDiscoveryPolicy'
import { canReadSocialRecord } from './socialPolicy'

const PROFILE_REVIEW_PAGE_SIZE = 20
const lanes = ['followers', 'private', 'public'] as const

type ProfileReviewLaneState = {
  anchor: string | null
  done: boolean
}
type ProfileReviewCursor = {
  lane: 'reviews'
  usernameKey: string
  viewerId: string
  lanes: Record<ReviewDiscoveryLane, ProfileReviewLaneState>
}

const createLaneState = (
  owner: boolean,
): Record<ReviewDiscoveryLane, ProfileReviewLaneState> => ({
  followers: { anchor: null, done: !owner },
  private: { anchor: null, done: !owner },
  public: { anchor: null, done: false },
})

const encodeCursor = (cursor: ProfileReviewCursor): string => btoa(JSON.stringify(cursor))

const invalidCursor = (message: string): never => {
  throw new TypeError(`Invalid Profile Review cursor: ${message}`)
}

/** Decodes one Profile Review cursor envelope. */
const parseCursor = (cursor: string): Partial<ProfileReviewCursor> => {
  let value: unknown
  try {
    value = JSON.parse(atob(cursor)) as unknown
  } catch (error) {
    return invalidCursor(error instanceof Error ? error.message : 'unknown error')
  }
  if (!value || typeof value !== 'object') return invalidCursor('Cursor state is invalid.')
  return value as Partial<ProfileReviewCursor>
}

/** Confirms cursor remains bound to current lane, profile, and viewer. */
const assertCursorScope = (
  value: Partial<ProfileReviewCursor>,
  access: ProfileAccessResolution,
): void => {
  if (value.lane !== 'reviews') throw new TypeError('Profile Review cursor belongs to another lane.')
  if (value.usernameKey !== access.usernameKey) throw new TypeError('Profile Review cursor belongs to another profile.')
  if (value.viewerId !== access.viewerId) throw new TypeError('Profile Review cursor belongs to another viewer.')
}

/** Confirms one cursor lane has valid state and access. */
const assertLaneState = (
  state: ProfileReviewLaneState | undefined,
  inaccessible: boolean,
): void => {
  if (!state || (state.anchor !== null && typeof state.anchor !== 'string') || typeof state.done !== 'boolean') {
    return invalidCursor('Profile Review cursor lanes are invalid.')
  }
  if (inaccessible && !state.done) return invalidCursor('Profile Review cursor exposes an inaccessible lane.')
}

const decodeCursor = (
  cursor: string | null,
  access: ProfileAccessResolution,
): Record<ReviewDiscoveryLane, ProfileReviewLaneState> => {
  if (cursor === null) return createLaneState(access.owner)
  const value = parseCursor(cursor)
  assertCursorScope(value, access)
  if (!value.lanes || typeof value.lanes !== 'object') return invalidCursor('Profile Review cursor lanes are invalid.')
  const expected = createLaneState(access.owner)
  for (const lane of lanes) assertLaneState(value.lanes[lane], expected[lane].done)
  return value.lanes
}

const readLane = async (
  ctx: QueryCtx,
  access: ProfileAccessResolution,
  lane: ReviewDiscoveryLane,
  anchor: string | null,
) => {
  const reviews = await ctx.db.query('reviews').withIndex('by_discovery_owner_newest', (q) => {
    const base = q.eq('userId', access.targetId).eq('state', 'published').eq('visibility', lane)
    return anchor === null ? base : base.gt('newestOrderKey', anchor)
  }).take(PROFILE_REVIEW_PAGE_SIZE + 1)
  return reviews.filter((review) => canReadSocialRecord(
    review.visibility,
    access.viewerId,
    review.userId,
  ))
}

/** Reads and merges one scope-bound Profile Review page. */
export const readProfileReviewPage = async (
  ctx: QueryCtx,
  access: ProfileAccessResolution,
  cursor: string | null,
): Promise<{
  reviews: Doc<'reviews'>[]
  cursor: string | null
  hasMore: boolean
}> => {
  const state = decodeCursor(cursor, access)
  const active = lanes.filter((lane) => !state[lane].done)
  const rows: Record<ReviewDiscoveryLane, Doc<'reviews'>[]> = {
    followers: [],
    private: [],
    public: [],
  }
  await Promise.all(active.map(async (lane) => {
    rows[lane] = await readLane(ctx, access, lane, state[lane].anchor)
  }))
  const merged = mergeOrderedReviewLanes({
    followers: rows.followers.map((review) => ({
      id: review._id,
      key: review.newestOrderKey,
      review,
    })),
    private: rows.private.map((review) => ({
      id: review._id,
      key: review.newestOrderKey,
      review,
    })),
    public: rows.public.map((review) => ({
      id: review._id,
      key: review.newestOrderKey,
      review,
    })),
  }, PROFILE_REVIEW_PAGE_SIZE)
  for (const lane of active) {
    const consumed = merged.consumed[lane]
    if (consumed > 0) {
      state[lane].anchor = rows[lane][consumed - 1]?.newestOrderKey ?? state[lane].anchor
    }
    state[lane].done = rows[lane].length <= consumed
  }
  const hasMore = lanes.some((lane) => !state[lane].done)
  return {
    reviews: merged.items.map((item) => item.review),
    cursor: hasMore
      ? encodeCursor({
          lane: 'reviews',
          usernameKey: access.usernameKey,
          viewerId: access.viewerId,
          lanes: state,
        })
      : null,
    hasMore,
  }
}
