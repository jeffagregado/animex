import { Button } from '#/components/ui/button'
import type { ProfilePageState as PageState } from './use-profile-pages'

interface ProfileStateProps {
  action: string | null
  message: string
  onAction: (() => void) | null
  title: string
}

/** Renders shared empty and error state for Profile tabs. */
export function ProfileState({
  action,
  message,
  onAction,
  title,
}: ProfileStateProps) {
  return (
    <div
      className="rounded-xl border border-white/10 bg-card/50 p-8 text-center"
      role={action ? 'alert' : undefined}
    >
      <h2 className="font-black">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      {action && onAction ? (
        <Button
          className="mt-4 min-h-11"
          onClick={onAction}
          type="button"
          variant="outline"
        >
          {action}
        </Button>
      ) : null}
    </div>
  )
}

interface ProfilePaginationProps<T> {
  endLabel: string
  errorTitle: string
  state: PageState<T>
}

/** Renders shared Profile tab retry, load-more, and terminal states. */
export function ProfilePagination<T>({
  endLabel,
  errorTitle,
  state,
}: ProfilePaginationProps<T>) {
  if (state.error !== null) {
    return (
      <ProfileState
        action="Retry"
        message={state.error}
        onAction={() => void state.retry()}
        title={errorTitle}
      />
    )
  }
  if (state.hasMore) {
    return (
      <Button
        className="min-h-11 w-full"
        disabled={state.loadingMore}
        onClick={() => void state.loadMore()}
        type="button"
        variant="outline"
      >
        {state.loadingMore ? 'Loading more…' : 'Load more'}
      </Button>
    )
  }
  if (state.items.length === 0) return null
  return (
    <p className="py-5 text-center text-sm text-muted-foreground">
      End of {endLabel}.
    </p>
  )
}
