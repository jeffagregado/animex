import { useState } from 'react'
import { LogIn, LogOut } from 'lucide-react'

import { authClient } from '../../lib/auth-client'
import { assertAuthResponse } from '../auth/auth-actions'
import { isCompleteAuthState, useAuthState } from '../auth/use-auth-state'
import { headerActionItems } from './navigation'

type HeaderAuthView = 'loading' | 'signedOut' | 'pending' | 'complete' | 'error'

const getHeaderAuthView = (state: ReturnType<typeof useAuthState>): HeaderAuthView => {
  if (state.status === 'loading') {
    return 'loading'
  }
  if (state.status === 'error') {
    return 'error'
  }
  if (state.authState.status === 'signedOut') {
    return 'signedOut'
  }
  return isCompleteAuthState(state.authState) ? 'complete' : 'pending'
}

const isHeaderActionVisible = (label: string, view: HeaderAuthView): boolean => {
  if (label === 'Search') {
    return true
  }
  return view === 'complete'
}

export function HeaderAuthControls() {
  const authState = useAuthState()
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const view = getHeaderAuthView(authState)
  const visibleActions = headerActionItems.filter((item) => isHeaderActionVisible(item.label, view))

  const handleSignOut = async () => {
    try {
      await assertAuthResponse(await authClient.signOut(), 'Sign out failed.')
      window.location.assign('/home')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Sign out failed.'
      setSignOutError(message)
    }
  }

  const errorMessage = signOutError ?? (authState.status === 'error' ? authState.message : null)

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
      {view === 'loading' ? <span className="header-auth-placeholder" aria-hidden="true" /> : null}
      {view === 'error' || signOutError ? (
        <button className="header-auth-button" type="button" disabled title={errorMessage ?? 'Auth error'}>
          Auth error
        </button>
      ) : null}
      {view === 'signedOut' ? (
        <a className="header-auth-button" href="/auth/sign-in">
          <LogIn aria-hidden="true" className="size-4" />
          <span>Sign in</span>
        </a>
      ) : null}
      {view === 'complete' || view === 'pending' ? (
        <button className="header-auth-button" type="button" onClick={() => void handleSignOut()}>
          <LogOut aria-hidden="true" className="size-4" />
          <span>Sign out</span>
        </button>
      ) : null}
    </>
  )
}
