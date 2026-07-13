import { createFileRoute } from '@tanstack/react-router'

import { ReviewDetailPage } from '#/features/reviews/ui/review-detail-page'

export const Route = createFileRoute('/_public/reviews/$reviewId')({ component: PublicReviewDetailRoute })

function PublicReviewDetailRoute() { return <ReviewDetailPage reviewId={Route.useParams().reviewId} /> }
