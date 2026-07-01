import { cn } from '#/lib/utils'

export function FeedTabs() {
  return (
    <div className="flex gap-8 border-b border-white/8">
      {['Home', 'Following', 'Global'].map((tab) => (
        <button className={cn('feed-tab', tab === 'Home' ? 'is-active' : '')} type="button" key={tab}>
          {tab}
        </button>
      ))}
    </div>
  )
}
