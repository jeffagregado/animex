import { useEffect, useState } from 'react'

import { AuthMessage, AuthPageShell } from './auth-page-shell'
import { readAuthSearchParam, resolveOAuthCallback } from './auth-flow'
import { navigateToAuthPath } from './auth-navigation'
import { type AuthState, readAuthState } from './profile-actions'

export const getOAuthRedirectPath = (state: AuthState): string | null => {
  const result = resolveOAuthCallback(state, null, null)
  return result.kind === 'redirect' ? result.path : null
}

export function OAuthCallbackPage() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const errorCode = readAuthSearchParam(window.location.search, 'error')
    const returnTo = readAuthSearchParam(window.location.search, 'returnTo')

    const applyResult = (result: ReturnType<typeof resolveOAuthCallback>) => {
      if (!active) return
      if (result.kind === 'redirect') {
        navigateToAuthPath(result.path)
        return
      }
      setMessage(result.message)
    }

    if (errorCode) {
      applyResult(resolveOAuthCallback({ status: 'signedOut' }, errorCode, returnTo))
      return () => {
        active = false
      }
    }

    void readAuthState()
      .then((state) => {
        applyResult(resolveOAuthCallback(state, null, returnTo))
      })
      .catch(() => {
        if (active) {
          setMessage('Google sign-in couldn’t continue. Try another sign-in method.')
        }
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <AuthPageShell eyebrow="Google sign-in" subtitle={null} title="Signing in">
      <AuthMessage message={message} />
    </AuthPageShell>
  )
}
