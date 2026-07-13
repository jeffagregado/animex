import { createFileRoute, redirect } from '@tanstack/react-router'

import { createCanonicalAnimePath, normalizeAnimeDetailTab, type PublicAnimeDetailState } from '#/features/anime-detail/shared/anime-detail-contracts'
import { AnimeDetailPage } from '#/features/anime-detail/ui/anime-detail-page'
import { ensureAnimeDetailChildData } from './route'

/** Returns canonical missing-slug replacement only after detail is ready. */
export const getMissingSlugRedirectHref = (state: PublicAnimeDetailState, search: string): string | null => state.status === 'ready'
  ? createCanonicalAnimePath(state.entry.detail.anilistId, state.entry.detail.titles.display, normalizeAnimeDetailTab(new URLSearchParams(search).get('tab')))
  : null

export const Route = createFileRoute('/_public/anime/$anilistId/')({
  validateSearch: (search) => ({ tab: normalizeAnimeDetailTab(search.tab) }),
  loader: async ({ params, location, context }) => {
    const state = await ensureAnimeDetailChildData(context.queryClient, params.anilistId)
    const href = getMissingSlugRedirectHref(state, location.searchStr)
    if (href) throw redirect({ href, replace: true })
    return null
  },
  component: AnimeMissingSlugRoute,
})

function AnimeMissingSlugRoute() {
  const state = Route.parentRoute.useLoaderData()
  return <AnimeDetailPage state={state} tab={normalizeAnimeDetailTab(Route.useSearch().tab)} onTabChange={() => undefined} />
}
