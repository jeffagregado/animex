import { createFileRoute } from '@tanstack/react-router'

import { FeedCardDetailPage } from '#/features/feed/feed-card-detail-page'

export const Route = createFileRoute('/_public/feed/$feedCardId')({ component: FeedCardRoute })

function FeedCardRoute() { const params = Route.useParams() as { feedCardId: string }; return <FeedCardDetailPage cardId={params.feedCardId} /> }
