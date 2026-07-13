import { createFileRoute, redirect } from '@tanstack/react-router'

import { AnimeDetailPage } from '#/features/anime-detail/ui/anime-detail-page'
import { createCanonicalAnimePath, normalizeAnimeDetailTab, type AnimeDetailTab, type PublicAnimeDetailState } from '#/features/anime-detail/shared/anime-detail-contracts'
import { ensureAnimeDetailChildData } from '../route'

type AnimeDetailSearch = { tab?: Exclude<AnimeDetailTab, 'overview'> }

/** Serializes Overview by omitting its default query parameter. */
export const serializeAnimeTab = (value: unknown): AnimeDetailSearch => {
  const tab = normalizeAnimeDetailTab(value)
  return tab === 'overview' ? {} : { tab }
}

/** Keeps tab history scroll-stable for browser back and forward. */
export const getAnimeTabNavigationOptions = (tab: AnimeDetailTab) => ({ search: serializeAnimeTab(tab), resetScroll: false as const })

/** Returns canonical replacement target only when loaded slug is stale. */
export const getStaleSlugRedirectHref = (state: PublicAnimeDetailState, slug: string, search: string): string | null => state.status === 'ready' && slug !== state.entry.detail.slug
  ? createCanonicalAnimePath(state.entry.detail.anilistId, state.entry.detail.titles.display, normalizeAnimeDetailTab(new URLSearchParams(search).get('tab')))
  : null

export const Route = createFileRoute('/_public/anime/$anilistId/$slug')({
  validateSearch: (search) => serializeAnimeTab(search.tab),
  loader: async ({ params, location, context }) => {
    const state = await ensureAnimeDetailChildData(context.queryClient, params.anilistId)
    const href = getStaleSlugRedirectHref(state, params.slug, location.searchStr)
    if (href) throw redirect({ href, replace: true })
    return null
  },
  component: AnimeDetailRoute,
})

function AnimeDetailRoute() {
  const state = Route.parentRoute.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return <AnimeDetailPage state={state} tab={normalizeAnimeDetailTab(search.tab)} onTabChange={(tab) => void navigate(getAnimeTabNavigationOptions(tab))} />
}
