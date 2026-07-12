import { useEffect, useState } from 'react'
import { Flame, ImageOff, Star } from 'lucide-react'

import type { AnimeSummary } from '../shared/discover-contracts'

type DiscoverWeeklyListProps = {
  items: AnimeSummary[]
  variant: 'mobile' | 'desktop'
}

type WeeklyCoverProps = {
  anime: AnimeSummary
}

/** Shows a compact weekly cover with an explicit failure state. */
function WeeklyCover({ anime }: WeeklyCoverProps) {
  const [hasImageError, setHasImageError] = useState(false)
  const imageUrl = anime.coverImageUrl

  useEffect(() => {
    setHasImageError(false)
  }, [imageUrl])

  return <span className="flex h-11 w-8 shrink-0 overflow-hidden rounded bg-muted">{imageUrl !== null && !hasImageError ? <img className="size-full object-cover" src={imageUrl} alt={`${anime.titles.display} cover`} onError={() => setHasImageError(true)} /> : <ImageOff aria-label="Image unavailable" className="m-auto size-4 text-muted-foreground" />}</span>
}

/** Shows trending top-five with a compact mobile grid. */
export function DiscoverWeeklyList({ items, variant }: DiscoverWeeklyListProps) {
  if (items.length === 0) {
    return <section className="space-y-3"><h2 className="flex items-center gap-2 text-xl font-extrabold"><Flame aria-hidden="true" className="size-5 text-coral-400" />This Week</h2><p className="text-sm text-muted-foreground">This week is unavailable.</p></section>
  }
  const layout = variant === 'mobile' ? 'grid grid-cols-2 gap-2' : 'divide-y divide-border'
  return <section aria-labelledby={`this-week-${variant}-heading`} className="space-y-3"><h2 id={`this-week-${variant}-heading`} className="flex items-center gap-2 text-xl font-extrabold"><Flame aria-hidden="true" className="size-5 text-coral-400" />This Week</h2><ol className={layout}>{items.map((anime, index) => variant === 'desktop' ? <li className="flex min-w-0 items-center gap-3 py-2" key={anime.anilistId}><span className="w-4 shrink-0 text-sm font-semibold tabular-nums">{index + 1}</span><WeeklyCover anime={anime} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{anime.titles.display}</span><span className="mt-0.5 block text-xs text-muted-foreground">{anime.seasonYear ?? 'TBA'} · {anime.format?.replaceAll('_', ' ') ?? 'Anime'}</span></span><span aria-label={`Trending: ${anime.trending ?? anime.popularity}`} className="flex shrink-0 items-center gap-1 text-xs tabular-nums text-muted-foreground"><Flame aria-hidden="true" className="size-3 text-coral-400" />{anime.trending ?? anime.popularity}</span></li> : <li className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card px-3 py-2" key={anime.anilistId}><span className="w-5 text-lg font-bold text-cyan-300">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold">{anime.titles.display}</span><span className="flex items-center gap-1 text-xs text-muted-foreground"><Star aria-hidden="true" className="size-3 text-coral-500" />{anime.trending ?? anime.popularity}</span></li>)}</ol></section>
}
