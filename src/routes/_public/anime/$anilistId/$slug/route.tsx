import { createFileRoute, redirect } from '@tanstack/react-router'

import { AnimeDetailPage } from '#/features/anime-detail/ui/anime-detail-page'
import { createCanonicalAnimePath, normalizeAnimeDetailTab, type AnimeDetailTab } from '#/features/anime-detail/shared/anime-detail-contracts'

type AnimeDetailSearch = { tab?: Exclude<AnimeDetailTab, 'overview'> }

/** Serializes Overview by omitting its default query parameter. */
export const serializeAnimeTab = (value: unknown): AnimeDetailSearch => {
  const tab = normalizeAnimeDetailTab(value)
  return tab === 'overview' ? {} : { tab }
}

export const Route = createFileRoute('/_public/anime/$anilistId/$slug')({
  validateSearch: (search) => serializeAnimeTab(search.tab),
  loader: ({ params, location, context }) => {
    const state = context.queryClient.getQueryData(['anime-detail', Number(params.anilistId)]) as { status: string; entry?: { detail: { anilistId: number; slug: string; titles: { display: string } } } } | undefined
    if (state?.status === 'ready' && state.entry && params.slug !== state.entry.detail.slug) {
      const tab = normalizeAnimeDetailTab(new URLSearchParams(location.searchStr).get('tab'))
      throw redirect({ href: createCanonicalAnimePath(state.entry.detail.anilistId, state.entry.detail.titles.display, tab), replace: true })
    }
    return null
  },
  component: AnimeDetailRoute,
})

function AnimeDetailRoute() {
  const state = Route.parentRoute.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return <AnimeDetailPage state={state} tab={normalizeAnimeDetailTab(search.tab)} onTabChange={(tab) => void navigate({ search: serializeAnimeTab(tab), resetScroll: false })} />
}
