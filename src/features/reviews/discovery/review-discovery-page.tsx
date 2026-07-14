import { useEffect, useRef, useState } from 'react'
import { FileSearchIcon } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '#/components/ui/empty'
import { Skeleton } from '#/components/ui/skeleton'
import type { ClientAuthState } from '#/features/auth/use-auth-state'
import { usePublicAuthState } from '#/features/shell/public-auth-context'
import { ReviewDiscoveryCard } from './review-discovery-card'
import { ReviewDiscoveryFilters } from './review-discovery-filters'
import {
  getReviewDiscoveryNavigationOptions,
  resolveReviewDiscoverySearch,
  type ReviewDiscoveryRouteState,
  type ReviewDiscoverySearchState,
} from './review-discovery-state'
import { useReviewDiscoveryPages } from './use-review-discovery-pages'

interface ReviewDiscoveryPageProps {
  searchState: ReviewDiscoverySearchState
  onSearchStateChange: (state: ReviewDiscoverySearchState) => void
}

interface ReviewDiscoveryRouteProps {
  auth: ClientAuthState
  routeState: ReviewDiscoveryRouteState
  onNavigate: (options: ReturnType<typeof getReviewDiscoveryNavigationOptions>) => void
}

/** Resolves auth-sensitive route state before mounting discovery queries. */
export function ReviewDiscoveryRoute({ auth, routeState, onNavigate }: ReviewDiscoveryRouteProps) {
  const resolution = resolveReviewDiscoverySearch(routeState, auth)
  useEffect(() => {
    if (resolution?.replace) onNavigate(getReviewDiscoveryNavigationOptions(resolution.state))
  }, [onNavigate, resolution])
  if (auth.status === 'error') return <ReviewDiscoveryAuthState message={auth.message} />
  if (resolution === null || resolution.replace) return <ReviewDiscoveryAuthState message={null} />
  return <ReviewDiscoveryPage searchState={resolution.state} onSearchStateChange={(state) => onNavigate(getReviewDiscoveryNavigationOptions(state))} />
}

/** Renders public Review search, filters, cards, and infinite cursor states. */
export function ReviewDiscoveryPage({ searchState, onSearchStateChange }: ReviewDiscoveryPageProps) {
  const auth = usePublicAuthState()
  const profile = auth.status === 'ready' && auth.authState.status === 'complete' ? auth.authState.profile : null
  const signedIn = profile !== null
  const authReady = auth.status === 'ready'
  const authKey = profile?.id ?? 'signed-out'
  const visibilityReady = authReady && (signedIn || searchState.visibility === 'public')
  const [searchText, setSearchText] = useState(searchState.query ?? '')
  const pages = useReviewDiscoveryPages(searchState, authKey, visibilityReady)

  useEffect(() => { setSearchText(searchState.query ?? '') }, [searchState.query])
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmed = searchText.trim()
      const query = trimmed.length >= 2 ? trimmed : null
      if (query !== searchState.query) onSearchStateChange({ ...searchState, query })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [onSearchStateChange, searchState, searchText])

  return <main className="mx-auto min-h-full w-full min-w-0 max-w-5xl overflow-x-hidden px-4 pt-6 pb-28 sm:px-6 lg:pb-12">
    <header className="mb-5 min-w-0"><h1 className="text-3xl font-black sm:text-4xl">Reviews</h1><p className="mt-1 text-muted-foreground">Find recent reviews from the AnimeX community.</p></header>
    <ReviewDiscoveryFilters state={searchState} searchText={searchText} signedIn={signedIn} onSearchTextChange={setSearchText} onStateChange={onSearchStateChange} />
    <ReviewDiscoveryList pages={pages} />
  </main>
}

/** Preserves route geometry while auth resolves or reports a scoped failure. */
function ReviewDiscoveryAuthState({ message }: { message: string | null }) {
  return <main className="mx-auto min-h-full w-full min-w-0 max-w-5xl overflow-x-hidden px-4 pt-6 pb-28 sm:px-6 lg:pb-12">
    <header className="mb-5 min-w-0"><h1 className="text-3xl font-black sm:text-4xl">Reviews</h1><p className="mt-1 text-muted-foreground">Find recent reviews from the AnimeX community.</p></header>
    {message === null
      ? <div aria-label="Loading review access" className="grid min-h-40 gap-3 rounded-xl border border-border p-5"><Skeleton className="h-5 w-2/5" /><Skeleton className="h-12 w-full" /><Skeleton className="h-5 w-3/5" /></div>
      : <div className="min-h-32 rounded-xl border border-red-400/40 bg-red-400/5 p-5" role="alert"><h2 className="font-black">Review access unavailable</h2><p className="mt-2 text-red-200">{message}</p></div>}
  </main>
}

