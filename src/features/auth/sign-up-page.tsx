import { useState } from 'react'
import { Mail } from 'lucide-react'

import { authClient } from '../../lib/auth-client'
import {
  assertAuthResponse,
  getAuthCallbackUrl,
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
      const verifyEmailPath = getVerifyEmailPath(email)
      await assertAuthResponse(
        await authClient.signUp.email({
          email,
          password,
          name: PENDING_PROFILE_NAME,
          callbackURL: getAuthCallbackUrl(verifyEmailPath),
        }),
        'Create account failed.',
      )
      window.location.assign(verifyEmailPath)
    } catch (error) {
      setMessage(getAuthErrorMessage(error, 'Create account failed.'))
    }
  }

  return (
    <AuthPageShell eyebrow="Join AnimeX" subtitle={null} title="Create Account">
      <GoogleButton onClick={() => void sendGoogleSignIn()} />
      <Divider />
      <form className="auth-form" onSubmit={handleSubmit}>
        <AuthField autoComplete="email" icon={Mail} label="Account Email" name="email" type="email" />
        <PasswordField autoComplete="new-password" label="Password" name="password" />
        <PasswordField autoComplete="new-password" label="Confirm Password" name="confirmPassword" />
        <button className="auth-submit auth-submit-teal" type="submit">
          Create Account
        </button>
      </form>
      <AuthMessage message={message ?? authMessage} />
      <p className="auth-switch">
        Already have an account? <a href="/auth/sign-in">Sign in</a>
      </p>
    </AuthPageShell>
  )
}
