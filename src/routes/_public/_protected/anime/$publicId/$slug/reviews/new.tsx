import { createFileRoute, redirect } from '@tanstack/react-router'

import { ReviewEditorPage } from '#/features/reviews/ui/review-editor-page'
import { ensureAnimeDetailChildData } from '#/routes/_public/anime/$publicId/route'
import type { AnimeDetail } from '#/features/anime-detail/shared/anime-detail-contracts'

export const Route = createFileRoute('/_public/_protected/anime/$publicId/$slug/reviews/new')({
  loader: async ({ context, params }) => loadReviewAnime(
    context.queryClient,
    params.publicId,
    params.slug,
  ),
  component: CreateReviewRoute,
})

function CreateReviewRoute() { return <ReviewEditorPage anime={Route.useLoaderData()} mode="create" reviewId={null} /> }

type ReviewAnimeState = Awaited<ReturnType<typeof ensureAnimeDetailChildData>>

/** Loads ready anime data and enforces its canonical Review URL. */
async function loadReviewAnime(queryClient: Parameters<typeof ensureAnimeDetailChildData>[0], publicId: string, slug: string) {
  const state = await ensureAnimeDetailChildData(queryClient, publicId)
  const detail = getReadyAnimeDetail(state)
  const href = getCanonicalReviewEditorHref(detail, publicId, slug)
  if (href) throw redirect({ href, replace: true })
  return detail
}

/** Narrows child loader state or raises its explicit error. */
const getReadyAnimeDetail = (state: ReviewAnimeState) => {
  if (state.status === 'ready') return state.entry.detail
  if (state.status === 'loading' || state.status === 'empty') throw new Error('Anime details are unavailable.')
  throw new Error(state.message)
}

/** Returns the canonical Review editor URL for one stale slug. */
export const getCanonicalReviewEditorHref = (
  detail: Pick<AnimeDetail, 'publicId' | 'slug'>,
  actualPublicId: string,
  actualSlug: string,
): string | null => actualPublicId === detail.publicId && actualSlug === detail.slug
  ? null
  : `/anime/${detail.publicId}/${detail.slug}/reviews/new`
