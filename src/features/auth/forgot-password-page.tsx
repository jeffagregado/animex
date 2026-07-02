import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { Mail } from 'lucide-react'

import { forgotPasswordSchema } from '../../lib/auth-schemas'
import { getAuthCallbackUrl, getAuthErrorMessage, postAuthEndpoint } from './auth-actions'
import { parseAuthInput, submitAuthForm } from './auth-form'
import {
  AuthControlledField,
  AuthMessage,
  AuthPageShell,
} from './auth-page-shell'
import { useRedirectSignedInAuthPage } from './use-auth-state'

export function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null)
  const authState = useRedirectSignedInAuthPage()
  const authMessage = authState.status === 'error' ? authState.message : null

  const form = useForm({
    defaultValues: {
      email: '',
    },
    onSubmit: async ({ value }) => {
      setMessage(null)
      const input = parseAuthInput(forgotPasswordSchema, value, 'If an account exists, reset instructions were sent.')
      if (!input.ok) {
        setMessage(input.message)
        return
      }

      try {
        await postAuthEndpoint('/request-password-reset', {
          email: input.data.email,
          redirectTo: getAuthCallbackUrl('/auth/reset-password'),
        })
        setMessage('If an account exists, reset instructions were sent.')
      } catch (error) {
        setMessage(getAuthErrorMessage(error, 'If an account exists, reset instructions were sent.'))
      }
    },
  })

  return (
    <AuthPageShell eyebrow="Account recovery" subtitle={null} title="Reset Password">
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
        <button className="auth-submit auth-submit-coral" type="submit">
          Send Reset Link
        </button>
      </form>
      <AuthMessage message={message ?? authMessage} />
      <p className="auth-switch">
        Remembered it? <a href="/auth/sign-in">Sign in</a>
      </p>
    </AuthPageShell>
  )
}
