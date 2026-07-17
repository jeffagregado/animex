import { useRef, useState } from 'react'
import { useQuery } from 'convex/react'
import { makeFunctionReference } from 'convex/server'

import type { ProfileTab } from '../shared/profile-contracts'
import { EditProfileDialog } from './edit-profile-dialog'
import { ProfileActivity } from './profile-activity'
import {
  ProfileFavorites,
  ProfileFavoritesPreview,
} from './profile-favorites'
import {
  ProfileHeader,
  type ProfileHeaderData,
} from './profile-header'
import { ProfileReviews } from './profile-reviews'
import { ProfileStats } from './profile-stats'
import { useProfilePages } from './use-profile-pages'

interface FullProfile extends ProfileHeaderData {
  progress: {
    completed: number
    watching: number
    planned: number
    dropped: number
  }
  favorites: {
    anilistId: number
    slug: string
    title: string
    coverImageUrl: string | null
  }[]
}

export type ProfileResult =
  | {
      access: 'header'
      owner: boolean
      profile: ProfileHeaderData
    }
  | {
      access: 'full'
      owner: boolean
      profile: FullProfile
    }

const profileQuery = makeFunctionReference<
  'query',
  { username: string },
  ProfileResult
>('profiles:getByUsername')

const tabs: ProfileTab[] = ['activity', 'reviews', 'favorites']

/** Renders signed-in Profile identity, support rail, and selected content tab. */
export function ProfilePage({
  username,
  tab,
}: {
  username: string
  tab: ProfileTab
}) {
  const result = useQuery(profileQuery, { username })
  const editTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const openEditProfile = (trigger: HTMLButtonElement): void => {
    editTriggerRef.current = trigger
    setEditOpen(true)
  }

  if (result === undefined) return <ProfileLoading />
  if (result.access === 'header') {
    return (
      <main className="mx-auto min-h-[70dvh] w-full max-w-[1480px] px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pb-12">
        <ProfileHeader
          onEditProfile={openEditProfile}
          owner={result.owner}
          profile={result.profile}
        />
        {result.owner ? (
          <EditProfileDialog
            finalFocus={editTriggerRef.current}
            onOpenChange={setEditOpen}
            open={editOpen}
            profile={result.profile}
          />
        ) : null}
        <section className="mt-6 rounded-xl border border-cyan-300/25 bg-cyan-300/5 p-8 text-center">
          <h2 className="text-xl font-black">This profile is private</h2>
          <p className="mt-2 text-muted-foreground">
            Profile activity and lists are visible only to its owner.
          </p>
        </section>
      </main>
    )
  }
  return (
    <main className="mx-auto min-h-[70dvh] w-full max-w-[1480px] px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pb-12">
      <ProfileHeader
        onEditProfile={openEditProfile}
        owner={result.owner}
        profile={result.profile}
      />
      {result.owner ? (
        <EditProfileDialog
          finalFocus={editTriggerRef.current}
          onOpenChange={setEditOpen}
          open={editOpen}
          profile={result.profile}
        />
      ) : null}
      <ProfileTabs tab={tab} username={result.profile.username} />
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.8fr)]">
        <ProfileTabContent tab={tab} username={result.profile.username} />
        <aside className="grid gap-5">
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
    <nav aria-label="Profile sections" className="mt-5 border-b border-white/10">
      <ul className="flex gap-2 overflow-x-auto">
        {tabs.map((item) => (
          <li key={item}>
            <a
              aria-current={item === tab ? 'page' : undefined}
              className={`inline-flex min-h-12 items-center border-b-2 px-4 font-bold capitalize ${
                item === tab
                  ? 'border-cyan-300 text-cyan-300'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              href={`/users/${username}?tab=${item}`}
            >
              {item}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function ProfileLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading profile"
      className="mx-auto min-h-[70dvh] w-full max-w-[1480px] px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pb-12"
    >
      <div className="h-80 animate-pulse rounded-2xl bg-card/50 motion-reduce:animate-none" />
      <div className="mt-5 h-12 animate-pulse rounded-lg bg-card/40 motion-reduce:animate-none" />
    </main>
  )
}
