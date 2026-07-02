import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { Mail } from 'lucide-react'

import { AsyncButton } from '../../components/async-button'
import { authClient } from '../../lib/auth-client'
import { signUpSchema } from '../../lib/auth-schemas'
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

const PENDING_PROFILE_NAME = 'AnimeX User'

const getVerifyEmailPath = (email: string): string => {
  const params = new URLSearchParams({ email })
  return `/auth/verify-email?${params.toString()}`
}

export function SignUpPage() {
  const [message, setMessage] = useState<string | null>(null)
  const authState = useRedirectSignedInAuthPage()
  const authMessage = authState.status === 'error' ? authState.message : null

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
    onSubmit: async ({ value }) => {
      setMessage(null)
      const input = parseAuthInput(signUpSchema, value, 'Create account failed.')
      if (!input.ok) {
        setMessage(input.message)
        return
      }

      try {
        const verifyEmailPath = getVerifyEmailPath(input.data.email)
        await assertAuthResponse(
          await authClient.signUp.email({
            email: input.data.email,
            password: input.data.password,
            name: PENDING_PROFILE_NAME,
            callbackURL: getAuthCallbackUrl(verifyEmailPath),
          }),
          'Create account failed.',
        )
        window.location.assign(verifyEmailPath)
      } catch (error) {
        setMessage(getAuthErrorMessage(error, 'Create account failed.'))
      }
    },
  })

  return (
    <AuthPageShell eyebrow="Join AnimeX" subtitle={null} title="Create Account">
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
              autoComplete="new-password"
              label="Password"
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
            />
          )}
        />
        <form.Field
          name="confirmPassword"
          children={(field) => (
            <PasswordField
              autoComplete="new-password"
              label="Confirm Password"
              name={field.name}
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
              Create Account
            </AsyncButton>
          )}
        />
      </form>
      <AuthMessage message={message ?? authMessage} />
      <p className="auth-switch">
        Already have an account? <a href="/auth/sign-in">Sign in</a>
      </p>
    </AuthPageShell>
  )
}
