import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, ImageOff, RefreshCw } from 'lucide-react'

import type { AnimeSummary, DiscoverSectionKey, DiscoverSectionState } from '../shared/discover-contracts'
import { HorizontalRail } from './horizontal-rail'

type DiscoverSectionRailProps = {
  title: string
  state: DiscoverSectionState | undefined
  onRetry: (key: DiscoverSectionKey) => void
  isRetrying: boolean
  retryError: string | null
}

type AnimePosterProps = {
  anime: AnimeSummary
  rank: number | null
}

/** Shows an intentional image failure state without substituting fake content. */
function AnimePoster({ anime, rank }: AnimePosterProps) {
  const [hasImageError, setHasImageError] = useState(false)
  const label = anime.format?.replaceAll('_', ' ') ?? 'Anime'
  const imageUrl = anime.coverImageUrl

  useEffect(() => {
    setHasImageError(false)
  }, [imageUrl])

  return (
    <Link to="/anime/$anilistId/$slug" params={{ anilistId: String(anime.anilistId), slug: anime.slug }} className="block h-full shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
    <article className="relative flex h-full w-36 flex-col overflow-hidden rounded-lg border border-border bg-card sm:w-40">
      <div className="aspect-[2/3] bg-muted">
        {imageUrl !== null && !hasImageError ? <img className="size-full object-cover" src={imageUrl} alt={`${anime.titles.display} cover`} onError={() => setHasImageError(true)} /> : <div className="flex size-full flex-col items-center justify-center gap-2 px-3 text-center text-xs text-muted-foreground"><ImageOff aria-hidden="true" className="size-5" /><span>Image unavailable</span></div>}
      </div>
      {rank !== null ? <span className="absolute left-2 top-2 rounded bg-coral-500 px-2 py-1 text-sm font-bold text-white">{rank}</span> : null}
      <div className="flex min-h-16 flex-1 flex-col gap-1 p-3"><h3 className="line-clamp-2 text-sm font-bold leading-4">{anime.titles.display}</h3><p className="mt-auto text-xs text-muted-foreground">{anime.seasonYear ?? 'TBA'} · {label}</p></div>
    </article>
    </Link>
  )
}

/** Displays one discover source with loading, failure, empty, and ready states. */
export function DiscoverSectionRail({ title, state, onRetry, isRetrying, retryError }: DiscoverSectionRailProps) {
  if (state === undefined) {
    return <section aria-label={`${title} loading`} className="space-y-3"><h2 className="text-xl font-extrabold">{title}</h2><div className="flex gap-3 overflow-hidden">{[1, 2, 3, 4, 5].map((item) => <div className="h-56 w-36 shrink-0 animate-pulse motion-reduce:animate-none rounded-lg bg-muted" key={item} />)}</div></section>
  }

  if (state.status === 'error') {
    return <section className="space-y-3"><h2 className="text-xl font-extrabold">{title}</h2><div role="alert" className="space-y-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm"><p className="flex items-center gap-2"><AlertTriangle aria-hidden="true" className="size-5 shrink-0" />{title} is unavailable. {state.retryAfterSeconds === null ? 'Try again.' : `Try again in ${state.retryAfterSeconds} seconds.`}</p>{retryError === null ? null : <p role="status">{retryError}</p>}<button type="button" className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border px-3 py-2 font-semibold outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-cyan-300" onClick={() => onRetry(state.key)} aria-label={`Retry ${title}`} aria-busy={isRetrying} disabled={isRetrying}>{isRetrying ? <RefreshCw aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <RefreshCw aria-hidden="true" className="size-4" />}{isRetrying ? 'Retrying' : 'Retry'}</button></div></section>
  }

  if (state.section.items.length === 0) {
    return <section className="space-y-3"><h2 className="text-xl font-extrabold">{title}</h2><p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">No anime available in this section.</p></section>
  }

  const key = state.section.key
  return <section aria-labelledby={`${key}-heading`} className="space-y-3"><h2 id={`${key}-heading`} className="text-xl font-extrabold">{title}</h2><HorizontalRail label={title}>{state.section.items.map((anime, index) => <AnimePoster anime={anime} rank={key === 'trending' ? index + 1 : null} key={anime.anilistId} />)}</HorizontalRail></section>
}
