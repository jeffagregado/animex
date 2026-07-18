import { createContext, useContext, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'

import { authStateQueryOptions } from '../auth/auth-state-query'
import type { ClientAuthState } from '../auth/use-auth-state'

const PublicAuthStateContext = createContext<ClientAuthState | null>(null)

type PublicAuthActions = {
  beginSignOut: () => void
  cancelSignOut: () => void
}

const PublicAuthActionsContext = createContext<PublicAuthActions | null>(null)

type PublicAuthStateProviderProps = {
  children: ReactNode
}

/** Reads public auth state once for all public-page consumers. */
export function PublicAuthStateProvider({ children }: PublicAuthStateProviderProps) {
  const query = useQuery(authStateQueryOptions())
  const [isSigningOut, setIsSigningOut] = useState(false)
  const authState: ClientAuthState = isSigningOut
    ? { status: 'ready', authState: { status: 'signedOut' } }
    : query.isPending
      ? { status: 'loading' }
      : query.isError
        ? {
            status: 'error',
            message: query.error instanceof Error
              ? query.error.message
              : 'AUTH_STATE_UNAVAILABLE',
          }
        : { status: 'ready', authState: query.data }
  const actions: PublicAuthActions = {
    beginSignOut: () => setIsSigningOut(true),
    cancelSignOut: () => setIsSigningOut(false),
  }

  return (
    <PublicAuthActionsContext.Provider value={actions}>
      <PublicAuthStateContext.Provider value={authState}>
        {children}
      </PublicAuthStateContext.Provider>
    </PublicAuthActionsContext.Provider>
  )
}

/** Returns auth state supplied by the public provider boundary. */
export const usePublicAuthState = (): ClientAuthState => {
  const authState = useContext(PublicAuthStateContext)
  if (authState === null) {
    throw new Error('Public auth state is required inside PublicAuthStateProvider.')
  }
  return authState
}

/** Controls temporary public auth transitions around session requests. */
export const usePublicAuthActions = (): PublicAuthActions => {
  const actions = useContext(PublicAuthActionsContext)
  if (actions === null) {
    throw new Error('Public auth actions are required inside PublicAuthStateProvider.')
  }
  return actions
}
