import { AlertTriangle, RefreshCw } from 'lucide-react'

import type { DiscoverSectionState } from '../discover/shared/discover-contracts'
import { DiscoverWeeklyList } from '../discover/ui/discover-weekly-list'
import type { DiscoverSectionRetryProps } from '../discover/ui/use-discover-sections'

type HomeWeeklyListProps = DiscoverSectionRetryProps & {
  state: DiscoverSectionState | undefined
  variant: 'mobile' | 'desktop'
}

/** Adapts Trending section state to shared weekly row markup. */
export function HomeWeeklyList({ state, onRetry, isRetrying, retryError, variant }: HomeWeeklyListProps) {
  if (state === undefined) {
    return <section aria-label="This Week loading" className="space-y-3"><h2 className="text-xl font-extrabold">This Week</h2><div className={variant === 'mobile' ? 'flex gap-3 overflow-hidden' : 'space-y-2'}>{[1, 2, 3].map((item) => <div className="h-14 animate-pulse motion-reduce:animate-none rounded-lg bg-muted" key={item} />)}</div></section>
  }
  if (state.status === 'error') {
    return <section className="space-y-3"><h2 className="text-xl font-extrabold">This Week</h2><div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm"><p className="flex gap-2"><AlertTriangle aria-hidden="true" className="size-5 shrink-0" />This Week is unavailable. {state.retryAfterSeconds === null ? 'Try again.' : `Try again in ${state.retryAfterSeconds} seconds.`}</p>{retryError === null ? null : <p role="status" className="mt-2">{retryError}</p>}<button className="mt-3 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" type="button" aria-busy={isRetrying} disabled={isRetrying} onClick={() => onRetry(state.key)}>{isRetrying ? <RefreshCw aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <RefreshCw aria-hidden="true" className="size-4" />}{isRetrying ? 'Retrying' : 'Retry'}</button></div></section>
  }
  if (state.section.items.length === 0) {
    return <DiscoverWeeklyList items={[]} variant={variant} />
  }
  return <DiscoverWeeklyList items={state.section.items.slice(0, 5)} variant={variant} />
}
