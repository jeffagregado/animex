import { SiteHeader } from '../shell/site-header'
import { mainNavigationItems } from '../shell/navigation'
import { Composer } from './composer'
import { FeedList } from './feed-list'
import { FeedTabs } from './feed-tabs'
import { HomeSidebar } from './home-sidebar'
import { MobileBottomNavigation } from './mobile-bottom-navigation'
import { SeasonalRail } from './seasonal-rail'

export function HomePage() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <SiteHeader activeLabel="Home" navItems={mainNavigationItems} showAuthAction={true} />
      <div className="mx-auto grid w-full max-w-[1480px] gap-6 px-4 pb-28 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-10 lg:pb-8">
        <section className="min-w-0 space-y-6">
          <SeasonalRail />
          <FeedTabs />
          <Composer />
          <FeedList />
        </section>
        <HomeSidebar />
      </div>
      <MobileBottomNavigation />
    </main>
  )
}
