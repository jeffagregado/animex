import { isCompleteAuthState } from '../auth/use-auth-state'
import { usePublicAuthState } from '../shell/public-auth-context'
import { Composer } from './composer'
import { FeedList } from './feed-list'
import { FeedTabs } from './feed-tabs'
import { HomeSidebar } from './home-sidebar'
import { SeasonalRail } from './seasonal-rail'

export function HomePage() {
  const authState = usePublicAuthState()
  const showPrivateSurfaces = authState.status === 'ready' && isCompleteAuthState(authState.authState)

  return (
    <main className="mx-auto grid w-full max-w-[1480px] gap-6 px-4 pb-28 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-10 lg:pb-8">
      <section className="min-w-0 space-y-6">
        <SeasonalRail />
        <FeedTabs showPrivateTabs={showPrivateSurfaces} />
        {showPrivateSurfaces ? <Composer /> : null}
        <FeedList />
      </section>
      {showPrivateSurfaces ? <HomeSidebar /> : null}
    </main>
  )
}
