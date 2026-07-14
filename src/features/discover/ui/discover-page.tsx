import { BookOpen, Sparkles } from 'lucide-react'

import { DISCOVER_GENRES } from '../shared/discover-contracts'
import { DiscoverSearchFilters } from './discover-search-filters'
import { DiscoverSearchResults } from './discover-search-results'
import { DiscoverSectionRail } from './discover-section'
import { DiscoverUpcomingList } from './discover-upcoming-list'
import { DiscoverWeeklyList } from './discover-weekly-list'
import type { DiscoverPageProps } from './discover-ui.types'
import { useDiscoverSections } from './use-discover-sections'

/** Provides responsive Discover rails plus URL-controlled search. */
export function DiscoverPage({ data, isLoading, searchState, onSearchStateChange }: DiscoverPageProps) {
  const discover = useDiscoverSections(data, isLoading)
  const trending = discover.sections.trending
  const weeklyItems = trending?.status === 'ready' ? trending.section.items.slice(0, 5) : []
  const selectGenre = (genre: typeof DISCOVER_GENRES[number]): void => onSearchStateChange({ ...searchState, genre }, 'push')

  return (
    <main className="min-h-dvh overflow-x-clip bg-background text-foreground">
      <div className="mx-auto grid w-full max-w-[1480px] gap-6 px-4 pb-12 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_27rem] lg:px-10">
        <div className="min-w-0 space-y-7">
          <header className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Discover</h1>
            <p className="text-sm text-muted-foreground sm:text-base">Explore anime, find what you love.</p>
          </header>
          <DiscoverSearchFilters searchState={searchState} onStateChange={onSearchStateChange} />
          <DiscoverSearchResults searchState={searchState} />
          <DiscoverSectionRail title="Trending Anime" state={trending} {...discover.retryProps.trending} />
          <DiscoverSectionRail title="Seasonal Anime" state={discover.sections.seasonal} {...discover.retryProps.seasonal} />
          <DiscoverSectionRail title="Popular Recommendations" state={discover.sections.recommendations} {...discover.retryProps.recommendations} />
          <div className="space-y-7 lg:hidden">
            <DiscoverWeeklyList items={weeklyItems} variant="mobile" />
            <DiscoverUpcomingList state={discover.sections.upcoming} variant="mobile" {...discover.retryProps.upcoming} />
            <MangaPlaceholder />
          </div>
        </div>
        <aside className="hidden min-w-0 space-y-4 lg:block">
          <section className="rounded-lg border border-border bg-card p-4"><DiscoverWeeklyList items={weeklyItems} variant="desktop" /></section>
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="flex items-center gap-2 text-xl font-extrabold"><Sparkles aria-hidden="true" className="size-5 text-cyan-300" />Top Genres</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {DISCOVER_GENRES.map((genre) => <button className="rounded border border-border px-2 py-2 text-left text-sm outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-cyan-300" type="button" onClick={() => selectGenre(genre)} key={genre}>{genre}</button>)}
            </div>
          </section>
          <section className="rounded-lg border border-border bg-card p-4"><DiscoverUpcomingList state={discover.sections.upcoming} variant="desktop" {...discover.retryProps.upcoming} /></section>
          <MangaPlaceholder />
        </aside>
      </div>
    </main>
  )
}

/** Keeps unimplemented manga work visibly separate from anime results. */
function MangaPlaceholder() {
  return <section className="rounded-lg border border-border bg-card p-5"><h2 className="flex items-center gap-2 text-lg font-extrabold"><BookOpen aria-hidden="true" className="size-6 text-muted-foreground" />Manga lists later</h2><p className="mt-2 text-sm text-muted-foreground">Manga features are coming soon. Thank you for your patience!</p></section>
}
