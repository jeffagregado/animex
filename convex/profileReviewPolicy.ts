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

const decodeCursor = (
  cursor: string | null,
  access: ProfileAccessResolution,
): Record<ReviewDiscoveryLane, ProfileReviewLaneState> => {
  if (cursor === null) return createLaneState(access.owner)
  try {
    const value = JSON.parse(atob(cursor)) as Partial<ProfileReviewCursor>
    if (value.lane !== 'reviews') throw new TypeError('Profile Review cursor belongs to another lane.')
    if (value.usernameKey !== access.usernameKey) throw new TypeError('Profile Review cursor belongs to another profile.')
    if (value.viewerId !== access.viewerId) throw new TypeError('Profile Review cursor belongs to another viewer.')
    if (!value.lanes || typeof value.lanes !== 'object') throw new TypeError('Profile Review cursor lanes are invalid.')
    const expected = createLaneState(access.owner)
    for (const lane of lanes) {
      const state = value.lanes[lane]
      if (!state || (state.anchor !== null && typeof state.anchor !== 'string') || typeof state.done !== 'boolean') {
        throw new TypeError('Profile Review cursor lanes are invalid.')
      }
      if (expected[lane].done && !state.done) {
        throw new TypeError('Profile Review cursor exposes an inaccessible lane.')
      }
    }
    return value.lanes
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('belongs')) throw error
    throw new TypeError(`Invalid Profile Review cursor: ${error instanceof Error ? error.message : 'unknown error'}`)
  }
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
