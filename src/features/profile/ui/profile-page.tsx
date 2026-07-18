import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'

import type {
  ProfileHeaderData,
  ProfileTab,
} from '../shared/profile-contracts'
import { EditProfileDialog } from './edit-profile-dialog'
import { ProfileActivity } from './profile-activity'
import {
  ProfileFavorites,
  ProfileFavoritesPreview,
} from './profile-favorites'
import { ProfileHeader } from './profile-header'
import { profileQueryOptions, refreshProfileQuery } from './profile-route'
import { ProfileReviews } from './profile-reviews'
import { ProfileStats } from './profile-stats'
import { useProfilePages } from './use-profile-pages'

export type { ProfileResult } from '../shared/profile-contracts'

const tabs: ProfileTab[] = ['activity', 'reviews', 'favorites']

/** Renders signed-in Profile identity, support rail, and selected content tab. */
export function ProfilePage({
  username,
  tab,
}: {
  username: string
  tab: ProfileTab
}) {
  const queryClient = useQueryClient()
  const convexAuth = useConvexAuth()
  const query = useQuery(profileQueryOptions(username))
  const result = query.data
  const editTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const openEditProfile = (trigger: HTMLButtonElement): void => {
    editTriggerRef.current = trigger
    setEditOpen(true)
  }
  const onProfileChanged = async (): Promise<void> => {
    await refreshProfileQuery(queryClient, username)
  }

  if (query.isPending) return <ProfileLoading />
  if (query.isError) {
    return <ProfileReadError message={query.error.message} />
  }
  if (result === undefined) {
    throw new Error('PROFILE_QUERY_DATA_MISSING')
  }
  const canMutate = result.owner
    && convexAuth.isAuthenticated
    && !convexAuth.isLoading
  const mutationUnavailable = result.owner
    && !convexAuth.isLoading
    && !convexAuth.isAuthenticated
  if (result.access === 'header') {
    return (
      <main className="mx-auto min-h-[70dvh] min-w-0 w-full max-w-[1480px] px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pb-12">
        <ProfileIdentity
          canMutate={canMutate}
          editOpen={editOpen}
          finalFocus={editTriggerRef.current}
          mutationUnavailable={mutationUnavailable}
          onEditProfile={openEditProfile}
          onOpenChange={setEditOpen}
          onProfileChanged={onProfileChanged}
          profile={result.profile}
        />
        <section className="mt-6 min-w-0 rounded-xl border border-cyan-300/25 bg-cyan-300/5 p-8 text-center">
          <h2 className="text-xl font-black">This profile is private</h2>
          <p className="mt-2 text-muted-foreground">
            Profile activity and lists are visible only to its owner.
          </p>
        </section>
      </main>
    )
  }
  return (
    <main className="mx-auto min-h-[70dvh] min-w-0 w-full max-w-[1480px] px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pb-12">
      <ProfileIdentity
        canMutate={canMutate}
        editOpen={editOpen}
        finalFocus={editTriggerRef.current}
        mutationUnavailable={mutationUnavailable}
        onEditProfile={openEditProfile}
        onOpenChange={setEditOpen}
        onProfileChanged={onProfileChanged}
        profile={result.profile}
      />
      <ProfileTabs tab={tab} username={result.profile.username} />
      <div className="mt-6 grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.8fr)]">
        <div className="min-w-0">
          <ProfileTabContent tab={tab} username={result.profile.username} />
        </div>
        <aside className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
          <ProfileStats progress={result.profile.progress} />
          <ProfileFavoritesPreview
            favorites={result.profile.favorites}
            username={result.profile.username}
          />
        </aside>
      </div>
    </main>
  )
}

function ProfileIdentity({
  canMutate,
  editOpen,
  finalFocus,
  mutationUnavailable,
  onEditProfile,
  onOpenChange,
  onProfileChanged,
  profile,
}: {
  canMutate: boolean
  editOpen: boolean
  finalFocus: HTMLButtonElement | null
  mutationUnavailable: boolean
  onEditProfile: (trigger: HTMLButtonElement) => void
  onOpenChange: (open: boolean) => void
  onProfileChanged: () => Promise<void>
  profile: ProfileHeaderData
}) {
  return (
    <>
      <ProfileHeader
        onEditProfile={onEditProfile}
        owner={canMutate}
        profile={profile}
      />
      {canMutate ? (
        <EditProfileDialog
          finalFocus={finalFocus}
          onProfileChanged={onProfileChanged}
          onOpenChange={onOpenChange}
          open={editOpen}
          profile={profile}
        />
      ) : null}
      {mutationUnavailable ? <ProfileMutationUnavailable /> : null}
    </>
  )
}

