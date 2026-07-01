import { useEffect, useState } from 'react'

import { authClient } from '../../lib/auth-client'
import { assertAuthResponse } from './auth-actions'
import { redirectForAuthError, requireAuthState } from './auth-guards'
import { AuthMessage, AuthPageShell, getFormValue } from './auth-page-shell'
import { validateUsername } from './auth-validation'
import { checkUsername, completeAuthProfile } from './profile-actions'
import { UsernameField } from './username-field'

export function UsernamePage() {
  const [message, setMessage] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [usernameValue, setUsernameValue] = useState('')

  useEffect(() => {
    void requireAuthState('verified')
      .then((state) => {
        if (state.status === 'complete') {
          window.location.assign('/home')
          return
        }
        setEmail(state.email)
      })
      .catch((error: unknown) => {
        if (redirectForAuthError(error)) {
          return
        }
        setMessage(error instanceof Error ? error.message : 'Auth check failed.')
      })
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    const formData = new FormData(event.currentTarget)
    const username = getFormValue(formData, 'username').trim()
    const usernameResult = validateUsername(username)

    if (!usernameResult.valid) {
      setMessage(usernameResult.message)
      return
    }

    try {
      const usernameCheck = await checkUsername(username)
      if (!usernameCheck.available) {
        setMessage(usernameCheck.message ?? 'Username is unavailable.')
        return
      }

      await completeAuthProfile(username)
      window.location.assign('/home')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Profile completion failed.')
    }
  }

  const handleSignOut = async () => {
    try {
      await assertAuthResponse(await authClient.signOut(), 'Sign out failed.')
      window.location.assign('/home')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sign out failed.')
    }
  }

  return (
    <AuthPageShell eyebrow="Complete profile" subtitle={null} title="Choose Username">
      {email ? <p className="auth-readonly">Signed in with {email}</p> : null}
      <form className="auth-form" onSubmit={handleSubmit}>
        <UsernameField label="Username" value={usernameValue} onChange={setUsernameValue} />
        <button className="auth-submit auth-submit-teal" type="submit">
          Continue
        </button>
        <button className="auth-secondary-action" type="button" onClick={() => void handleSignOut()}>
          Sign out
        </button>
      </form>
      <AuthMessage message={message} />
    </AuthPageShell>
  )
}
