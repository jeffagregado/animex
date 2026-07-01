import { cn } from '#/lib/utils'

export function FeedTabs({ showPrivateTabs }: { showPrivateTabs: boolean }) {
  const tabs = showPrivateTabs ? ['Home', 'Following', 'Global'] : ['Home']

  return (
    <div className="flex gap-8 border-b border-white/8">
      {tabs.map((tab) => (
        <button className={cn('feed-tab', tab === 'Home' ? 'is-active' : '')} type="button" key={tab}>
          {tab}
        </button>
      ))}
    </div>
  )
}
