import { useConvexAuth } from 'convex/react'

import type { DiscoverPageData } from '../discover/shared/discover-contracts'
import { DiscoverSectionRail } from '../discover/ui/discover-section'
import { useDiscoverSections } from '../discover/ui/use-discover-sections'
import { FeedPage, type HomeFeedSearch } from '../feed/feed-page'
import { usePublicAuthState } from '../shell/public-auth-context'
import { HomeSidebar } from './home-sidebar'

type HomePageProps = {
  data?: DiscoverPageData
  search: HomeFeedSearch
  onSearchChange: (next: HomeFeedSearch) => void
}

/** Keeps route concerns outside feed UI. */
export function HomePage({ data, search, onSearchChange }: HomePageProps) {
  const auth = usePublicAuthState()
  const convexAuth = useConvexAuth()
  const signedIn = auth.status === 'ready' && auth.authState.status === 'complete' && convexAuth.isAuthenticated
  if (data === undefined) {
    const retry = { onRetry: () => undefined, isRetrying: false, retryError: null }
    return <HomePageLayout seasonal={<DiscoverSectionRail title="Seasonal Anime" state={undefined} {...retry} />} sidebar={<HomeSidebar signedIn={signedIn} trending={undefined} trendingRetry={retry} upcoming={undefined} upcomingRetry={retry} />} search={search} onSearchChange={onSearchChange} />
  }
  return <HydratedHomePage data={data} signedIn={signedIn} search={search} onSearchChange={onSearchChange} />
}

/** Mounts retry state only after loader data is hydrated. */
function HydratedHomePage({ data, signedIn, search, onSearchChange }: Required<HomePageProps> & { signedIn: boolean }) {
  const discover = useDiscoverSections(data, false)
  return <HomePageLayout seasonal={<DiscoverSectionRail title="Seasonal Anime" state={discover.sections.seasonal} {...discover.retryProps.seasonal} />} sidebar={<HomeSidebar signedIn={signedIn} trending={discover.sections.trending} trendingRetry={discover.retryProps.trending} upcoming={discover.sections.upcoming} upcomingRetry={discover.retryProps.upcoming} />} search={search} onSearchChange={onSearchChange} />
}

/** Preserves Home rail and feed geometry across loader states. */
function HomePageLayout({ seasonal, sidebar, search, onSearchChange }: Omit<HomePageProps, 'data'> & { seasonal: React.ReactNode; sidebar: React.ReactNode }) {
  return <div className="[&>main]:pt-0"><div className="mx-auto w-full max-w-[1480px] px-4 pt-4 sm:px-6 lg:px-10">{seasonal}</div><FeedPage onSearchChange={onSearchChange} search={search} sidebar={sidebar} /></div>
}
