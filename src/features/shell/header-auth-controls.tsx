import { useEffect, useState } from 'react'
import { LogIn, LogOut } from 'lucide-react'

import { authClient } from '../../lib/auth-client'
import { assertAuthResponse } from '../auth/auth-actions'
import { type AuthState, readAuthState } from '../auth/profile-actions'
import { headerActionItems } from './navigation'

type HeaderAuthState =
  | {
      status: 'loading'
    }
  | {
      status: 'signedOut'
    }
  | {
      status: 'signedIn'
    }
  | {
      status: 'error'
      message: string
    }

const getHeaderAuthState = (state: AuthState): HeaderAuthState => {
  if (state.status === 'signedOut') {
    return { status: 'signedOut' }
  }
  return { status: 'signedIn' }
}

const isHeaderActionVisible = (label: string, state: HeaderAuthState): boolean => {
  if (label === 'Search') {
    return true
  }
  return state.status === 'signedIn'
}

export function HeaderAuthControls() {
  const [state, setState] = useState<HeaderAuthState>({ status: 'loading' })
  const visibleActions = headerActionItems.filter((item) => isHeaderActionVisible(item.label, state))

  useEffect(() => {
    let active = true

    void readAuthState()
      .then((authState) => {
        if (active) {
          setState(getHeaderAuthState(authState))
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

  const handleSignOut = async () => {
    try {
      await assertAuthResponse(await authClient.signOut(), 'Sign out failed.')
      window.location.assign('/home')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Sign out failed.'
      setState({ status: 'error', message })
    }
  }

  return (
    <>
      {visibleActions.map((item) => (
        <button
          className="icon-button"
          type="button"
          aria-label={item.label}
          data-header-action={item.label}
          key={item.label}
        >
          <item.icon aria-hidden="true" className="size-5" />
        </button>
      ))}
      {state.status === 'loading' ? <span className="header-auth-placeholder" aria-hidden="true" /> : null}
      {state.status === 'error' ? (
        <button className="header-auth-button" type="button" disabled title={state.message}>
          Auth error
        </button>
      ) : null}
      {state.status === 'signedOut' ? (
        <a className="header-auth-button" href="/auth/sign-in">
          <LogIn aria-hidden="true" className="size-4" />
          <span>Sign in</span>
        </a>
      ) : null}
      {state.status === 'signedIn' ? (
        <button className="header-auth-button" type="button" onClick={() => void handleSignOut()}>
          <LogOut aria-hidden="true" className="size-4" />
          <span>Sign out</span>
        </button>
      ) : null}
    </>
  )
}
