import { useEffect, useRef } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'

import { AnimeImage } from '#/features/anime-detail/ui/anime-image'
import { createCanonicalAnimePath } from '#/features/anime-detail/shared/anime-detail-contracts'
import { getCatalogPersonWorks } from '../server/catalog-person.functions'
import type {
  CatalogPersonKind,
  CatalogPersonWork,
  CatalogPersonWorkPage,
} from '../shared/catalog-person-contracts'

type CatalogPersonWorkGridProps = {
  kind: CatalogPersonKind
  personId: number
}

/** Loads ordered provider pages while retaining first-seen Anime identities. */
export function CatalogPersonWorkGrid({ kind, personId }: CatalogPersonWorkGridProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const continuedPageRef = useRef<string | null>(null)
  const query = useInfiniteQuery({
    queryKey: ['catalog-person-works', kind, personId],
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<CatalogPersonWorkPage> => {
      const state = await getCatalogPersonWorks({ data: { kind, id: personId, page: pageParam } })
      if (state.status === 'ready') return state.page
      if (state.status === 'error') throw new Error(state.message)
      throw new Error('Catalog person works were not found.')
    },
    getNextPageParam: (lastPage) => lastPage.hasNextPage ? lastPage.currentPage + 1 : undefined,
  })
  const pages = query.data?.pages ?? []
  const items = uniqueWorks(pages)
  const section = kind === 'character' ? 'anime' : 'works'

  useEffect(() => {
    continuedPageRef.current = null
  }, [kind, personId])

  useEffect(() => {
    const last = pages.at(-1)
    if (!last || !query.hasNextPage || query.isFetchingNextPage || query.isFetchNextPageError || countNewLastPage(pages) > 0) return
    const key = `${kind}:${personId}:${last.currentPage}`
    if (continuedPageRef.current === key) return
    continuedPageRef.current = key
    void query.fetchNextPage()
  }, [kind, pages, personId, query.fetchNextPage, query.hasNextPage, query.isFetchNextPageError, query.isFetchingNextPage])

  useEffect(() => {
    const target = sentinelRef.current
    if (!target || !query.hasNextPage || query.isFetchNextPageError || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !query.isFetchingNextPage) void query.fetchNextPage()
    }, { rootMargin: '240px' })
    observer.observe(target)
    return () => observer.disconnect()
  }, [query.fetchNextPage, query.hasNextPage, query.isFetchNextPageError, query.isFetchingNextPage])

  if (query.isPending) {
    return <div aria-busy="true" className="rounded-xl border border-border bg-card/60 p-8 text-center text-muted-foreground">Loading {section}…</div>
  }
  if (query.isError && query.data === undefined) {
    return <WorkError message={query.error.message} onRetry={() => void query.refetch()} />
  }

  return <div>
    {items.length > 0 ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{items.map((item) => <WorkCard item={item} key={item.anime.id} />)}</div> : null}
    {query.isFetchNextPageError ? <WorkError message={query.error.message} onRetry={() => void query.fetchNextPage()} /> : null}
    {query.hasNextPage && !query.isFetchNextPageError ? <div className="mt-6"><div aria-hidden="true" ref={sentinelRef} /><button className="mx-auto block min-h-11 rounded-lg border border-cyan-300 px-6 font-black text-cyan-300 transition-colors hover:bg-cyan-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-50 motion-reduce:transition-none" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()} type="button">{query.isFetchingNextPage ? 'Loading…' : 'Load more'}</button></div> : null}
    {!query.hasNextPage && items.length === 0 ? <p className="rounded-xl border border-border bg-card/60 p-8 text-center text-muted-foreground">No {section} available.</p> : null}
    {!query.hasNextPage && items.length > 0 ? <p className="mt-6 text-center text-sm text-muted-foreground">End of {section}.</p> : null}
  </div>
}

function WorkCard({ item }: { item: CatalogPersonWork }) {
  const metadata = [item.role, item.anime.format?.replace('_', ' '), item.anime.seasonYear?.toString()].filter((value): value is string => Boolean(value))
  return <article className="min-w-0 overflow-hidden rounded-xl border border-border bg-card/70">
    <a className="group block min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300" href={createCanonicalAnimePath(item.anime.id, item.anime.title, 'overview')}>
      <AnimeImage alt={`${item.anime.title} poster`} className="aspect-[2/3] w-full object-cover transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none" src={item.anime.coverImageUrl} />
      <div className="p-3"><h3 className="line-clamp-2 font-black">{item.anime.title}</h3>{metadata.length > 0 ? <p className="mt-1 text-xs text-muted-foreground">{metadata.join(' · ')}</p> : null}</div>
    </a>
  </article>
}

function WorkError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="mt-6 rounded-xl border border-red-400/40 bg-red-400/10 p-5" role="alert"><p>{message}</p><button className="mt-3 min-h-11 rounded-lg border border-border px-5 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" onClick={onRetry} type="button">Retry</button></div>
}

/** Keeps first provider occurrence across every fetched page. */
function uniqueWorks(pages: CatalogPersonWorkPage[]): CatalogPersonWork[] {
  const ids = new Set<number>()
  return pages.flatMap((page) => page.items.filter((item) => {
    if (ids.has(item.anime.id)) return false
    ids.add(item.anime.id)
    return true
  }))
}

/** Detects empty and duplicate-only pages that must auto-continue. */
function countNewLastPage(pages: CatalogPersonWorkPage[]): number {
  const last = pages.at(-1)
  if (!last) return 0
  const priorIds = new Set(pages.slice(0, -1).flatMap((page) => page.items.map((item) => item.anime.id)))
  return last.items.filter((item, index) => !priorIds.has(item.anime.id) && last.items.findIndex((candidate) => candidate.anime.id === item.anime.id) === index).length
}
