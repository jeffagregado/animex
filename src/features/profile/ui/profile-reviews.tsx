import { Skeleton } from '#/components/ui/skeleton'
import type { ReviewListItem } from '#/features/social/shared/social-contracts'
import { PublishedReviewCard } from '#/features/reviews/ui/published-review-card'
import { ProfilePagination, ProfileState } from './profile-page-state'
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
        <ProfileState
          action={null}
          message="No Reviews are visible on this profile."
          onAction={null}
          title="No reviews yet"
        />
      ) : null}
      <div className="min-h-16" ref={sentinelRef}>
        <ProfilePagination
          endLabel="reviews"
          errorTitle="Reviews unavailable"
          state={state}
        />
      </div>
    </section>
  )
}
