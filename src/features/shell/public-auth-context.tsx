import { createContext, useContext, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'

import { authStateQueryOptions } from '../auth/auth-state-query'
import type { ClientAuthState } from '../auth/use-auth-state'

const PublicAuthStateContext = createContext<ClientAuthState | null>(null)

type PublicAuthStateProviderProps = {
  children: ReactNode
}

/** Reads public auth state once for all public-page consumers. */
export function PublicAuthStateProvider({ children }: PublicAuthStateProviderProps) {
  const query = useQuery(authStateQueryOptions())
  const authState: ClientAuthState = query.isPending
    ? { status: 'loading' }
    : query.isError
      ? {
          status: 'error',
          message: query.error instanceof Error
            ? query.error.message
            : 'AUTH_STATE_UNAVAILABLE',
        }
      : { status: 'ready', authState: query.data }

  return <PublicAuthStateContext.Provider value={authState}>{children}</PublicAuthStateContext.Provider>
}

/** Returns auth state supplied by the public provider boundary. */
export const usePublicAuthState = (): ClientAuthState => {
  const authState = useContext(PublicAuthStateContext)
  if (authState === null) {
    throw new Error('Public auth state is required inside PublicAuthStateProvider.')
  }
  return authState
}
