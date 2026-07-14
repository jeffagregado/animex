import { createFileRoute } from '@tanstack/react-router'

import { getDiscoverPage } from '#/features/discover/server/discover.functions'
import type { HomeFeedSearch } from '#/features/feed/feed-page'
import { HomePage } from '#/features/home/home-page'

/** Loads shared Discover sections through the existing server boundary. */
const loadHomePage = async () => await getDiscoverPage()

export const Route = createFileRoute('/_public/home')({
  validateSearch: (search): Partial<HomeFeedSearch> => {
    const normalized = normalizeHomeSearch(search)
    return { ...(search.feed === undefined ? {} : { feed: normalized.feed }), ...(search.compose === undefined ? {} : { compose: normalized.compose }) }
  },
  loader: loadHomePage,
  component: HomeRoute,
})

/** Normalizes stable Home tab/composer URL state. */
function normalizeHomeSearch(search: Record<string, unknown>): HomeFeedSearch {
  const feed = search.feed === 'following' || search.feed === 'global' ? search.feed : 'home'
  return { feed, compose: search.compose === true || search.compose === 'true' }
}

function HomeRoute() {
  const data = Route.useLoaderData()
  const search = normalizeHomeSearch(Route.useSearch())
  const navigate = Route.useNavigate()
  return <HomePage data={data} search={search} onSearchChange={(next) => { void navigate({ search: next }) }} />
}
