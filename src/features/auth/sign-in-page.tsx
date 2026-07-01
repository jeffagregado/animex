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
import { normalizeAccountEmail } from './auth-validation'
import { PasswordField } from './password-field'
import { useRedirectSignedInAuthPage } from './use-auth-state'

export function SignInPage() {
  const [message, setMessage] = useState<string | null>(null)
  const authState = useRedirectSignedInAuthPage()
  const authMessage = authState.status === 'error' ? authState.message : null

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    const formData = readAuthFormData(event, setMessage)
    const email = normalizeAccountEmail(getFormValue(formData, 'email'))
    const password = getFormValue(formData, 'password')

    try {
      await assertAuthResponse(
        await authClient.signIn.email({
          email,
          password,
          callbackURL: getAuthCallbackUrl('/home'),
        }),
        'Invalid email or password.',
      )
      window.location.assign('/home')
    } catch (error) {
      setMessage(getAuthErrorMessage(error, 'Invalid email or password.'))
    }
  }

  return (
    <AuthPageShell eyebrow="Welcome back" subtitle={null} title="Sign in">
      <GoogleButton onClick={() => void sendGoogleSignIn()} />
      <Divider />
      <form className="auth-form" onSubmit={handleSubmit}>
        <AuthField autoComplete="email" icon={Mail} label="Account Email" name="email" type="email" />
        <PasswordField autoComplete="current-password" label="Password" name="password" />
        <a href="/auth/forgot-password" className="auth-inline-link">
          Forgot password?
        </a>
        <button className="auth-submit auth-submit-coral" type="submit">
          Sign in
        </button>
      </form>
      <AuthMessage message={message ?? authMessage} />
      <p className="auth-switch">
        New to AnimeX? <a href="/auth/sign-up">Create account</a>
      </p>
    </AuthPageShell>
  )
}
