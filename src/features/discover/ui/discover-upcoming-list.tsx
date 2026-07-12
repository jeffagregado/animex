import { useEffect, useState } from 'react'
import { AlertTriangle, ImageOff, RefreshCw } from 'lucide-react'

import type { AnimeSummary, DiscoverSectionKey, DiscoverSectionState } from '../shared/discover-contracts'

type DiscoverUpcomingListProps = {
  state: DiscoverSectionState | undefined
  onRetry: (key: DiscoverSectionKey) => void
  isRetrying: boolean
  retryError: string | null
  variant: 'mobile' | 'desktop'
}

type UpcomingItemProps = {
  anime: AnimeSummary
}

/** Renders an image-aware compact upcoming entry. */
function UpcomingItem({ anime }: UpcomingItemProps) {
  const [hasImageError, setHasImageError] = useState(false)
  const imageUrl = anime.coverImageUrl

  useEffect(() => {
    setHasImageError(false)
  }, [imageUrl])

  return <article className="flex min-w-0 gap-3 rounded-lg border border-border bg-card p-2"><div className="h-16 w-12 shrink-0 overflow-hidden rounded bg-muted">{imageUrl !== null && !hasImageError ? <img className="size-full object-cover" src={imageUrl} alt={`${anime.titles.display} cover`} onError={() => setHasImageError(true)} /> : <span className="flex size-full items-center justify-center text-[10px] text-muted-foreground"><ImageOff aria-label="Image unavailable" className="size-4" /></span>}</div><div className="min-w-0"><h3 className="line-clamp-2 text-sm font-bold">{anime.titles.display}</h3><p className="mt-1 text-xs text-cyan-300">{anime.seasonYear ?? 'TBA'}</p></div></article>
}

/** Displays upcoming anime as a compact list instead of a reused poster rail. */
export function DiscoverUpcomingList({ state, onRetry, isRetrying, retryError, variant }: DiscoverUpcomingListProps) {
  if (state === undefined) {
    return <section aria-label="Upcoming loading" className="space-y-3"><h2 className="text-xl font-extrabold">Upcoming</h2><div className={variant === 'mobile' ? 'flex gap-3 overflow-hidden' : 'space-y-2'}>{[1, 2, 3].map((item) => <div className="h-20 w-44 animate-pulse motion-reduce:animate-none rounded-lg bg-muted" key={item} />)}</div></section>
  }
  if (state.status === 'error') {
    return <section className="space-y-3"><h2 className="text-xl font-extrabold">Upcoming</h2><div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm"><p className="flex gap-2"><AlertTriangle aria-hidden="true" className="size-5 shrink-0" />Upcoming is unavailable. {state.retryAfterSeconds === null ? 'Try again.' : `Try again in ${state.retryAfterSeconds} seconds.`}</p>{retryError === null ? null : <p role="status" className="mt-2">{retryError}</p>}<button className="mt-3 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" type="button" aria-busy={isRetrying} disabled={isRetrying} onClick={() => onRetry(state.key)}>{isRetrying ? <RefreshCw aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <RefreshCw aria-hidden="true" className="size-4" />}{isRetrying ? 'Retrying' : 'Retry'}</button></div></section>
  }
  if (state.section.items.length === 0) {
    return <section className="space-y-3"><h2 className="text-xl font-extrabold">Upcoming</h2><p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">No upcoming anime is available.</p></section>
  }
  const layout = variant === 'mobile' ? 'flex gap-3 overflow-x-auto pb-2' : 'space-y-2'
  return <section aria-labelledby={`upcoming-${variant}-heading`} className="space-y-3"><h2 id={`upcoming-${variant}-heading`} className="text-xl font-extrabold">Upcoming</h2><div className={layout}>{state.section.items.map((anime) => <div className={variant === 'mobile' ? 'w-48 shrink-0' : ''} key={anime.anilistId}><UpcomingItem anime={anime} /></div>)}</div></section>
}
