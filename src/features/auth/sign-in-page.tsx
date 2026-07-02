import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { Mail } from 'lucide-react'

import { AsyncButton } from '../../components/async-button'
import { authClient } from '../../lib/auth-client'
import { signInSchema } from '../../lib/auth-schemas'
import {
  assertAuthResponse,
  getAuthCallbackUrl,
  getAuthErrorMessage,
  sendGoogleSignIn,
} from './auth-actions'
import { parseAuthInput, submitAuthForm } from './auth-form'
import {
  AuthControlledField,
  AuthMessage,
  AuthPageShell,
  Divider,
  GoogleButton,
} from './auth-page-shell'
import { PasswordField } from './password-field'
import { useRedirectSignedInAuthPage } from './use-auth-state'

export function SignInPage() {
  const [message, setMessage] = useState<string | null>(null)
  const authState = useRedirectSignedInAuthPage()
  const authMessage = authState.status === 'error' ? authState.message : null

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      setMessage(null)
      const input = parseAuthInput(signInSchema, value, 'Invalid email or password.')
      if (!input.ok) {
        setMessage(input.message)
        return
      }

      try {
        await assertAuthResponse(
          await authClient.signIn.email({
            email: input.data.email,
            password: input.data.password,
            callbackURL: getAuthCallbackUrl('/home'),
          }),
          'Invalid email or password.',
        )
        window.location.assign('/home')
      } catch (error) {
        setMessage(getAuthErrorMessage(error, 'Invalid email or password.'))
      }
    },
  })

  return (
    <AuthPageShell eyebrow="Welcome back" subtitle={null} title="Sign in">
      <GoogleButton onClick={sendGoogleSignIn} />
      <Divider />
      <form className="auth-form" onSubmit={(event) => submitAuthForm(event, form.handleSubmit)}>
        <form.Field
          name="email"
          children={(field) => (
            <AuthControlledField
              autoComplete="email"
              icon={Mail}
              label="Account Email"
              name={field.name}
              type="email"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
            />
          )}
        />
        <form.Field
          name="password"
          children={(field) => (
            <PasswordField
              autoComplete="current-password"
              label="Password"
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
            />
          )}
        />
        <a href="/auth/forgot-password" className="auth-inline-link">
          Forgot password?
        </a>
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([canSubmit, isSubmitting]) => (
            <AsyncButton
              className="auth-submit auth-submit-coral"
              disabled={!canSubmit}
              isLoading={isSubmitting}
              type="submit"
            >
              Sign in
            </AsyncButton>
          )}
        />
      </form>
      <AuthMessage message={message ?? authMessage} />
      <p className="auth-switch">
        New to AnimeX? <a href="/auth/sign-up">Create account</a>
      </p>
    </AuthPageShell>
  )
}
