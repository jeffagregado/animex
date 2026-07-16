import type { ClientAuthState } from '#/features/auth/use-auth-state'
import {
  reviewDiscoveryRatingBandSchema,
  reviewDiscoverySortSchema,
  reviewDiscoveryVisibilitySchema,
  type ReviewDiscoverySort,
  type ReviewDiscoveryVisibility,
  type ReviewRatingBand,
} from '../shared/review-discovery-contracts'

export type ActiveReviewDiscoveryVisibility =
  Exclude<ReviewDiscoveryVisibility, 'followers'>

export interface ReviewDiscoverySearchState {
  query: string | null
  sort: ReviewDiscoverySort
  ratingBand: ReviewRatingBand | null
  visibility: ActiveReviewDiscoveryVisibility
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
  replacementSearch: ReviewDiscoveryValidatedSearch | null
  signedIn: boolean
}

export interface ReviewDiscoveryNavigationOptions {
  search: ReviewDiscoveryValidatedSearch
  replace: true
  resetScroll: false
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

const getDefaultVisibility = (
  signedIn: boolean,
): ActiveReviewDiscoveryVisibility => signedIn ? 'all' : 'public'

const serializeRouteFields = (
  routeState: ReviewDiscoveryRouteState,
): ReviewDiscoveryValidatedSearch => ({
  ...(routeState.query === null ? {} : { q: routeState.query }),
  ...(routeState.sort === 'newest' ? {} : { sort: routeState.sort }),
  ...(routeState.ratingBand === null ? {} : { rating: routeState.ratingBand }),
})

/** Resolves viewer-safe visibility only after public auth is ready. */
export const resolveReviewDiscoverySearch = (
  routeState: ReviewDiscoveryRouteState,
  auth: ClientAuthState,
): ResolvedReviewDiscoverySearch | null => {
  if (auth.status !== 'ready') return null
  const signedIn = auth.authState.status === 'complete'
  const defaultVisibility = getDefaultVisibility(signedIn)
  const explicitVisibility = routeState.visibilitySource === 'explicit' ? routeState.visibility : null
  const mustReplace = routeState.visibilitySource === 'invalid'
    || explicitVisibility === 'followers'
    || (!signedIn
      && explicitVisibility !== null
      && explicitVisibility !== 'public')
  const visibility = mustReplace || explicitVisibility === null
    ? defaultVisibility
    : explicitVisibility as ActiveReviewDiscoveryVisibility
  return {
    state: {
      query: routeState.query,
      ratingBand: routeState.ratingBand,
      sort: routeState.sort,
      visibility,
    },
    replacementSearch: mustReplace ? serializeRouteFields(routeState) : null,
    signedIn,
  }
}

/** Builds canonical replace-only navigation for filter updates. */
export const getReviewDiscoveryNavigationOptions = (
  state: ReviewDiscoverySearchState,
  signedIn: boolean,
): ReviewDiscoveryNavigationOptions => ({
  search: {
    ...(state.query === null ? {} : { q: state.query }),
    ...(state.sort === 'newest' ? {} : { sort: state.sort }),
    ...(state.ratingBand === null ? {} : { rating: state.ratingBand }),
    ...(state.visibility === getDefaultVisibility(signedIn)
      ? {}
      : { visibility: state.visibility }),
  },
  replace: true,
  resetScroll: false,
})

/** Preserves normalized route fields while replacing stale visibility. */
export const getReviewDiscoveryReplacementOptions = (
  search: ReviewDiscoveryValidatedSearch,
): ReviewDiscoveryNavigationOptions => ({
  search,
  replace: true,
  resetScroll: false,
})
