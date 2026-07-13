import { Component, useEffect, useState, type ReactNode } from 'react'
import { useConvexAuth, useQuery } from 'convex/react'

import { api } from '../../../../convex/_generated/api'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import { usePublicAuthState } from '#/features/shell/public-auth-context'
import {
  reviewListItemSchema,
  reviewStatsSchema,
  type ReviewListItem,
  type ReviewSort,
} from '#/features/social/shared/social-contracts'
import { ReviewCard } from './review-card'
import { parseReviewWireDetail } from '../review-document-adapter'

type AnimeReviewsPanelProps = { anilistId: number; slug: string }
type ReviewPage = { items: ReviewListItem[]; cursor: string | null; hasMore: boolean }
const sorts: { label: string; value: ReviewSort }[] = [{ label: 'Newest', value: 'newest' }, { label: 'Highest Rating', value: 'rating-high' }, { label: 'Lowest Rating', value: 'rating-low' }]

/** Renders viewer-visible Review stats, sorting, and cursor pagination. */
export function AnimeReviewsPanel(props: AnimeReviewsPanelProps) {
  return <ReviewPanelBoundary><AnimeReviewsContent {...props} /></ReviewPanelBoundary>
}

export function AnimeReviewsContent({ anilistId, slug }: AnimeReviewsPanelProps) {
  const auth = usePublicAuthState()
  const convexAuth = useConvexAuth()
  const [sort, setSort] = useState<ReviewSort>('newest')
  const [cursor, setCursor] = useState<string | null>(null)
  const [items, setItems] = useState<ReviewListItem[]>([])
  const rawPage = useQuery(api.reviews.listForAnime, { anilistId, sort, cursor })
  const rawStats = useQuery(api.reviews.getStats, { anilistId })
  const signedIn = auth.status === 'ready' && auth.authState.status === 'complete' && convexAuth.isAuthenticated
  const page = rawPage === undefined ? undefined : parseReviewPage(rawPage)
  const stats = rawStats === undefined ? undefined : reviewStatsSchema.parse(rawStats)

  useEffect(() => { if (page) setItems((current) => reconcileReviewItems(current, page.items, cursor)) }, [cursor, rawPage])
  const changeSort = (value: string | null): void => { if (!value) return; setSort(value as ReviewSort); setCursor(null); setItems([]) }

  return <div className="space-y-5"><header className="flex flex-col gap-4 rounded-xl border border-border bg-card/40 p-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold uppercase tracking-wider text-cyan-300">Viewer-visible reviews</p><h2 className="mt-1 text-2xl font-black">{stats ? `${stats.count} ${stats.count === 1 ? 'review' : 'reviews'}` : 'Loading reviews…'}</h2><p className="mt-1 text-muted-foreground">{stats?.average === null ? 'Average rating unavailable' : stats ? `${stats.average.toFixed(1)} average rating` : 'Loading rating summary…'}</p></div><div className="flex flex-wrap gap-3">{signedIn ? <PrivateWriteReview anilistId={anilistId} slug={slug} /> : null}<Select onValueChange={changeSort} value={sort}><SelectTrigger aria-label="Sort reviews" className="min-w-44"><SelectValue /></SelectTrigger><SelectContent>{sorts.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div></header>{stats ? <RatingBands bands={stats.bands} count={stats.count} /> : <PanelSkeleton />}{rawPage === undefined && items.length === 0 ? <PanelSkeleton /> : null}{page && items.length === 0 ? <div className="rounded-xl border border-border bg-card/40 p-8 text-center"><h2 className="text-xl font-black">No reviews yet</h2><p className="mt-2 text-muted-foreground">Average rating unavailable · 0 reviews</p></div> : null}<div className="space-y-4">{items.map((review) => <ReviewCard key={review.id} review={review} signedIn={signedIn} />)}</div>{page?.hasMore ? <button className="min-h-11 w-full rounded-lg border border-border font-bold hover:border-cyan-300 hover:text-cyan-300" disabled={rawPage === undefined} onClick={() => setCursor(page.cursor)} type="button">{rawPage === undefined ? 'Loading more…' : 'Load more reviews'}</button> : items.length > 0 ? <p className="text-center text-sm text-muted-foreground">You reached the end.</p> : null}</div>
}

function PrivateWriteReview({ anilistId, slug }: AnimeReviewsPanelProps) {
  const mine = useQuery(api.reviews.getMineForAnime, { anilistId })
  if (mine === undefined) return <span className="min-h-10 min-w-32 animate-pulse rounded-lg bg-white/5" />
  const review = mine === null ? null : parseReviewWireDetail(mine)
  return <a className="grid min-h-10 place-items-center rounded-lg bg-coral-400 px-4 font-black text-white hover:bg-coral-300" href={getReviewWriteHref(review, anilistId, slug)}>{review?.state === 'published' ? 'View your review' : review ? 'Resume draft' : 'Write a review'}</a>
}

function RatingBands({ bands, count }: { bands: [number, number, number, number, number, number, number, number, number, number]; count: number }) {
  return <div aria-label="Rating distribution" className="grid gap-2 rounded-xl border border-border bg-card/30 p-4 sm:grid-cols-2">{bands.map((value, index) => <div className="grid grid-cols-[4.5rem_1fr_2rem] items-center gap-2 text-sm" key={getRatingBandLabel(index)}><span>{getRatingBandLabel(index)}</span><span className="h-2 overflow-hidden rounded-full bg-white/5"><span className="block h-full bg-cyan-300" style={{ width: `${count === 0 ? 0 : (value / count) * 100}%` }} /></span><span className="text-right text-muted-foreground">{value}</span></div>)}</div>
}

function PanelSkeleton() { return <div aria-label="Loading reviews" className="space-y-3 rounded-xl border border-border p-5"><div className="h-5 w-2/5 animate-pulse rounded bg-white/5" /><div className="h-24 animate-pulse rounded bg-white/5" /></div> }

class ReviewPanelBoundary extends Component<{ children: ReactNode }, { error: Error | null; key: number }> {
  state: { error: Error | null; key: number } = { error: null, key: 0 }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (!this.state.error) return <div key={this.state.key}>{this.props.children}</div>
    return <div className="rounded-xl border border-red-400/50 bg-red-400/5 p-6"><h2 className="font-black">Reviews unavailable</h2><p className="mt-2 text-red-200" role="alert">{this.state.error.message}</p><button className="mt-4 min-h-11 rounded-lg border border-border px-4 font-bold" onClick={() => this.setState(({ key }) => ({ error: null, key: key + 1 }))} type="button">Retry</button></div>
  }
}

const parseReviewPage = (value: { items: unknown[]; cursor: string | null; hasMore: boolean }): ReviewPage => ({ items: value.items.map((item) => reviewListItemSchema.parse(item)), cursor: value.cursor, hasMore: value.hasMore })
export const reconcileReviewItems = (current: ReviewListItem[], page: ReviewListItem[], cursor: string | null): ReviewListItem[] => cursor === null ? page : [...current, ...page.filter((item) => !current.some((existing) => existing.id === item.id))]
export const getReviewWriteHref = (review: ReviewListItem | null, anilistId: number, slug: string): string => review?.state === 'published' ? `/reviews/${review.id}` : `/anime/${anilistId}/${slug}/reviews/new`
export const getRatingBandLabel = (index: number): string => index === 0 ? '90–100' : `${90 - index * 10}–<${100 - index * 10}`
