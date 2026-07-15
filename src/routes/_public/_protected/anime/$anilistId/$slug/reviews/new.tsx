import { createFileRoute, redirect } from '@tanstack/react-router'

import { ReviewEditorPage } from '#/features/reviews/ui/review-editor-page'
import { ensureAnimeDetailChildData } from '#/routes/_public/anime/$anilistId/route'

export const Route = createFileRoute('/_public/_protected/anime/$anilistId/$slug/reviews/new')({
  loader: async ({ context, params }) => loadReviewAnime(context.queryClient, params.anilistId, params.slug),
  component: CreateReviewRoute,
})

function CreateReviewRoute() { return <ReviewEditorPage anime={Route.useLoaderData()} mode="create" reviewId={null} /> }

type ReviewAnimeState = Awaited<ReturnType<typeof ensureAnimeDetailChildData>>

/** Loads ready anime data and enforces its canonical Review URL. */
async function loadReviewAnime(queryClient: Parameters<typeof ensureAnimeDetailChildData>[0], anilistId: string, slug: string) {
  const state = await ensureAnimeDetailChildData(queryClient, anilistId)
  const detail = getReadyAnimeDetail(state)
  ensureCanonicalReviewSlug(detail.anilistId, detail.slug, slug)
  return detail
}

/** Narrows child loader state or raises its explicit error. */
const getReadyAnimeDetail = (state: ReviewAnimeState) => {
  if (state.status === 'ready') return state.entry.detail
  if (state.status === 'loading' || state.status === 'empty') throw new Error('Anime details are unavailable.')
  throw new Error(state.message)
}

/** Redirects stale slugs to canonical Review editor URL. */
const ensureCanonicalReviewSlug = (anilistId: number, expected: string, actual: string): void => {
  if (actual !== expected) throw redirect({ href: `/anime/${anilistId}/${expected}/reviews/new`, replace: true })
}
