import { useEffect } from 'react'
import { useConvexAuth } from 'convex/react'
import { Outlet, createFileRoute, useLocation } from '@tanstack/react-router'

import { usePublicAuthState } from '#/features/shell/public-auth-context'
import type { ClientAuthState } from '#/features/auth/use-auth-state'

export const Route = createFileRoute('/_public/_protected')({ component: ProtectedReviewLayout })

/** Gates private Review children before any private query or mutation hook mounts. */
function ProtectedReviewLayout() {
  const auth = usePublicAuthState()
  const convex = useConvexAuth()
  const location = useLocation()
  const returnTo = `${location.pathname}${location.searchStr}${location.hash}`
  const destination = getProtectedReviewDestination(auth, returnTo)

  useEffect(() => { if (destination) window.location.replace(destination) }, [destination])
  if (!canMountProtectedReviews(auth, convex.isAuthenticated)) {
    if (auth.status === 'error') return <GateState title="Authentication unavailable" message={auth.message} retry />
    if (auth.status === 'ready' && auth.authState.status === 'complete' && !convex.isLoading && !convex.isAuthenticated) return <GateState title="Authentication unavailable" message="Refresh the page or sign in again." retry />
    return <GateState title="Checking authentication…" message="Your Review editor will open after authentication is ready." />
  }
  return <Outlet />
}

function GateState({ title, message, retry = false }: { title: string; message: string; retry?: boolean }) {
  return <main className="mx-auto grid min-h-[55dvh] max-w-3xl place-items-center px-4 py-10 text-center"><div><h1 className="text-2xl font-black">{title}</h1><p className="mt-2 text-muted-foreground">{message}</p>{retry ? <button className="mt-5 min-h-11 rounded-lg border border-border px-5 font-bold" onClick={() => window.location.reload()} type="button">Refresh authentication</button> : null}</div></main>
}

/** Requires complete public auth plus synchronized Convex identity. */
export const canMountProtectedReviews = (auth: ClientAuthState, isConvexAuthenticated: boolean): boolean => auth.status === 'ready' && auth.authState.status === 'complete' && isConvexAuthenticated

/** Returns exact auth destination without losing intended protected route. */
export const getProtectedReviewDestination = (auth: ClientAuthState, returnTo: string): string | null => {
  if (auth.status !== 'ready') return null
  const encoded = encodeURIComponent(returnTo)
  if (auth.authState.status === 'signedOut') return '/home'
  if (auth.authState.status === 'emailUnverified') return `/auth/verify-email?returnTo=${encoded}`
  if (auth.authState.status === 'needsProfile') return `/auth/username?returnTo=${encoded}`
  return null
}