function ReviewDiscoveryList({ pages }: { pages: ReturnType<typeof useReviewDiscoveryPages> }) {
  const sentinelRef = useReviewIntersection(pages)
  return <section aria-label="Review results" className="mt-5 grid min-w-0 gap-3">
    {pages.initialLoading ? <ReviewSkeletons /> : null}
    {pages.items.map((review) => <ReviewDiscoveryCard key={review.id} review={review} />)}
    <ReviewDiscoveryStatus pages={pages} />
    <ReviewDiscoveryPagination pages={pages} sentinelRef={sentinelRef} />
  </section>
}

/** Observes next-page sentinel with a synchronous duplicate guard. */
function useReviewIntersection(pages: ReturnType<typeof useReviewDiscoveryPages>) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const intersectionPending = useRef(false)
  useEffect(() => { if (!pages.loadingMore) intersectionPending.current = false }, [pages.loadingMore])
  useEffect(() => {
    const target = sentinelRef.current
    if (target === null || !pages.hasMore || pages.error !== null || pages.initialLoading || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || intersectionPending.current) return
      intersectionPending.current = true
      void pages.loadMore().finally(() => { intersectionPending.current = false })
    })
    observer.observe(target)
    return () => observer.disconnect()
  }, [pages.error, pages.hasMore, pages.initialLoading, pages.loadMore])
  return sentinelRef
}

function ReviewDiscoveryStatus({ pages }: { pages: ReturnType<typeof useReviewDiscoveryPages> }) {
  return <>
    {!pages.initialLoading && pages.items.length === 0 && !pages.hasMore && pages.error === null ? <ReviewEmpty /> : null}
    {pages.error ? <div className="min-h-28 rounded-xl border border-red-400/40 bg-red-400/5 p-5 text-center" role="alert"><p className="font-bold">Reviews unavailable</p><p className="mt-1 text-sm text-red-200">{pages.error}</p><Button className="mt-3 min-h-11" onClick={() => void pages.retry()} type="button" variant="outline">Retry</Button></div> : null}
  </>
}

function ReviewDiscoveryPagination({ pages, sentinelRef }: { pages: ReturnType<typeof useReviewDiscoveryPages>; sentinelRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div aria-label="More reviews" className="min-h-20" ref={sentinelRef}>
      {pages.loadingMore ? <div className="grid grid-cols-[5rem_1fr] gap-4 rounded-xl border border-border p-4" role="status"><Skeleton className="h-24" /><div className="grid gap-2"><Skeleton className="h-5 w-2/5" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-3/5" /></div></div> : null}
      {!pages.hasMore && pages.items.length > 0 && pages.error === null ? <p className="py-7 text-center text-sm text-muted-foreground">You reached the end.</p> : null}
      {pages.hasMore && typeof IntersectionObserver === 'undefined' && pages.error === null ? <Button className="min-h-11 w-full" onClick={() => void pages.loadMore()} type="button" variant="outline">Load more</Button> : null}
    </div>
  )
}

function ReviewSkeletons() {
  return <div aria-label="Loading reviews" className="grid gap-3">{[0, 1, 2].map((key) => <div className="grid min-h-40 grid-cols-[5rem_1fr] gap-4 rounded-xl border border-border p-4" key={key}><Skeleton /><div className="grid content-center gap-3"><Skeleton className="h-5 w-2/5" /><Skeleton className="h-4 w-1/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></div></div>)}</div>
}

function ReviewEmpty() {
  return <Empty className="min-h-52 border border-border"><EmptyHeader><EmptyMedia variant="icon"><FileSearchIcon /></EmptyMedia><EmptyTitle>No reviews found</EmptyTitle><EmptyDescription>Try another anime, author, Rating, or visibility filter.</EmptyDescription></EmptyHeader><EmptyContent /></Empty>
}
