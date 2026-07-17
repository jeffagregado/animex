import { ImageOffIcon } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import {
  useProfileAutoLoad,
  type ProfileFavorite,
  type ProfilePageState,
} from './use-profile-pages'

/** Renders one paginated Favorites tab. */
export function ProfileFavorites({
  state,
}: {
  state: ProfilePageState<ProfileFavorite>
}) {
  const sentinelRef = useProfileAutoLoad(state)
  if (state.initialLoading) {
    return (
      <section aria-label="Loading favorites" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <Skeleton className="aspect-2/3 rounded-xl" key={item} />
        ))}
      </section>
    )
  }
  return (
    <section aria-label="Profile favorites">
      {state.items.length === 0 && state.error === null ? (
        <ProfileFavoriteState
          message="No favorites are visible on this profile."
          title="No favorites yet"
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {state.items.map(({ anime }) => (
            <FavoritePoster anime={anime} compact={false} key={anime.anilistId} />
          ))}
        </div>
      )}
      <ProfileFavoritePagination state={state} sentinelRef={sentinelRef} />
    </section>
  )
}

/** Renders compact Favorites preview used by profile support rail. */
export function ProfileFavoritesPreview({
  favorites,
  username,
}: {
  favorites: ProfileFavorite['anime'][]
  username: string
}) {
  return (
    <section
      aria-labelledby="latest-favorites-heading"
      className="rounded-xl border border-white/10 bg-card/60 p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="latest-favorites-heading" className="font-black">
          Latest Favorites
        </h2>
        <a
          className="text-sm font-bold text-cyan-300 hover:underline"
          href={`/users/${username}?tab=favorites`}
        >
          See all
        </a>
      </div>
      {favorites.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No favorites yet.</p>
      ) : (
        <div className="mt-4 grid grid-cols-5 gap-2">
          {favorites.slice(0, 10).map((anime) => (
            <FavoritePoster anime={anime} compact key={anime.anilistId} />
          ))}
        </div>
      )}
    </section>
  )
}

function FavoritePoster({
  anime,
  compact,
}: {
  anime: ProfileFavorite['anime']
  compact?: boolean
}) {
  return (
    <a
      aria-label={anime.title}
      className="group block overflow-hidden rounded-lg border border-white/10 bg-muted outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      href={`/anime/${anime.anilistId}/${anime.slug}`}
    >
      {anime.coverImageUrl === null ? (
        <span className="grid aspect-2/3 place-items-center text-muted-foreground">
          <ImageOffIcon aria-hidden="true" className="size-5" />
        </span>
      ) : (
        <img
          alt={`${anime.title} cover`}
          className="aspect-2/3 size-full object-cover transition group-hover:scale-[1.03]"
          src={anime.coverImageUrl}
        />
      )}
      {compact ? null : (
        <span className="block line-clamp-2 min-h-12 p-2 text-sm font-bold">
          {anime.title}
        </span>
      )}
    </a>
  )
}

function ProfileFavoritePagination({
  state,
  sentinelRef,
}: {
  state: ProfilePageState<ProfileFavorite>
  sentinelRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div className="mt-5" ref={sentinelRef}>
      {state.error === null ? null : (
        <ProfileFavoriteState
          action="Retry"
          message={state.error}
          onAction={() => void state.retry()}
          title="Favorites unavailable"
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
          End of favorites.
        </p>
      ) : null}
    </div>
  )
}

function ProfileFavoriteState({
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
