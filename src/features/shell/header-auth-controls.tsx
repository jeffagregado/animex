import { useState } from 'react'
import { LogIn, LogOut } from 'lucide-react'
import { Link } from '@tanstack/react-router'

import { AsyncButton } from '../../components/async-button'
import { authClient } from '../../lib/auth-client'
import { assertAuthResponse } from '../auth/auth-actions'
import { isCompleteAuthState } from '../auth/use-auth-state'
import { headerActionItems } from './navigation'
import { usePublicAuthState } from './public-auth-context'

type HeaderAuthView = 'loading' | 'signedOut' | 'pending' | 'complete' | 'error'

const getHeaderAuthView = (state: ReturnType<typeof usePublicAuthState>): HeaderAuthView => {
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

const isHeaderActionVisible = (label: string): boolean => {
  return label === 'Search'
}

export function HeaderAuthControls() {
  const authState = usePublicAuthState()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const view = getHeaderAuthView(authState)
  const visibleActions = headerActionItems.filter((item) => isHeaderActionVisible(item.label))

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await assertAuthResponse(await authClient.signOut(), 'Sign out failed.')
      window.location.assign('/home')
    } catch (error: unknown) {
      setIsSigningOut(false)
      const message = error instanceof Error ? error.message : 'Sign out failed.'
      setSignOutError(message)
    }
  }

  const errorMessage = signOutError ?? (authState.status === 'error' ? authState.message : null)

  return (
    <>
      {visibleActions.map((item) => (
        <Link
          className="icon-button"
          to={item.href}
          hash={item.hash}
          aria-label={item.label}
          data-header-action={item.label}
          key={item.label}
        >
          <item.icon aria-hidden="true" className="size-5" />
        </Link>
      ))}
      {view === 'loading' ? (
        <span className="header-auth-skeleton" data-testid="header-auth-skeleton" aria-hidden="true" />
      ) : null}
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
        <AsyncButton
          className="header-auth-button"
          isLoading={isSigningOut}
          type="button"
          onClick={() => void handleSignOut()}
        >
          <LogOut aria-hidden="true" className="size-4" />
          <span>Sign out</span>
        </AsyncButton>
      ) : null}
    </>
  )
}
