import { useEffect, useRef, useState } from 'react'
import { revalidateLogic, useForm } from '@tanstack/react-form'

import { AsyncButton } from '../../components/async-button'
import { authClient } from '../../lib/auth-client'
import { usernameFormSchema } from '../../lib/auth-schemas'
import { assertAuthResponse } from './auth-actions'
import { focusFirstInvalidAuthField, getAuthFieldError, getAuthSchemaErrors, submitAuthForm } from './auth-form'
import { redirectForAuthError, requireAuthState } from './auth-guards'
import { AuthMessage, AuthPageShell } from './auth-page-shell'
import { checkUsername, completeAuthProfile, isUsernameUnavailableError } from './profile-actions'
import { UsernameField } from './username-field'

export function UsernamePage() {
  const [message, setMessage] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitErrors, setSubmitErrors] = useState<Readonly<Record<string, string>>>({})
  const [usernameServerError, setUsernameServerError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [ready, setReady] = useState(false)

  const form = useForm({
    defaultValues: {
      username: '',
    },
    validationLogic: revalidateLogic({ mode: 'blur', modeAfterSubmission: 'change' }),
    validators: { onDynamic: usernameFormSchema },
    onSubmit: async ({ value }) => {
      setMessage(null)
      setUsernameServerError(null)
      const input = usernameFormSchema.safeParse(value)
      if (!input.success) {
        return
      }

      try {
        const usernameCheck = await checkUsername(input.data.username)
        if (!usernameCheck.available) {
          setUsernameServerError(usernameCheck.message ?? 'Username is unavailable.')
          window.setTimeout(() => focusFirstInvalidAuthField(formRef.current, ['username']), 0)
          return
        }

        await completeAuthProfile(input.data.username)
        window.location.assign('/home')
      } catch (error) {
        if (isUsernameUnavailableError(error)) {
          setUsernameServerError('Username is already taken.')
          window.setTimeout(() => focusFirstInvalidAuthField(formRef.current, ['username']), 0)
          return
        }
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
          <form
            ref={formRef}
            className="auth-form"
            method="post"
            noValidate
            onSubmit={(event) => submitAuthForm(event, () => {
              setSubmitted(true)
              const errors = getAuthSchemaErrors(usernameFormSchema, form.state.values)
              setSubmitErrors(errors)
              if (Object.keys(errors).length > 0) {
                window.setTimeout(() => focusFirstInvalidAuthField(formRef.current, ['username']), 0)
                return
              }
              void form.handleSubmit()
            })}
          >
            <form.Field
              name="username"
              children={(field) => (
                <UsernameField
                  error={usernameServerError ?? (submitted ? submitErrors.username ?? null : getAuthFieldError(field.state.meta.errors as Array<string | { message?: string }>))}
                  label="Username"
                  onCheckError={setMessage}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(value) => {
                    setUsernameServerError(null)
                    field.handleChange(value)
                    if (submitted) setSubmitErrors(getAuthSchemaErrors(usernameFormSchema, { username: value }))
                  }}
                />
              )}
            />
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([, isSubmitting]) => (
                <AsyncButton
                  className="auth-submit auth-submit-teal"
                  disabled={isSubmitting}
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
