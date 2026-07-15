import { useEffect, useState } from 'react'
import { useConvex } from 'convex/react'
import { ImageOffIcon, RefreshCwIcon } from 'lucide-react'

import { api } from '../../../convex/_generated/api'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { reviewListItemSchema, type ReviewListItem } from '../social/shared/social-contracts'
import { ReviewSpoilerBadge } from '../reviews/ui/review-spoiler-badge'
import { ReviewSummary } from '../reviews/ui/review-summary'

type PublishedReviewListItem = Omit<ReviewListItem, 'state' | 'publishedAt'> & { state: 'published'; publishedAt: number }

type LatestReviewsState = {
  items: PublishedReviewListItem[]
  loading: boolean
  error: string | null
}

/** Loads latest Public Reviews while retaining successful content across refresh errors. */
export function HomeLatestReviews() {
  const client = useConvex()
  const [request, setRequest] = useState(0)
  const [state, setState] = useState<LatestReviewsState>({ items: [], loading: true, error: null })

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: null }))
    void client.query(api.reviews.listLatestPublic, { limit: 5 }).then((raw) => {
      if (!active) return
      const items = raw.map(parseLatestReview)
      setState({ items, loading: false, error: null })
    }).catch((cause: unknown) => {
      if (!active) return
      setState((current) => ({ ...current, loading: false, error: cause instanceof Error ? cause.message : 'Latest Reviews could not be loaded.' }))
    })
    return () => { active = false }
  }, [client, request])

  const retry = (): void => setRequest((current) => current + 1)
  return <Card size="sm"><CardHeader className="grid-cols-[1fr_auto]"><CardTitle><h2 className="text-xl font-extrabold">Latest Reviews</h2></CardTitle><Button aria-label="Refresh Latest Reviews" disabled={state.loading} onClick={retry} size="icon-sm" variant="ghost"><RefreshCwIcon className={state.loading ? 'animate-spin motion-reduce:animate-none' : ''} /></Button></CardHeader><CardContent>{state.loading && state.items.length === 0 ? <LatestReviewsLoading /> : null}{state.error === null ? null : <div className="mb-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm" role="alert"><p>{state.error}</p><Button aria-label="Retry Latest Reviews" className="mt-2" onClick={retry} size="sm" variant="outline">Retry</Button></div>}{!state.loading && state.error === null && state.items.length === 0 ? <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">No published reviews yet.</p> : null}{state.items.length === 0 ? null : <ul className="divide-y divide-border">{state.items.map((review) => <LatestReviewRow key={review.id} review={review} />)}</ul>}<a className="mt-3 inline-flex min-h-10 items-center text-sm font-bold text-cyan-300 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" href="/reviews" aria-label="See more reviews">See more</a></CardContent></Card>
}

/** Renders one compact latest-Review row. */
function LatestReviewRow({ review }: { review: PublishedReviewListItem }) {
  const [imageFailed, setImageFailed] = useState(false)
  const timestamp = review.publishedAt
  return <li><a aria-label={`Read ${review.anime.title} review by ${review.author.displayName}`} className="relative flex min-w-0 gap-3 rounded-lg px-1 py-3 outline-none transition hover:bg-cyan-300/5 focus-visible:ring-2 focus-visible:ring-cyan-300" href={`/reviews/${review.id}`}><div className="h-20 w-14 shrink-0 overflow-hidden rounded-md bg-muted">{review.anime.coverImageUrl !== null && !imageFailed ? <img alt={`${review.anime.title} cover`} className="size-full object-cover" onError={() => setImageFailed(true)} src={review.anime.coverImageUrl} /> : <span className="grid size-full place-items-center text-muted-foreground"><ImageOffIcon aria-label="Image unavailable" className="size-4" /></span>}</div><article className="min-w-0 flex-1 pr-12"><h3 className="truncate text-sm font-bold">{review.anime.title}</h3><p className="truncate text-xs text-muted-foreground">{review.author.displayName}</p><time className="text-xs text-muted-foreground" dateTime={new Date(timestamp).toISOString()}>{formatRelativeTime(timestamp, Date.now())}</time><ReviewSummary summary={review.summary} variant="list" /></article>{review.containsSpoiler ? <span className="absolute right-1 top-3"><ReviewSpoilerBadge /></span> : null}</a></li>
}

/** Rejects non-published or dateless records before shared DTO parsing. */
function parseLatestReview(value: unknown): PublishedReviewListItem {
  if (typeof value !== 'object' || value === null || !('state' in value) || !('publishedAt' in value) || value.state !== 'published' || typeof value.publishedAt !== 'number') {
    throw new TypeError('Latest Reviews requires published Reviews with publish times.')
  }
  const parsed = reviewListItemSchema.parse(value)
  if (parsed.state !== 'published' || parsed.publishedAt === null) {
    throw new TypeError('Latest Reviews requires published Reviews with publish times.')
  }
  return { ...parsed, state: 'published', publishedAt: parsed.publishedAt }
}

/** Formats compact relative timestamps without external date dependencies. */
function formatRelativeTime(timestamp: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (seconds < 60) return 'now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function LatestReviewsLoading() {
  return <div aria-label="Latest Reviews loading" className="space-y-3">{[1, 2, 3].map((item) => <div className="h-20 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" key={item} />)}</div>
}
