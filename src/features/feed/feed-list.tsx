import { useEffect, useRef, useState, type RefObject } from 'react'

import type { FeedCard as FeedCardData } from '../social/shared/social-contracts'
import { FeedCard } from './feed-card'

interface FeedListProps {
  cards: FeedCardData[]
  error: string | null
  hasMore: boolean
  initialLoading: boolean
  loadingMore: boolean
  ownerId: string | null
  signedIn: boolean
  loadMore: () => void
  onChanged: () => void
  onEdit: (card: Extract<FeedCardData, { kind: 'post' }>) => void
  retry: () => void
  view: 'home' | 'following' | 'global'
}

/** Renders truthful feed loading, empty, error, paging, and terminal states. */
export function FeedList(props: FeedListProps) {
  const pagination = useFeedPagination(props)

  if (props.initialLoading) return <section aria-busy="true" aria-label="Loading feed" className="space-y-3">{[1, 2, 3].map((item) => <div className="h-48 animate-pulse rounded-lg border border-white/8 bg-card/40" key={item} />)}</section>
  if (props.error && props.cards.length === 0) return <FeedState title="Feed unavailable" message={props.error} action="Retry" onAction={props.retry} />
  if (props.cards.length === 0) return <FeedState title={props.view === 'following' ? 'Following feed is coming in Phase 6' : 'No activity yet'} message={props.view === 'following' ? 'Follow connections are not active yet. Try Home or Global.' : 'Nothing visible in this feed yet.'} />

  return <section aria-label={`${props.view} feed`} className="space-y-3">{props.cards.map((card) => <FeedCard card={card} key={card.id} onChanged={props.onChanged} onEdit={props.onEdit} owner={props.ownerId === card.author.id} signedIn={props.signedIn} />)}{props.error ? <FeedState title="Could not load more" message={props.error} action="Retry" onAction={props.retry} /> : null}<FeedPagination error={props.error} hasMore={props.hasMore} loadMore={props.loadMore} loadingMore={props.loadingMore} observerAvailable={pagination.observerAvailable} sentinelRef={pagination.sentinelRef} /></section>
}

function useFeedPagination(props: FeedListProps): { observerAvailable: boolean | null; sentinelRef: RefObject<HTMLDivElement | null> } {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const requestedRef = useRef(false)
  const [observerAvailable, setObserverAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    const available = typeof IntersectionObserver !== 'undefined'
    setObserverAvailable(available)
    if (!available || props.initialLoading || props.cards.length === 0 || !props.hasMore || props.error !== null) return
    const sentinel = sentinelRef.current
    if (sentinel === null) throw new Error('Feed pagination sentinel is unavailable.')
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || requestedRef.current || props.loadingMore) return
      requestedRef.current = true
      props.loadMore()
    }, { rootMargin: '240px 0px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [props.cards.length, props.error, props.hasMore, props.initialLoading, props.loadMore, props.loadingMore])

  useEffect(() => {
    if (!props.loadingMore) requestedRef.current = false
  }, [props.loadingMore])

  return { observerAvailable, sentinelRef }
}

interface FeedPaginationProps {
  error: string | null
  hasMore: boolean
  loadMore: () => void
  loadingMore: boolean
  observerAvailable: boolean | null
  sentinelRef: RefObject<HTMLDivElement | null>
}

function FeedPagination({ error, hasMore, loadMore, loadingMore, observerAvailable, sentinelRef }: FeedPaginationProps) {
  if (error !== null) return null
  if (!hasMore) return <p className="py-4 text-center text-sm text-muted-foreground">You’re all caught up.</p>
  return <div aria-label="More feed activity" ref={sentinelRef}>{loadingMore ? <p aria-live="polite" className="py-4 text-center text-sm text-muted-foreground">Loading more…</p> : observerAvailable === false ? <button className="min-h-12 w-full rounded-xl border border-cyan-300/40 font-black text-cyan-200 hover:bg-cyan-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" onClick={loadMore} type="button">Load more</button> : null}</div>
}

interface FeedStateProps {
  title: string
  message: string
  action?: string
  onAction?: () => void
}

function FeedState({ title, message, action, onAction }: FeedStateProps) {
  return <section className="rounded-xl border border-white/8 bg-card/40 p-8 text-center"><h2 className="text-xl font-black">{title}</h2><p className="mt-2 text-muted-foreground" role={action ? 'alert' : undefined}>{message}</p>{action && onAction ? <button className="mt-5 min-h-11 rounded-lg border border-cyan-300/40 px-5 font-bold text-cyan-200 hover:bg-cyan-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" onClick={onAction} type="button">{action}</button> : null}</section>
}
