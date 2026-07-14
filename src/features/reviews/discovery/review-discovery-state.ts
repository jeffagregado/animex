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

export interface ReviewDiscoveryRouteState {
  query: string | null
  sort: ReviewDiscoverySort
  ratingBand: ReviewRatingBand | null
  visibility: ReviewDiscoveryVisibility | null
  visibilitySource: 'absent' | 'invalid' | 'explicit'
}

export interface ReviewDiscoveryRouteSearch {
  q?: string
  sort?: ReviewDiscoverySort
  rating?: ReviewRatingBand
  visibility?: ReviewDiscoveryVisibility
}

export interface ReviewDiscoveryValidatedSearch extends ReviewDiscoveryRouteSearch {
  visibilityInvalid?: true
}

export interface ResolvedReviewDiscoverySearch {
  state: ReviewDiscoverySearchState
  replace: boolean
}

/** Shape-normalizes URL fields while marking invalid visibility for safe replacement. */
export const normalizeReviewDiscoverySearch = (search: Record<string, unknown>): ReviewDiscoveryValidatedSearch => {
  const rawQuery = typeof search.q === 'string' ? search.q.trim() : ''
  const parsedVisibility = reviewDiscoveryVisibilitySchema.safeParse(search.visibility)
  const query = rawQuery.length >= 2 && rawQuery.length <= 100 ? rawQuery : null
  const ratingBand = reviewDiscoveryRatingBandSchema.safeParse(search.rating).data ?? null
  const sort = reviewDiscoverySortSchema.safeParse(search.sort).data ?? 'newest'
  const visibilityInvalid = search.visibility !== undefined && !parsedVisibility.success
  return {
    ...(query === null ? {} : { q: query }),
    ...(sort === 'newest' ? {} : { sort }),
    ...(ratingBand === null ? {} : { rating: ratingBand }),
    ...(search.visibility === undefined ? {} : { visibility: parsedVisibility.data ?? 'public' }),
    ...(visibilityInvalid ? { visibilityInvalid: true as const } : {}),
  }
}

/** Adapts validated URL fields to auth-resolution state. */
export const getReviewDiscoveryRouteState = (search: ReviewDiscoveryValidatedSearch): ReviewDiscoveryRouteState => ({
  query: search.q ?? null,
  ratingBand: search.rating ?? null,
  sort: search.sort ?? 'newest',
  visibility: search.visibility ?? null,
  visibilitySource: search.visibilityInvalid ? 'invalid' : search.visibility === undefined ? 'absent' : 'explicit',
})

/** Resolves viewer-safe visibility only after public auth is ready. */
export const resolveReviewDiscoverySearch = (
  routeState: ReviewDiscoveryRouteState,
  auth: ClientAuthState,
): ResolvedReviewDiscoverySearch | null => {
  if (auth.status !== 'ready') return null
  const signedIn = auth.authState.status === 'complete'
  const explicitVisibility = routeState.visibilitySource === 'explicit' ? routeState.visibility : null
  const visibility = routeState.visibilitySource === 'invalid'
    ? 'public'
    : explicitVisibility === null
      ? signedIn ? 'all' : 'public'
      : signedIn || explicitVisibility === 'public' ? explicitVisibility : 'public'
  return {
    state: {
      query: routeState.query,
      ratingBand: routeState.ratingBand,
      sort: routeState.sort,
      visibility,
    },
    replace: routeState.visibilitySource !== 'explicit' || visibility !== explicitVisibility,
  }
}

/** Serializes resolved state, including explicit visibility for stable auth defaults. */
const serializeReviewDiscoverySearch = (state: ReviewDiscoverySearchState): ReviewDiscoveryValidatedSearch => ({
  ...(state.query === null ? {} : { q: state.query }),
  ...(state.sort === 'newest' ? {} : { sort: state.sort }),
  ...(state.ratingBand === null ? {} : { rating: state.ratingBand }),
  visibility: state.visibility,
})

/** Builds replace-only navigation for auth resolution and filter updates. */
export const getReviewDiscoveryNavigationOptions = (state: ReviewDiscoverySearchState) => ({
  search: serializeReviewDiscoverySearch(state),
  replace: true,
  resetScroll: false,
})
