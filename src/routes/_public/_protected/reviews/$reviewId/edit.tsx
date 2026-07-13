import { createFileRoute } from '@tanstack/react-router'

import { ReviewEditorPage } from '#/features/reviews/ui/review-editor-page'

export const Route = createFileRoute('/_public/_protected/reviews/$reviewId/edit')({ component: EditReviewRoute })

function EditReviewRoute() { return <ReviewEditorPage anime={null} mode="edit" reviewId={Route.useParams().reviewId} /> }
