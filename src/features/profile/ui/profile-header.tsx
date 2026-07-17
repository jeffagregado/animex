import { UserAvatar } from '#/components/user-avatar'
import { Button } from '#/components/ui/button'

export interface ProfileHeaderData {
  id: string
  username: string
  name: string
  bio: string
  avatarUrl: string | null
  bannerUrl: string | null
  profileVisibility: 'public' | 'private'
}

interface ProfileHeaderProps {
  profile: ProfileHeaderData
  owner: boolean
  onEditProfile: () => void
}

/** Renders profile cover identity and owner edit entry point. */
export function ProfileHeader({
  profile,
  owner,
  onEditProfile,
}: ProfileHeaderProps) {
  return (
    <header className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl shadow-black/30">
      <div className="absolute inset-0 bg-linear-to-br from-cyan-950 via-slate-950 to-coral-500/30" />
      {profile.bannerUrl === null ? null : (
        <img
          alt=""
          className="absolute inset-0 size-full object-cover"
          src={profile.bannerUrl}
        />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-slate-950 via-slate-950/45 to-transparent" />
      <div className="relative flex min-h-72 flex-col justify-end gap-5 p-5 sm:min-h-80 sm:flex-row sm:items-end sm:p-8">
        <div className="rounded-full border-2 border-cyan-300 bg-slate-950 p-1 shadow-xl [&>img]:size-24 [&>[role=img]]:size-24 sm:[&>img]:size-32 sm:[&>[role=img]]:size-32">
          <UserAvatar
            avatarUrl={profile.avatarUrl}
            displayName={profile.name}
            label={`${profile.name} avatar`}
            size="lg"
          />
        </div>
        <div className="min-w-0 flex-1 pb-1">
          <h1 className="truncate text-3xl font-black text-white sm:text-4xl">
            {profile.name}
          </h1>
          <p className="mt-1 text-slate-300">@{profile.username}</p>
          {profile.bio === '' ? null : (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">
              {profile.bio}
            </p>
          )}
        </div>
        {owner ? (
          <Button
            className="min-h-11 bg-coral-500 px-5 font-black text-white hover:bg-coral-400"
            onClick={onEditProfile}
            type="button"
          >
            Edit Profile
          </Button>
        ) : null}
      </div>
    </header>
  )
}
