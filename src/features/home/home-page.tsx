import type { DiscoverPageData } from '../discover/shared/discover-contracts'
import { DiscoverSectionRail } from '../discover/ui/discover-section'
import { useDiscoverSections } from '../discover/ui/use-discover-sections'
import { FeedPage, type HomeFeedSearch } from '../feed/feed-page'

type HomePageProps = {
  data?: DiscoverPageData
  search: HomeFeedSearch
  onSearchChange: (next: HomeFeedSearch) => void
}

/** Keeps route concerns outside feed UI. */
export function HomePage({ data, search, onSearchChange }: HomePageProps) {
  if (data === undefined) {
    return <HomePageLayout seasonal={<DiscoverSectionRail title="Seasonal Anime" state={undefined} onRetry={() => undefined} isRetrying={false} retryError={null} />} search={search} onSearchChange={onSearchChange} />
  }
  return <HydratedHomePage data={data} search={search} onSearchChange={onSearchChange} />
}

/** Mounts retry state only after loader data is hydrated. */
function HydratedHomePage({ data, search, onSearchChange }: Required<HomePageProps>) {
  const discover = useDiscoverSections(data, false)
  return <HomePageLayout seasonal={<DiscoverSectionRail title="Seasonal Anime" state={discover.sections.seasonal} {...discover.retryProps.seasonal} />} search={search} onSearchChange={onSearchChange} />
}

/** Preserves Home rail and feed geometry across loader states. */
function HomePageLayout({ seasonal, search, onSearchChange }: Omit<HomePageProps, 'data'> & { seasonal: React.ReactNode }) {
  return <div className="[&>main]:pt-0"><div className="mx-auto w-full max-w-[1480px] px-4 pt-4 sm:px-6 lg:px-10">{seasonal}</div><FeedPage onSearchChange={onSearchChange} search={search} /></div>
}
