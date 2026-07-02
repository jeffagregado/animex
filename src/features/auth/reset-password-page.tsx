import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'

import { getAuthErrorMessage, postAuthEndpoint, readAuthFormData } from './auth-actions'
import { AuthMessage, AuthPageShell, getFormValue } from './auth-page-shell'
import { validatePassword } from './auth-validation'
import { PasswordField } from './password-field'
import { checkResetToken } from './profile-actions'

const RESET_SUCCESS_SECONDS = 5

const readResetToken = (): string | null => {
  const params = new URLSearchParams(window.location.search)
  const error = params.get('error')
  if (error) {
    return null
  }
  return params.get('token')
}

export function ResetPasswordPage() {
  const [message, setMessage] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [tokenReady, setTokenReady] = useState(false)
  const [success, setSuccess] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(RESET_SUCCESS_SECONDS)

  useEffect(() => {
    const nextToken = readResetToken()
    if (!nextToken) {
      setToken(null)
      setTokenReady(true)
      return
    }

    void checkResetToken(nextToken)
      .then((result) => {
        setToken(result.valid ? nextToken : null)
        setTokenReady(true)
      })
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : 'Reset token check failed.')
        setToken(null)
        setTokenReady(true)
      })
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    const formData = readAuthFormData(event, setMessage)
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
    if (!token) {
      setMessage('Reset link is invalid or expired. Request a new one.')
      return
    }

    try {
      await postAuthEndpoint('/reset-password', { token, newPassword: password })
      setSuccess(true)
      setSecondsRemaining(RESET_SUCCESS_SECONDS)
      const intervalId = window.setInterval(() => {
        setSecondsRemaining((current) => Math.max(current - 1, 0))
      }, 1000)
      window.setTimeout(() => {
        window.clearInterval(intervalId)
        window.location.assign('/auth/sign-in')
      }, RESET_SUCCESS_SECONDS * 1000)
    } catch (error) {
      setMessage(getAuthErrorMessage(error, 'Password reset failed.'))
    }
  }

  const resetMessage = message
    ?? (!tokenReady ? 'Checking reset link.' : null)
    ?? (!token ? 'Reset link is invalid or expired. Request a new one.' : null)

  return (
    <AuthPageShell eyebrow="Account recovery" subtitle={null} title={success ? 'Password reset.' : 'Set New Password'}>
      {success ? (
        <section className="auth-success-state" aria-label="Password reset success">
          <div className="auth-success-icon">
            <Check aria-hidden="true" className="size-12" />
          </div>
          <p className="auth-success-copy">Sign in with your new password</p>
          <p className="auth-message auth-message-success">
            Redirecting to sign in in {secondsRemaining} seconds...
          </p>
          <a className="auth-submit auth-submit-coral auth-link-button" href="/auth/sign-in">
            Sign in
          </a>
        </section>
      ) : null}
      {token && !success ? (
        <form className="auth-form" onSubmit={handleSubmit}>
          <PasswordField autoComplete="new-password" label="Password" name="password" />
          <PasswordField autoComplete="new-password" label="Confirm Password" name="confirmPassword" />
          <button className="auth-submit auth-submit-teal" type="submit">
            Set New Password
          </button>
        </form>
      ) : null}
      <AuthMessage message={resetMessage} />
      {!token && tokenReady && !success ? (
        <a className="auth-inline-link" href="/auth/forgot-password">
          Request a new reset link
        </a>
      ) : null}
    </AuthPageShell>
  )
}
