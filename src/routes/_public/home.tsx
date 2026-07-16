import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import { getDiscoverPage } from '#/features/discover/server/discover.functions'
import type { HomeFeedSearch } from '#/features/feed/feed-page'
import type { FeedView } from '#/features/feed/use-feed-pages'
import { HomePage } from '#/features/home/home-page'

interface HomeRouteSearch {
  feed?: FeedView | 'following'
  compose?: boolean
}

interface ResolvedHomeSearch {
  state: HomeFeedSearch
  replace: boolean
}

/** Loads shared Discover sections through the existing server boundary. */
const loadHomePage = async () => await getDiscoverPage()

/** Accepts active and stale Home search values without starting a hidden query. */
const parseHomeSearch = (search: Record<string, unknown>): HomeRouteSearch => ({
  ...(search.feed === 'home' || search.feed === 'global' || search.feed === 'following'
    ? { feed: search.feed }
    : {}),
  ...(search.compose === true || search.compose === 'true' ? { compose: true } : {}),
})

export const Route = createFileRoute('/_public/home')({
  validateSearch: parseHomeSearch,
  loader: loadHomePage,
  component: HomeRoute,
  pendingComponent: HomeRoutePending,
})

/** Resolves a stale Following route to active Home state. */
export const resolveHomeSearch = (search: HomeRouteSearch): ResolvedHomeSearch => ({
  state: {
    feed: search.feed === 'global' ? 'global' : 'home',
    compose: search.compose === true,
  },
  replace: search.feed === 'following',
})

/** Omits default Home/closed-composer values from the canonical URL. */
const serializeHomeSearch = (state: HomeFeedSearch): HomeRouteSearch => ({
  ...(state.feed === 'global' ? { feed: 'global' as const } : {}),
  ...(state.compose ? { compose: true } : {}),
})

function useResolvedHomeSearch() {
  const resolution = resolveHomeSearch(Route.useSearch())
  const navigate = Route.useNavigate()

  useEffect(() => {
    if (!resolution.replace) return
    void navigate({ search: serializeHomeSearch(resolution.state), replace: true })
  }, [navigate, resolution.replace, resolution.state.compose, resolution.state.feed])

  return {
    replacing: resolution.replace,
    search: resolution.state,
    onSearchChange: (next: HomeFeedSearch): void => {
      void navigate({ search: serializeHomeSearch(next) })
    },
  }
}

function HomeRoute() {
  const data = Route.useLoaderData()
  const resolved = useResolvedHomeSearch()
  if (resolved.replacing) return <HomeRouteCanonicalizing />
  return <HomePage data={data} search={resolved.search} onSearchChange={resolved.onSearchChange} />
}

/** Keeps Home composition visible while Discover sections hydrate. */
function HomeRoutePending() {
  const resolved = useResolvedHomeSearch()
  if (resolved.replacing) return <HomeRouteCanonicalizing />
  return <HomePage search={resolved.search} onSearchChange={resolved.onSearchChange} />
}

function HomeRouteCanonicalizing() {
  return <main aria-busy="true" aria-label="Normalizing Home feed" className="mx-auto min-h-[55dvh] max-w-3xl px-4 py-10" />
}
