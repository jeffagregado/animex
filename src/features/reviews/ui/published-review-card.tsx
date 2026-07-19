import { useState } from 'react'
import { ChevronRightIcon, ImageOffIcon } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Card, CardContent } from '#/components/ui/card'
import type { ReviewListItem } from '#/features/social/shared/social-contracts'
import { cn } from '#/lib/utils'
import { ReviewSpoilerBadge } from './review-spoiler-badge'
import { ReviewSummary } from './review-summary'

/** Renders published Review listing metadata without loading body content. */
export function PublishedReviewCard({ review }: { review: ReviewListItem }) {
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null)
  if (review.state !== 'published' || review.rating === null || review.publishedAt === null) {
    throw new TypeError('Published Review cards require published Review metadata.')
  }
  const ratingTop = review.containsSpoiler ? 'sm:top-14' : 'sm:top-4'
  return <Card className="min-w-0 border-l-4 border-l-cyan-300 bg-card/55 py-0">
    <CardContent className="relative grid min-w-0 grid-cols-[5.25rem_minmax(0,1fr)] gap-4 p-4 sm:grid-cols-[5.75rem_minmax(0,1fr)_auto]">
      <a aria-label={`View ${review.anime.title}`} className="row-span-3 block min-w-0 overflow-hidden rounded-lg bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" href={`/anime/${review.anime.publicId}/${review.anime.slug}`}>
        {review.anime.coverImageUrl !== null && failedCoverUrl !== review.anime.coverImageUrl ? <img alt={`${review.anime.title} cover`} className="aspect-2/3 h-full w-full object-cover" onError={() => setFailedCoverUrl(review.anime.coverImageUrl)} src={review.anime.coverImageUrl} /> : <span aria-label="Image unavailable" className="grid aspect-2/3 h-full min-h-32 place-items-center text-muted-foreground"><ImageOffIcon aria-hidden="true" className="size-6" /></span>}
      </a>
      <div className="min-w-0">
        <h2 className="min-w-0 truncate pr-20 text-base font-black sm:pr-28 sm:text-lg">{review.anime.title}</h2>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-bold text-foreground">{review.author.displayName}</span>
          <time dateTime={new Date(review.publishedAt).toISOString()} title={new Date(review.publishedAt).toLocaleString()}>{formatRelativeTime(review.publishedAt)}</time>
          {review.visibility === 'private' ? <Badge variant="outline">My Private</Badge> : null}
        </div>
        <ReviewSummary summary={review.summary} variant="list" />
      </div>
      {review.containsSpoiler ? <div className="absolute top-4 right-4"><ReviewSpoilerBadge /></div> : null}
      <div className="col-start-2 row-start-3 flex min-w-0 items-center justify-between gap-3 self-end sm:col-start-3 sm:row-span-3 sm:row-start-1 sm:flex-col sm:items-end sm:justify-end">
        <p aria-label={`Rating: ${review.rating} out of 100`} className={cn('shrink-0 text-xl font-black text-cyan-300 sm:absolute sm:right-4 sm:text-3xl', ratingTop)}>{review.rating}<span className="text-sm font-normal text-muted-foreground sm:text-base">/100</span></p>
        <a className="inline-flex min-h-11 items-center gap-1 font-bold text-cyan-300 hover:text-cyan-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" href={`/reviews/${review.id}`}>Review Detail<ChevronRightIcon aria-hidden="true" className="size-4" /></a>
      </div>
    </CardContent>
  </Card>
}

/** Formats compact Review publish age without a date dependency. */
function formatRelativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1_000))
  if (seconds < 60) return 'now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}
