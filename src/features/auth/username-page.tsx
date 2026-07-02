import { useEffect, useState } from 'react'
import { useForm } from '@tanstack/react-form'

import { AsyncButton } from '../../components/async-button'
import { authClient } from '../../lib/auth-client'
import { usernameFormSchema } from '../../lib/auth-schemas'
import { assertAuthResponse } from './auth-actions'
import { parseAuthInput, submitAuthForm } from './auth-form'
import { redirectForAuthError, requireAuthState } from './auth-guards'
import { AuthMessage, AuthPageShell } from './auth-page-shell'
import { checkUsername, completeAuthProfile } from './profile-actions'
import { UsernameField } from './username-field'

export function UsernamePage() {
  const [message, setMessage] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [ready, setReady] = useState(false)

  const form = useForm({
    defaultValues: {
      username: '',
    },
    onSubmit: async ({ value }) => {
      setMessage(null)
      const input = parseAuthInput(usernameFormSchema, value, 'Username is invalid.')
      if (!input.ok) {
        setMessage(input.message)
        return
      }

      try {
        const usernameCheck = await checkUsername(input.data.username)
        if (!usernameCheck.available) {
          setMessage(usernameCheck.message ?? 'Username is unavailable.')
          return
        }

        await completeAuthProfile(input.data.username)
        window.location.assign('/home')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Profile completion failed.')
      }
    },
  })

  useEffect(() => {
    void requireAuthState('verified')
      .then((state) => {
        if (state.status === 'complete') {
          window.location.assign('/home')
          return
        }
        setEmail(state.email)
        setReady(true)
      })
      .catch((error: unknown) => {
        if (redirectForAuthError(error)) {
          return
        }
        setMessage(error instanceof Error ? error.message : 'Auth check failed.')
      })
  }, [])

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await assertAuthResponse(await authClient.signOut(), 'Sign out failed.')
      window.location.assign('/home')
    } catch (error) {
      setIsSigningOut(false)
      setMessage(error instanceof Error ? error.message : 'Sign out failed.')
    }
  }

  return (
    <AuthPageShell eyebrow="Complete profile" subtitle={null} title="Choose Username">
      {ready ? (
        <>
          {email ? <p className="auth-readonly">Signed in with {email}</p> : null}
          <form className="auth-form" onSubmit={(event) => submitAuthForm(event, form.handleSubmit)}>
            <form.Field
              name="username"
              children={(field) => (
                <UsernameField
                  label="Username"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={field.handleChange}
                />
              )}
            />
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <AsyncButton
                  className="auth-submit auth-submit-teal"
                  disabled={!canSubmit}
                  isLoading={isSubmitting}
                  type="submit"
                >
                  Continue
                </AsyncButton>
              )}
            />
            <AsyncButton
              className="auth-secondary-action"
              isLoading={isSigningOut}
              type="button"
              onClick={() => void handleSignOut()}
            >
              Sign out
            </AsyncButton>
          </form>
        </>
      ) : null}
      <AuthMessage message={message} />
    </AuthPageShell>
  )
}
