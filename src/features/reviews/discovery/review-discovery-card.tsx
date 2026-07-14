import { ChevronRightIcon, ImageOffIcon } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Card, CardContent } from '#/components/ui/card'
import type { ReviewListItem } from '#/features/social/shared/social-contracts'
import { ReviewSummary } from '../ui/review-summary'

/** Renders truthful compact Review discovery metadata without body content. */
export function ReviewDiscoveryCard({ review }: { review: ReviewListItem }) {
  if (review.state !== 'published' || review.rating === null || review.publishedAt === null) {
    throw new TypeError('Review discovery cards require published Review metadata.')
  }
  return <Card className="min-w-0 border-l-4 border-l-cyan-300 bg-card/55 py-0">
    <CardContent className="relative grid min-w-0 grid-cols-[5.25rem_minmax(0,1fr)] gap-4 p-4 sm:grid-cols-[5.75rem_minmax(0,1fr)_auto]">
      <a aria-label={`View ${review.anime.title}`} className="row-span-3 block min-w-0 overflow-hidden rounded-lg bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" href={`/anime/${review.anime.anilistId}/${review.anime.slug}`}>
        {review.anime.coverImageUrl ? <img alt={`${review.anime.title} cover`} className="aspect-2/3 h-full w-full object-cover" src={review.anime.coverImageUrl} /> : <span className="grid aspect-2/3 h-full min-h-32 place-items-center text-muted-foreground"><ImageOffIcon aria-hidden="true" className="size-6" /></span>}
      </a>
      <div className="min-w-0">
        <h2 className="min-w-0 truncate pr-16 text-base font-black sm:pr-24 sm:text-lg">{review.anime.title}</h2>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-bold text-foreground">{review.author.displayName}</span>
          <span>{new Date(review.publishedAt).toLocaleDateString()}</span>
          {review.visibility === 'public' ? null : <Badge variant="outline">{review.visibility === 'followers' ? 'My Followers' : 'My Private'}</Badge>}
        </div>
        <ReviewSummary hasSpoiler={review.summaryHasSpoiler} summary={review.summary} variant="list" />
      </div>
      <p aria-label={`Rating: ${review.rating} out of 100`} className="absolute top-4 right-4 text-xl font-black text-cyan-300 sm:text-3xl">{review.rating}<span className="text-sm font-normal text-muted-foreground sm:text-base">/100</span></p>
      <div className="col-start-2 flex min-w-0 items-end justify-end sm:col-start-3 sm:row-span-3 sm:row-start-1 sm:flex-col sm:justify-end">
        <a className="inline-flex min-h-11 items-center gap-1 font-bold text-cyan-300 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" href={`/reviews/${review.id}`}>Review Detail<ChevronRightIcon className="size-4" /></a>
      </div>
    </CardContent>
  </Card>
}