function ProfileTabContent({
  username,
  tab,
}: {
  username: string
  tab: ProfileTab
}) {
  if (tab === 'reviews') return <ReviewsTab username={username} />
  if (tab === 'favorites') return <FavoritesTab username={username} />
  return <ActivityTab username={username} />
}

function ActivityTab({ username }: { username: string }) {
  const state = useProfilePages(username, 'activity', true)
  return <ProfileActivity state={state} />
}

function ReviewsTab({ username }: { username: string }) {
  const state = useProfilePages(username, 'reviews', true)
  return <ProfileReviews state={state} />
}

function FavoritesTab({ username }: { username: string }) {
  const state = useProfilePages(username, 'favorites', true)
  return <ProfileFavorites state={state} />
}

function ProfileTabs({
  username,
  tab,
}: {
  username: string
  tab: ProfileTab
}) {
  return (
    <nav aria-label="Profile sections" className="mt-5 min-w-0 border-b border-white/10">
      <ul className="flex min-w-0 gap-2 overflow-x-auto">
        {tabs.map((item) => (
          <li key={item}>
            <Link
              aria-current={item === tab ? 'page' : undefined}
              className={`inline-flex min-h-12 items-center border-b-2 px-4 font-bold capitalize ${
                item === tab
                  ? 'border-cyan-300 text-cyan-300'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              params={{ username }}
              resetScroll={false}
              search={{ tab: item === 'activity' ? undefined : item }}
              to="/users/$username"
            >
              {item}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function ProfileMutationUnavailable() {
  return (
    <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
      Profile changes are unavailable. Refresh the page or sign in again.
    </p>
  )
}

function ProfileReadError({ message }: { message: string }) {
  return (
    <main className="mx-auto min-h-[70dvh] w-full max-w-[1480px] px-4 py-10">
      <h1 className="text-2xl font-black">Profile unavailable</h1>
      <p className="mt-2 text-muted-foreground">{message}</p>
    </main>
  )
}

function ProfileLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading profile"
      className="mx-auto min-h-[70dvh] min-w-0 w-full max-w-[1480px] px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pb-12"
    >
      <div className="h-80 animate-pulse rounded-2xl bg-card/50 motion-reduce:animate-none" />
      <div className="mt-5 h-12 animate-pulse rounded-lg bg-card/40 motion-reduce:animate-none" />
    </main>
  )
}

interface ProfileErrorContent {
  title: string
  message: string
}

/** Maps Profile read failures to clear user-facing recovery copy. */
const getProfileErrorContent = (error: Error): ProfileErrorContent => {
  const cause = error.cause instanceof Error
    ? `${error.cause.name} ${error.cause.message}`
    : ''
  const details = `${error.name} ${error.message} ${cause}`
  if (details.includes('PROFILE_NOT_FOUND')) {
    return {
      title: 'Profile not found',
      message: 'This profile does not exist or is no longer available.',
    }
  }
  if (
    details.includes('Unauthenticated')
    || details.includes('UNAUTHENTICATED')
    || details.includes('PROFILE_NOT_AUTHORIZED')
  ) {
    return {
      title: 'Profile authentication required',
      message: 'Your Profile session is unavailable. Sign in again, then retry.',
    }
  }
  if (
    details.includes('ZodError')
    || details.includes('PROFILE_RESPONSE_INVALID')
  ) {
    return {
      title: 'Profile data unavailable',
      message: 'Profile data could not be verified. Retry the request.',
    }
  }
  return {
    title: 'Profile unavailable',
    message: 'The Profile service could not load this profile. Retry the request.',
  }
}

/** Contains child Profile loader failures without replacing the auth boundary. */
export function ProfileRouteError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  const content = getProfileErrorContent(error)
  return (
    <main className="mx-auto grid min-h-[55dvh] max-w-3xl place-items-center px-4 py-10 text-center">
      <section role="alert">
        <h1 className="text-2xl font-black">{content.title}</h1>
        <p className="mt-2 text-muted-foreground">{content.message}</p>
        <button
          className="mt-5 min-h-11 rounded-lg border border-border px-5 font-bold"
          onClick={reset}
          type="button"
        >
          Retry Profile
        </button>
      </section>
    </main>
  )
}
