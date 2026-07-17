import { useEffect } from 'react'
import { useConvexAuth } from 'convex/react'
import { Outlet, createFileRoute, useLocation } from '@tanstack/react-router'

import { resolveAuthReturnTo } from '#/features/auth/auth-return'
import type { ClientAuthState } from '#/features/auth/use-auth-state'
import { usePublicAuthState } from '#/features/shell/public-auth-context'

export const Route = createFileRoute('/_public/_profile')({
  component: ProfileLayout,
})

/** Gates Profile children until both auth sources are ready. */
function ProfileLayout() {
  const auth = usePublicAuthState()
  const convex = useConvexAuth()
  const location = useLocation()
  const returnTo = `${location.pathname}${location.searchStr}${location.hash}`
  const destination = getProfileDestination(auth, returnTo)

  useEffect(() => {
    if (destination) window.location.replace(destination)
  }, [destination])

  if (!canMountProfile(auth, convex.isAuthenticated)) {
    if (auth.status === 'error') {
      return (
        <ProfileGate
          message={auth.message}
          retry
          title="Authentication unavailable"
        />
      )
    }
    if (
      auth.status === 'ready'
      && auth.authState.status === 'complete'
      && !convex.isLoading
      && !convex.isAuthenticated
    ) {
      return (
        <ProfileGate
          message="Refresh the page or sign in again."
          retry
          title="Authentication unavailable"
        />
      )
    }
    return (
      <ProfileGate
        message="Profile will open after authentication is ready."
        retry={false}
        title="Checking authentication…"
      />
    )
  }
  return <Outlet />
}

function ProfileGate({
  title,
  message,
  retry,
}: {
  title: string
  message: string
  retry?: boolean
}) {
  return (
    <main className="mx-auto grid min-h-[55dvh] max-w-3xl place-items-center px-4 py-10 text-center">
      <div>
        <h1 className="text-2xl font-black">{title}</h1>
        <p className="mt-2 text-muted-foreground">{message}</p>
        {retry ? (
          <button
            className="mt-5 min-h-11 rounded-lg border border-border px-5 font-bold"
            onClick={() => window.location.reload()}
            type="button"
          >
            Refresh authentication
          </button>
        ) : null}
      </div>
    </main>
  )
}

/** Requires complete public auth plus synchronized Convex identity. */
export const canMountProfile = (
  auth: ClientAuthState,
  isConvexAuthenticated: boolean,
): boolean => auth.status === 'ready'
  && auth.authState.status === 'complete'
  && isConvexAuthenticated

/** Returns exact Profile auth destination after safe return-path validation. */
export const getProfileDestination = (
  auth: ClientAuthState,
  currentRelativePath: string,
): string | null => {
  if (auth.status !== 'ready') return null
  const resolved = resolveAuthReturnTo(currentRelativePath)
  const returnTo = resolved.available ? resolved.path : '/home'
  const encoded = encodeURIComponent(returnTo)
  if (auth.authState.status === 'signedOut') {
    return `/auth/sign-in?returnTo=${encoded}`
  }
  if (auth.authState.status === 'emailUnverified') {
    return `/auth/verify-email?returnTo=${encoded}`
  }
  if (auth.authState.status === 'needsProfile') {
    return `/auth/username?returnTo=${encoded}`
  }
  return null
}
