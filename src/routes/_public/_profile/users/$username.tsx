import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import { ProfilePage } from '#/features/profile/ui/profile-page'
import { profileQueryOptions } from '#/features/profile/ui/profile-route'
import { profileTabSchema } from '#/features/profile/shared/profile-contracts'

interface ProfileNavigationOptions {
  replace: true
  resetScroll: false
  search: { tab: 'activity' }
}

interface ProfileRouteContentProps {
  username: string
  rawTab: unknown
  navigate: (options: ProfileNavigationOptions) => void
}

export const Route = createFileRoute('/_public/_profile/users/$username')({
  validateSearch: (search: Record<string, unknown>) => ({ tab: search.tab }),
  loader: async ({ context, params }) => await context.queryClient
    .ensureQueryData(profileQueryOptions(params.username)),
  component: ProfileRoute,
})

function ProfileRoute() {
  const { username } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <ProfileRouteContent
      navigate={(options) => {
        void navigate(options)
      }}
      rawTab={search.tab}
      username={username}
    />
  )
}

/** Replaces invalid tab state before mounting Profile query hooks. */
export function ProfileRouteContent({
  username,
  rawTab,
  navigate,
}: ProfileRouteContentProps) {
  const result = rawTab === undefined
    ? profileTabSchema.safeParse('activity')
    : profileTabSchema.safeParse(rawTab)

  useEffect(() => {
    if (result.success) return
    navigate({
      replace: true,
      resetScroll: false,
      search: { tab: 'activity' },
    })
  }, [navigate, result.success])

  if (!result.success) {
    return (
      <main
        aria-label="Correcting profile tab"
        className="mx-auto min-h-[55dvh] max-w-3xl px-4 py-10"
      />
    )
  }
  return <ProfilePage tab={result.data} username={username} />
}
