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
  if (props.initialLoading) return <section aria-busy="true" aria-label="Loading feed" className="space-y-4">{[1, 2, 3].map((item) => <div className="h-48 animate-pulse rounded-xl border border-white/8 bg-card/40" key={item} />)}</section>
  if (props.error && props.cards.length === 0) return <FeedState title="Feed unavailable" message={props.error} action="Retry" onAction={props.retry} />
  if (props.cards.length === 0) return <FeedState title={props.view === 'following' ? 'Following feed is coming in Phase 6' : 'No activity yet'} message={props.view === 'following' ? 'Follow connections are not active yet. Try Home or Global.' : 'Nothing visible in this feed yet.'} />
  return <section aria-label={`${props.view} feed`} className="space-y-4">{props.cards.map((card) => <FeedCard card={card} key={card.id} onChanged={props.onChanged} onEdit={props.onEdit} owner={props.ownerId === card.author.id} signedIn={props.signedIn} />)}{props.error ? <FeedState title="Could not load more" message={props.error} action="Retry" onAction={props.retry} /> : null}{props.hasMore && !props.error ? <button className="min-h-12 w-full rounded-xl border border-cyan-300/40 font-black text-cyan-200 hover:bg-cyan-300/10 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-60" disabled={props.loadingMore} onClick={props.loadMore} type="button">{props.loadingMore ? 'Loading…' : 'Load more'}</button> : null}{!props.hasMore && !props.error ? <p className="py-4 text-center text-sm text-muted-foreground">You’re all caught up.</p> : null}</section>
}

function FeedState({ title, message, action, onAction }: { title: string; message: string; action?: string; onAction?: () => void }) { return <section className="rounded-xl border border-white/8 bg-card/40 p-8 text-center"><h2 className="text-xl font-black">{title}</h2><p className="mt-2 text-muted-foreground" role={action ? 'alert' : undefined}>{message}</p>{action && onAction ? <button className="mt-5 min-h-11 rounded-lg border border-cyan-300/40 px-5 font-bold text-cyan-200" onClick={onAction} type="button">{action}</button> : null}</section> }
