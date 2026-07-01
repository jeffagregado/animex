import { useEffect, useState } from 'react'

import { type AuthState, readAuthState } from './profile-actions'

export type ClientAuthState =
  | {
      status: 'loading'
    }
  | {
      status: 'ready'
      authState: AuthState
    }
  | {
      status: 'error'
      message: string
    }

export const isCompleteAuthState = (state: AuthState): boolean => {
  return state.status === 'complete'
}

const getAuthPageRedirect = (state: AuthState): string | null => {
  if (state.status === 'complete') {
    return '/home'
  }
  if (state.status === 'emailUnverified') {
    return '/auth/verify-email'
  }
  if (state.status === 'needsProfile') {
    return '/auth/username'
  }
  return null
}

export function useAuthState(): ClientAuthState {
  const [state, setState] = useState<ClientAuthState>({ status: 'loading' })

  useEffect(() => {
    let active = true

    void readAuthState()
      .then((authState) => {
        if (active) {
          setState({ status: 'ready', authState })
        }
      })
      .catch((error: unknown) => {
        if (active) {
          const message = error instanceof Error ? error.message : 'Auth state check failed.'
          setState({ status: 'error', message })
        }
      })

    return () => {
      active = false
    }
  }, [])

  return state
}

export function useRedirectSignedInAuthPage(): ClientAuthState {
  const state = useAuthState()

  useEffect(() => {
    if (state.status !== 'ready') {
      return
    }
    const redirectTo = getAuthPageRedirect(state.authState)
    if (redirectTo) {
      window.location.assign(redirectTo)
    }
  }, [state])

  return state
}
