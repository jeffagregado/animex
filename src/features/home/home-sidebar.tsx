import type { DiscoverSectionState } from '../discover/shared/discover-contracts'
import { DiscoverUpcomingList } from '../discover/ui/discover-upcoming-list'
import type { DiscoverSectionRetryProps } from '../discover/ui/use-discover-sections'
import { HomeLatestReviews } from './home-latest-reviews'
import { HomeListProgress } from './home-list-progress'
import { HomeWeeklyList } from './home-weekly-list'

type HomeSidebarProps = {
  signedIn: boolean
  trending: DiscoverSectionState | undefined
  trendingRetry: DiscoverSectionRetryProps
  upcoming: DiscoverSectionState | undefined
  upcomingRetry: DiscoverSectionRetryProps
}

/** Composes auth-specific desktop utility modules in locked order. */
export function HomeSidebar({ signedIn, trending, trendingRetry, upcoming, upcomingRetry }: HomeSidebarProps) {
  return <aside aria-label="Home utility column" className="hidden space-y-4 lg:block">{signedIn ? <HomeListProgress /> : null}<HomeLatestReviews /><section className="rounded-lg border border-border bg-card p-4"><HomeWeeklyList state={trending} variant="desktop" {...trendingRetry} /></section><section className="rounded-lg border border-border bg-card p-4"><DiscoverUpcomingList state={upcoming} variant="desktop" {...upcomingRetry} /></section></aside>
}
