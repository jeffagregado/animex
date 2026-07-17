import { Button } from '#/components/ui/button'
import type { FeedCard as FeedCardData } from '#/features/social/shared/social-contracts'
import { FeedCard } from '#/features/feed/feed-card'
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
      {state.items.length === 0 && state.error === null ? (
        <ActivityState
          message="Nothing visible on this profile yet."
          title="No activity yet"
        />
      ) : null}
      <div className="min-h-16" ref={sentinelRef}>
        {state.error === null ? null : (
          <ActivityState
            action="Retry"
            message={state.error}
            onAction={() => void state.retry()}
            title="Activity unavailable"
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
            End of activity.
          </p>
        ) : null}
      </div>
    </section>
  )
}

function ActivityState({
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
