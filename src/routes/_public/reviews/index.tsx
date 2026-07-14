import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import { ReviewDiscoveryPage } from '#/features/reviews/discovery/review-discovery-page'
import {
  getReviewDiscoveryNavigationOptions,
  getReviewDiscoveryVisibilityReplacement,
  normalizeReviewDiscoverySearch,
  serializeReviewDiscoverySearch,
} from '#/features/reviews/discovery/review-discovery-state'
import { usePublicAuthState } from '#/features/shell/public-auth-context'

export const Route = createFileRoute('/_public/reviews/')({
  validateSearch: (search) => serializeReviewDiscoverySearch(normalizeReviewDiscoverySearch(search)),
  component: ReviewsRoute,
})

function ReviewsRoute() {
  const auth = usePublicAuthState()
  const search = normalizeReviewDiscoverySearch(Route.useSearch())
  const navigate = Route.useNavigate()
  const replacement = getReviewDiscoveryVisibilityReplacement(search, auth)

  useEffect(() => {
    if (replacement !== null) void navigate(getReviewDiscoveryNavigationOptions(replacement))
  }, [navigate, replacement])

  return <ReviewDiscoveryPage searchState={search} onSearchStateChange={(state) => { void navigate(getReviewDiscoveryNavigationOptions(state)) }} />
}
