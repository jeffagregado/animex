import { useState } from 'react'

import { getAuthErrorMessage, postAuthEndpoint, readAuthFormData } from './auth-actions'
import {
  AuthField,
  AuthMessage,
  AuthPageShell,
  getFormValue,
} from './auth-page-shell'
import { normalizeAccountEmail } from './auth-validation'

export function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    const formData = readAuthFormData(event, setMessage)
    const email = normalizeAccountEmail(getFormValue(formData, 'email'))

    try {
      await postAuthEndpoint('/request-password-reset', {
        email,
        redirectTo: '/auth/reset-password',
      })
      setMessage('If an account exists, reset instructions were sent.')
    } catch (error) {
      setMessage(getAuthErrorMessage(error, 'If an account exists, reset instructions were sent.'))
    }
  }

  return (
    <AuthPageShell eyebrow="Account recovery" title="Reset Password">
      <form className="auth-form" onSubmit={handleSubmit}>
        <AuthField autoComplete="email" label="Account Email" name="email" type="email" />
        <button className="auth-submit auth-submit-coral" type="submit">
          Send Reset Link
        </button>
      </form>
      <AuthMessage message={message} />
      <p className="auth-switch">
        Remembered it? <a href="/auth/sign-in">Sign in</a>
      </p>
    </AuthPageShell>
  )
}
