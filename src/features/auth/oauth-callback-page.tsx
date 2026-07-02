import { useEffect, useState } from 'react'

import { AuthMessage, AuthPageShell } from './auth-page-shell'
import { type AuthState, readAuthState } from './profile-actions'

export const getOAuthRedirectPath = (state: AuthState): string => {
  if (state.status === 'complete') {
    return '/home'
  }
  if (state.status === 'needsProfile') {
    return '/auth/username'
  }
  if (state.status === 'emailUnverified') {
    const emailQuery = state.email ? `?email=${encodeURIComponent(state.email)}` : ''
    return `/auth/verify-email${emailQuery}`
  }
  return '/auth/sign-in'
}

export function OAuthCallbackPage() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    void readAuthState()
      .then((state) => {
        if (active) {
          window.location.assign(getOAuthRedirectPath(state))
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'Google sign-in check failed.')
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
