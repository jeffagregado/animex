import { createContext, useContext, type ReactNode } from 'react'

import { type ClientAuthState, useAuthState } from '../auth/use-auth-state'

const PublicAuthStateContext = createContext<ClientAuthState | null>(null)

type PublicAuthStateProviderProps = {
  children: ReactNode
}

/** Reads public auth state once for all public-page consumers. */
export function PublicAuthStateProvider({ children }: PublicAuthStateProviderProps) {
  const authState = useAuthState()

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
