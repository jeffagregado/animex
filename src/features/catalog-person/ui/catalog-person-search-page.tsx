import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'

import {
  normalizeSearchQuery,
  QUICK_SEARCH_MAX_LENGTH,
  QUICK_SEARCH_MIN_LENGTH,
} from '#/features/quick-search/shared/quick-search-contracts'
import type {
  CatalogPersonKind,
  CatalogPersonSearchRow,
} from '../shared/catalog-person-contracts'
import { useCatalogPersonSearchPages } from './use-catalog-person-search-pages'

export interface PeopleSearchQueryState {
  canonicalSearch: { q?: string }
  error: string | null
  query: string
  shouldReplace: boolean
  shouldRequest: boolean
}

interface CatalogPersonSearchPageProps {
  kind: CatalogPersonKind
  onQuerySubmit: (query: string) => void
  query: string
}

/** Resolves raw URL state without losing over-maximum input. */
export const resolveCatalogPersonSearchQuery = (rawQuery: unknown): PeopleSearchQueryState => {
  if (rawQuery === undefined) {
    return {
      canonicalSearch: {},
      error: null,
      query: '',
      shouldReplace: false,
      shouldRequest: false,
    }
  }
  if (typeof rawQuery !== 'string') {
    return {
      canonicalSearch: {},
      error: null,
      query: '',
      shouldReplace: true,
      shouldRequest: false,
    }
  }
  const query = rawQuery.trim()
  const canonicalSearch = query.length === 0 ? {} : { q: query }
  if (query.length > QUICK_SEARCH_MAX_LENGTH) {
    return {
      canonicalSearch,
      error: 'Search query must be 100 characters or fewer.',
      query,
      shouldReplace: rawQuery !== query,
      shouldRequest: false,
    }
  }
  const shouldRequest = query.length >= QUICK_SEARCH_MIN_LENGTH
  if (shouldRequest) normalizeSearchQuery(query)
  return {
    canonicalSearch,
    error: null,
    query,
    shouldReplace: rawQuery !== query || query.length === 0,
    shouldRequest,
  }
}

/** Dedicated public Character or Staff search surface. */
export function CatalogPersonSearchPage({
  kind,
  onQuerySubmit,
  query,
}: CatalogPersonSearchPageProps) {
  const [input, setInput] = useState(query)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const state = resolveCatalogPersonSearchQuery(query)
  const pages = useCatalogPersonSearchPages(kind, query, state.shouldRequest)
  const label = kind === 'character' ? 'Characters' : 'Staff'

  useEffect(() => setInput(query), [query])
  useEffect(() => {
    const target = sentinelRef.current
    if (
      !target
      || !pages.hasMore
      || pages.nextPageError
      || typeof IntersectionObserver === 'undefined'
    ) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void pages.loadMore()
    }, { rootMargin: '240px' })
    observer.observe(target)
    return () => observer.disconnect()
  }, [pages.hasMore, pages.loadMore, pages.nextPageError])

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">Search</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">{label}</h1>
      </header>
      <form
        className="mt-6 flex min-w-0 gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          onQuerySubmit(input.trim())
        }}
      >
        <label className="sr-only" htmlFor={`${kind}-search`}>Search {label.toLowerCase()}</label>
        <input
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-card px-4 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          id={`${kind}-search`}
          onChange={(event) => setInput(event.target.value)}
          placeholder={`Search ${label.toLowerCase()}`}
          value={input}
        />
        <button className="min-h-11 shrink-0 rounded-lg bg-cyan-300 px-4 font-black text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2" type="submit">
          <Search aria-hidden="true" className="size-5 sm:hidden" />
          <span className="hidden sm:inline">Search</span>
          <span className="sr-only sm:hidden">Search</span>
        </button>
      </form>
      <SearchState kind={kind} pages={pages} state={state} />
      {pages.hasMore && !pages.nextPageError ? (
        <div className="mt-6" ref={sentinelRef}>
          <button
            className="mx-auto block min-h-11 rounded-lg border border-cyan-300 px-6 font-black text-cyan-300 transition-colors hover:bg-cyan-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-50 motion-reduce:transition-none"
            disabled={pages.loadingMore}
            onClick={() => void pages.loadMore()}
            type="button"
          >
            {pages.loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}
    </main>
  )
}

function SearchState({
  kind,
  pages,
  state,
}: {
  kind: CatalogPersonKind
  pages: ReturnType<typeof useCatalogPersonSearchPages>
  state: PeopleSearchQueryState
}) {
  const noun = kind === 'character' ? 'characters' : 'staff'
  if (state.error) return <div className="mt-6 rounded-xl border border-red-400/40 bg-red-400/10 p-5" role="alert">{state.error}</div>
  if (!state.shouldRequest) return <p className="mt-6 rounded-xl border border-border bg-card/60 p-8 text-center text-muted-foreground">Enter at least 2 characters to search {noun}.</p>
  if (pages.initialLoading) return <p aria-busy="true" className="mt-6 rounded-xl border border-border bg-card/60 p-8 text-center text-muted-foreground">Searching {noun}…</p>
  if (pages.nextPageError && pages.error && pages.items.length === 0) return <SearchError message={pages.error.message} onRetry={() => void pages.loadMore()} />
  if (pages.error && pages.items.length === 0) return <SearchError message={pages.error.message} onRetry={() => void pages.retryInitial()} />
  if (pages.items.length === 0 && !pages.hasMore) return <p className="mt-6 rounded-xl border border-border bg-card/60 p-8 text-center text-muted-foreground">No {noun} found.</p>
  return (
    <section aria-label={`${noun} results`} className="mt-6">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {pages.items.map((row) => <PersonCard key={row.id} row={row} />)}
      </div>
      {pages.nextPageError && pages.error ? <SearchError message={pages.error.message} onRetry={() => void pages.loadMore()} /> : null}
      {!pages.hasMore && pages.items.length > 0 ? <p className="mt-6 text-center text-sm text-muted-foreground">End of results.</p> : null}
    </section>
  )
}

function PersonCard({ row }: { row: CatalogPersonSearchRow }) {
  return (
    <a className="flex min-h-24 min-w-0 items-center gap-4 overflow-hidden rounded-xl border border-border bg-card/70 p-3 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-cyan-300 motion-reduce:transition-none" href={row.destination}>
      <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {row.imageUrl ? <img alt="" className="size-full object-cover" src={row.imageUrl} /> : null}
      </div>
      <div className="min-w-0"><h2 className="truncate font-black">{row.name}</h2>{row.nativeName ? <p className="truncate text-sm text-muted-foreground">{row.nativeName}</p> : null}</div>
    </a>
  )
}

function SearchError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="mt-6 rounded-xl border border-red-400/40 bg-red-400/10 p-5" role="alert"><p>{message}</p><button className="mt-3 min-h-11 rounded-lg border border-border px-5 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" onClick={onRetry} type="button">Retry</button></div>
}
