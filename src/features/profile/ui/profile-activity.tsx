import type { FeedCard as FeedCardData } from '#/features/social/shared/social-contracts'
import { FeedCard } from '#/features/feed/feed-card'
import { ProfilePagination, ProfileState } from './profile-page-state'
import {
  useProfileAutoLoad,
  type ProfilePageState,
} from './use-profile-pages'

/** Renders viewer-safe Profile Activity without owner controls. */
export function ProfileActivity({
  state,
}: {
  state: ProfilePageState<FeedCardData>
}) {
  const sentinelRef = useProfileAutoLoad(state)
  if (state.initialLoading) {
    return (
      <section aria-busy="true" aria-label="Loading activity" className="space-y-3">
        {[1, 2, 3].map((item) => (
          <div className="h-44 animate-pulse rounded-xl bg-card/50 motion-reduce:animate-none" key={item} />
        ))}
      </section>
    )
  }
  return (
    <section aria-label="Profile activity" className="space-y-3">
      {state.items.map((card) => (
        <FeedCard
          card={card}
          key={card.id}
          onChanged={() => undefined}
          onEdit={() => undefined}
          owner={false}
        />
      ))}
      {state.items.length === 0 && !state.hasMore && state.error === null ? (
        <ProfileState
          action={null}
          message="Nothing visible on this profile yet."
          onAction={null}
          title="No activity yet"
        />
      ) : null}
      <div className="min-h-16" ref={sentinelRef}>
        <ProfilePagination
          endLabel="activity"
          errorTitle="Activity unavailable"
          state={state}
        />
      </div>
    </section>
  )
}
