import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import type { ReviewListItem } from '#/features/social/shared/social-contracts'
import { PublishedReviewCard } from '#/features/reviews/ui/published-review-card'
import {
  useProfileAutoLoad,
  type ProfilePageState,
} from './use-profile-pages'

/** Renders Profile Reviews without social controls or footer. */
export function ProfileReviews({
  state,
}: {
  state: ProfilePageState<ReviewListItem>
}) {
  const sentinelRef = useProfileAutoLoad(state)
  if (state.initialLoading) {
    return (
      <section aria-label="Loading reviews" className="grid gap-3">
        {[1, 2, 3].map((item) => (
          <Skeleton className="h-44 rounded-xl" key={item} />
        ))}
      </section>
    )
  }
  return (
    <section aria-label="Profile reviews" className="grid gap-3">
      {state.items.map((review) => (
        <PublishedReviewCard key={review.id} review={review} />
      ))}
      {state.items.length === 0 && !state.hasMore && state.error === null ? (
        <ReviewState
          message="No Reviews are visible on this profile."
          title="No reviews yet"
        />
      ) : null}
      <div className="min-h-16" ref={sentinelRef}>
        {state.error === null ? null : (
          <ReviewState
            action="Retry"
            message={state.error}
            onAction={() => void state.retry()}
            title="Reviews unavailable"
          />
        )}
        {state.hasMore && state.error === null ? (
          <Button
            className="min-h-11 w-full"
            disabled={state.loadingMore}
            onClick={() => void state.loadMore()}
            type="button"
            variant="outline"
          >
            {state.loadingMore ? 'Loading more…' : 'Load more'}
          </Button>
        ) : null}
        {!state.hasMore && state.items.length > 0 && state.error === null ? (
          <p className="py-5 text-center text-sm text-muted-foreground">
            End of reviews.
          </p>
        ) : null}
      </div>
    </section>
  )
}

function ReviewState({
  title,
  message,
  action,
  onAction,
}: {
  title: string
  message: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-card/50 p-8 text-center" role={action ? 'alert' : undefined}>
      <h2 className="font-black">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      {action && onAction ? (
        <Button className="mt-4 min-h-11" onClick={onAction} type="button" variant="outline">
          {action}
        </Button>
      ) : null}
    </div>
  )
}
