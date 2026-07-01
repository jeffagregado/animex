import { useState } from 'react'

import { getAuthErrorMessage, postAuthEndpoint, readAuthFormData } from './auth-actions'
import {
  AuthField,
  AuthMessage,
  AuthPageShell,
  getFormValue,
} from './auth-page-shell'
import { normalizeAccountEmail } from './auth-validation'

export function VerifyEmailPage() {
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    const formData = readAuthFormData(event, setMessage)
    const email = normalizeAccountEmail(getFormValue(formData, 'email'))
    const otp = getFormValue(formData, 'otp').trim()

    try {
      await postAuthEndpoint('/email-otp/verify-email', { email, otp })
      window.location.assign('/auth/username')
    } catch (error) {
      setMessage(getAuthErrorMessage(error, 'Verification failed.'))
    }
  }

  return (
    <AuthPageShell eyebrow="One more step" title="Verify Email">
      <form className="auth-form" onSubmit={handleSubmit}>
        <AuthField autoComplete="email" label="Account Email" name="email" type="email" />
        <AuthField autoComplete="one-time-code" label="Verification Code" name="otp" type="text" />
        <button className="auth-submit auth-submit-teal" type="submit">
          Verify Email
        </button>
      </form>
      <AuthMessage message={message} />
    </AuthPageShell>
  )
}
