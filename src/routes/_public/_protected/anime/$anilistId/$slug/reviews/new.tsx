import { createFileRoute, redirect } from '@tanstack/react-router'

import { ReviewEditorPage } from '#/features/reviews/ui/review-editor-page'
import { ensureAnimeDetailChildData } from '#/routes/_public/anime/$anilistId/route'

export const Route = createFileRoute('/_public/_protected/anime/$anilistId/$slug/reviews/new')({
  loader: async ({ context, params }) => {
    const state = await ensureAnimeDetailChildData(context.queryClient, params.anilistId)
    if (state.status !== 'ready') throw new Error(state.status === 'loading' || state.status === 'empty' ? 'Anime details are unavailable.' : state.message)
    if (params.slug !== state.entry.detail.slug) throw redirect({ href: `/anime/${state.entry.detail.anilistId}/${state.entry.detail.slug}/reviews/new`, replace: true })
    return state.entry.detail
  },
  component: CreateReviewRoute,
})

function CreateReviewRoute() { return <ReviewEditorPage anime={Route.useLoaderData()} mode="create" reviewId={null} /> }
