import type { ClientAuthState } from '#/features/auth/use-auth-state'
import {
  reviewDiscoveryRatingBandSchema,
  reviewDiscoverySortSchema,
  reviewDiscoveryVisibilitySchema,
  type ReviewDiscoverySort,
  type ReviewDiscoveryVisibility,
  type ReviewRatingBand,
} from '../shared/review-discovery-contracts'

export interface ReviewDiscoverySearchState {
  query: string | null
  sort: ReviewDiscoverySort
  ratingBand: ReviewRatingBand | null
  visibility: ReviewDiscoveryVisibility
}

export interface ReviewDiscoveryRouteSearch {
  q?: string
  sort?: ReviewDiscoverySort
  rating?: ReviewRatingBand
  visibility?: ReviewDiscoveryVisibility
}

/** Shape-normalizes untrusted Review discovery URL state. */
export const normalizeReviewDiscoverySearch = (search: Record<string, unknown>): ReviewDiscoverySearchState => {
  const rawQuery = typeof search.q === 'string' ? search.q.trim() : ''
  const query = rawQuery.length >= 2 && rawQuery.length <= 100 ? rawQuery : null
  return {
    query,
    ratingBand: reviewDiscoveryRatingBandSchema.safeParse(search.rating).data ?? null,
    sort: reviewDiscoverySortSchema.safeParse(search.sort).data ?? 'newest',
    visibility: reviewDiscoveryVisibilitySchema.safeParse(search.visibility).data ?? 'public',
  }
}

/** Omits default Review discovery values from URL state. */
export const serializeReviewDiscoverySearch = (state: ReviewDiscoverySearchState): ReviewDiscoveryRouteSearch => ({
  ...(state.query === null ? {} : { q: state.query }),
  ...(state.sort === 'newest' ? {} : { sort: state.sort }),
  ...(state.ratingBand === null ? {} : { rating: state.ratingBand }),
  ...(state.visibility === 'public' ? {} : { visibility: state.visibility }),
})

/** Builds replace-only navigation for debounced filter updates. */
export const getReviewDiscoveryNavigationOptions = (state: ReviewDiscoverySearchState) => ({
  search: serializeReviewDiscoverySearch(state),
  replace: true,
  resetScroll: false,
})

/** Returns safe public URL state after signed-out auth resolves. */
export const getReviewDiscoveryVisibilityReplacement = (
  state: ReviewDiscoverySearchState,
  auth: ClientAuthState,
): ReviewDiscoverySearchState | null => {
  if (auth.status !== 'ready' || auth.authState.status === 'complete' || state.visibility === 'public') return null
  return { ...state, visibility: 'public' }
}
