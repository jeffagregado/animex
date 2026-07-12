import { Flame, Star } from 'lucide-react'

import type { AnimeSummary } from '../shared/discover-contracts'

type DiscoverWeeklyListProps = {
  items: AnimeSummary[]
  variant: 'mobile' | 'desktop'
}

/** Shows trending top-five with a compact mobile grid. */
export function DiscoverWeeklyList({ items, variant }: DiscoverWeeklyListProps) {
  if (items.length === 0) {
    return <section className="space-y-3"><h2 className="flex items-center gap-2 text-xl font-extrabold"><Flame aria-hidden="true" className="size-5 text-coral-500" />This Week</h2><p className="text-sm text-muted-foreground">This week is unavailable.</p></section>
  }
  const layout = variant === 'mobile' ? 'grid grid-cols-2 gap-2' : 'divide-y divide-border'
  return <section aria-labelledby={`this-week-${variant}-heading`} className="space-y-3"><h2 id={`this-week-${variant}-heading`} className="flex items-center gap-2 text-xl font-extrabold"><Flame aria-hidden="true" className="size-5 text-coral-500" />This Week</h2><ol className={layout}>{items.map((anime, index) => <li className="flex min-w-0 items-center gap-3 rounded-lg py-2 data-[mobile=true]:border data-[mobile=true]:border-border data-[mobile=true]:bg-card data-[mobile=true]:px-3" data-mobile={variant === 'mobile' || undefined} key={anime.anilistId}><span className="w-5 text-lg font-bold text-cyan-300">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold">{anime.titles.display}</span><span className="flex items-center gap-1 text-xs text-muted-foreground"><Star aria-hidden="true" className="size-3 text-coral-500" />{anime.trending ?? anime.popularity}</span></li>)}</ol></section>
}
