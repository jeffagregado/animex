import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

import { resolveAuthReturnTo } from '#/features/auth/auth-return'
import type { AuthState } from '#/features/auth/auth-contracts'
import { authStateQueryOptions } from '#/features/auth/auth-state-query'

export const Route = createFileRoute('/_public/_profile')({
  beforeLoad: async ({ context, location }) => {
    await loadProfileRouteAuth(
      context.queryClient,
      `${location.pathname}${location.searchStr}${location.hash}`,
    )
  },
  component: () => <Outlet />,
  errorComponent: ProfileAuthError,
})

type AuthQueryClient = {
  ensureQueryData: (
    options: ReturnType<typeof authStateQueryOptions>,
  ) => Promise<AuthState>
}

/** Resolves server auth and redirects before any protected child renders. */
export const loadProfileRouteAuth = async (
  queryClient: AuthQueryClient,
  currentRelativePath: string,
): Promise<void> => {
  const authState = await queryClient.ensureQueryData(authStateQueryOptions())
  const destination = getProfileAuthDestination(authState, currentRelativePath)
  if (destination !== null) throw redirect({ href: destination })
}

/** Returns exact Profile auth destination after safe return-path validation. */
export const getProfileAuthDestination = (
  authState: AuthState,
  currentRelativePath: string,
): string | null => {
  const resolved = resolveAuthReturnTo(currentRelativePath)
  const returnTo = resolved.available ? resolved.path : '/home'
  const encoded = encodeURIComponent(returnTo)
  if (authState.status === 'signedOut') {
    return `/auth/sign-in?returnTo=${encoded}`
  }
  if (authState.status === 'emailUnverified') {
    return `/auth/verify-email?returnTo=${encoded}`
  }
  if (authState.status === 'needsProfile') {
    return `/auth/username?returnTo=${encoded}`
  }
  return null
}

/** Exposes actionable auth transport failures without treating them as signed out. */
function ProfileAuthError({ error }: { error: Error }) {
  return (
    <main className="mx-auto grid min-h-[55dvh] max-w-3xl place-items-center px-4 py-10 text-center">
      <div>
        <h1 className="text-2xl font-black">Authentication unavailable</h1>
        <p className="mt-2 text-muted-foreground">{error.message}</p>
        <button
          className="mt-5 min-h-11 rounded-lg border border-border px-5 font-bold"
          onClick={() => window.location.reload()}
          type="button"
        >
          Refresh authentication
        </button>
      </div>
    </main>
  )
}
