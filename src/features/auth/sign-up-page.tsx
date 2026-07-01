import { useState } from 'react'

import { authClient } from '../../lib/auth-client'
import {
  assertAuthResponse,
  getAuthErrorMessage,
  readAuthFormData,
  sendGoogleSignIn,
} from './auth-actions'
import {
  AuthField,
  AuthMessage,
  AuthPageShell,
  Divider,
  GoogleButton,
  getFormValue,
} from './auth-page-shell'
import { normalizeAccountEmail, validatePassword } from './auth-validation'

const PENDING_PROFILE_NAME = 'AnimeX User'

export function SignUpPage() {
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    const formData = readAuthFormData(event, setMessage)
    const email = normalizeAccountEmail(getFormValue(formData, 'email'))
    const password = getFormValue(formData, 'password')
    const confirmPassword = getFormValue(formData, 'confirmPassword')
    const passwordResult = validatePassword(password)

    if (!passwordResult.valid) {
      setMessage(passwordResult.message)
      return
    }
    if (password !== confirmPassword) {
      setMessage('Passwords must match.')
      return
    }

    try {
      await assertAuthResponse(
        await authClient.signUp.email({
          email,
          password,
          name: PENDING_PROFILE_NAME,
          callbackURL: '/auth/verify-email',
        }),
        'Create account failed.',
      )
      window.location.assign('/auth/verify-email')
    } catch (error) {
      setMessage(getAuthErrorMessage(error, 'Create account failed.'))
    }
  }

  return (
    <AuthPageShell eyebrow="Join AnimeX" title="Create Account">
      <GoogleButton onClick={() => void sendGoogleSignIn()} />
      <Divider />
      <form className="auth-form" onSubmit={handleSubmit}>
        <AuthField autoComplete="email" label="Account Email" name="email" type="email" />
        <AuthField autoComplete="new-password" label="Password" name="password" type="password" />
        <AuthField
          autoComplete="new-password"
          label="Confirm Password"
          name="confirmPassword"
          type="password"
        />
        <button className="auth-submit auth-submit-teal" type="submit">
          Create Account
        </button>
      </form>
      <AuthMessage message={message} />
      <p className="auth-switch">
        Already have an account? <a href="/auth/sign-in">Sign in</a>
      </p>
    </AuthPageShell>
  )
}
