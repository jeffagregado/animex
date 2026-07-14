import { createFileRoute } from '@tanstack/react-router'

import { ReviewDiscoveryRoute } from '#/features/reviews/discovery/review-discovery-page'
import { getReviewDiscoveryRouteState, normalizeReviewDiscoverySearch } from '#/features/reviews/discovery/review-discovery-state'
import { usePublicAuthState } from '#/features/shell/public-auth-context'

export const Route = createFileRoute('/_public/reviews/')({
  validateSearch: normalizeReviewDiscoverySearch,
  component: ReviewsRoute,
})

function ReviewsRoute() {
  const auth = usePublicAuthState()
  const routeState = getReviewDiscoveryRouteState(Route.useSearch())
  const navigate = Route.useNavigate()
  return <ReviewDiscoveryRoute auth={auth} routeState={routeState} onNavigate={(options) => { void navigate(options) }} />
}
