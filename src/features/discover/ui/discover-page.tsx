import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { BookOpen, Sparkles } from 'lucide-react'

import { refreshDiscoverSection } from '../server/discover.functions'
import { DISCOVER_GENRES, type DiscoverSectionKey, type DiscoverSectionState } from '../shared/discover-contracts'
import { DiscoverSearchFilters } from './discover-search-filters'
import { DiscoverSearchResults } from './discover-search-results'
import { DiscoverSectionRail } from './discover-section'
import { DiscoverUpcomingList } from './discover-upcoming-list'
import { DiscoverWeeklyList } from './discover-weekly-list'
import type { DiscoverPageProps } from './discover-ui.types'

const getRefreshErrorMessage = (error: unknown): string => error instanceof Error && error.message.length > 0 ? error.message : 'Refresh failed. Try again.'

type SectionRefresher = {
  retry: (key: DiscoverSectionKey) => void
  isPending: boolean
  isError: boolean
  error: unknown
}

/** Isolates pending and error state for one discover section refresh. */
function useSectionRefresher(onSuccess: (state: DiscoverSectionState) => void): SectionRefresher {
  const activeKey = useRef<DiscoverSectionKey | null>(null)
  const mutation = useMutation({
    mutationFn: async (key: DiscoverSectionKey) => await refreshDiscoverSection({ data: key }),
    onSuccess,
    onSettled: () => {
      activeKey.current = null
    },
  })
  const retry = (key: DiscoverSectionKey): void => {
    if (activeKey.current !== null) {
      return
    }
    activeKey.current = key
    mutation.mutate(key)
  }
  return { retry, isPending: mutation.isPending, isError: mutation.isError, error: mutation.error }
}

/** Provides responsive Discover rails plus URL-controlled search. */
export function DiscoverPage({ data, isLoading, searchState, onSearchStateChange }: DiscoverPageProps) {
  const [overrides, setOverrides] = useState<Partial<Record<DiscoverSectionKey, DiscoverSectionState>>>({})
  const applyRefresh = (state: DiscoverSectionState): void => {
    const key = state.status === 'ready' ? state.section.key : state.key
    setOverrides((current) => ({ ...current, [key]: state }))
  }
  const trendingRefresh = useSectionRefresher(applyRefresh)
  const seasonalRefresh = useSectionRefresher(applyRefresh)
  const recommendationRefresh = useSectionRefresher(applyRefresh)
  const upcomingRefresh = useSectionRefresher(applyRefresh)
  const getSection = (key: DiscoverSectionKey): DiscoverSectionState | undefined => overrides[key] ?? data?.sections[key]
  const getRetryProps = (refresh: SectionRefresher): { isRetrying: boolean, retryError: string | null } => ({
    isRetrying: refresh.isPending,
    retryError: refresh.isError ? getRefreshErrorMessage(refresh.error) : null,
  })
  const trending = getSection('trending')
  const weeklyItems = trending?.status === 'ready' ? trending.section.items.slice(0, 5) : []
  const selectGenre = (genre: typeof DISCOVER_GENRES[number]): void => onSearchStateChange({ ...searchState, genre }, 'push')
  const trendingRetry = getRetryProps(trendingRefresh)
  const seasonalRetry = getRetryProps(seasonalRefresh)
  const recommendationRetry = getRetryProps(recommendationRefresh)
  const upcomingRetry = getRetryProps(upcomingRefresh)

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
          <DiscoverSectionRail title="Trending Anime" state={isLoading ? undefined : trending} onRetry={trendingRefresh.retry} {...trendingRetry} />
          <DiscoverSectionRail title="Seasonal Anime" state={isLoading ? undefined : getSection('seasonal')} onRetry={seasonalRefresh.retry} {...seasonalRetry} />
          <section aria-labelledby="genres-heading" className="space-y-3">
            <h2 id="genres-heading" className="text-xl font-extrabold">Genres</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {DISCOVER_GENRES.map((genre) => <button className="rounded-lg border border-border bg-card px-3 py-3 text-sm font-semibold outline-none transition hover:border-cyan-300 hover:bg-cyan-300/10 focus-visible:ring-2 focus-visible:ring-cyan-300" type="button" onClick={() => selectGenre(genre)} key={genre}>{genre}</button>)}
            </div>
          </section>
          <DiscoverSectionRail title="Popular Recommendations" state={isLoading ? undefined : getSection('recommendations')} onRetry={recommendationRefresh.retry} {...recommendationRetry} />
          <div className="space-y-7 lg:hidden">
            <DiscoverWeeklyList items={weeklyItems} variant="mobile" />
            <DiscoverUpcomingList state={isLoading ? undefined : getSection('upcoming')} onRetry={upcomingRefresh.retry} variant="mobile" {...upcomingRetry} />
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
          <section className="rounded-lg border border-border bg-card p-4"><DiscoverUpcomingList state={isLoading ? undefined : getSection('upcoming')} onRetry={upcomingRefresh.retry} variant="desktop" {...upcomingRetry} /></section>
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
