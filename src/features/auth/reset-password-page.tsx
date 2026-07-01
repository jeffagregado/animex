import { useEffect, useState } from 'react'

import { getAuthErrorMessage, postAuthEndpoint, readAuthFormData } from './auth-actions'
import { AuthField, AuthMessage, AuthPageShell, getFormValue } from './auth-page-shell'
import { validatePassword } from './auth-validation'
import { checkResetToken } from './profile-actions'

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
      setMessage('Reset link is invalid or expired.')
      return
    }

    try {
      await postAuthEndpoint('/reset-password', { token, newPassword: password })
      setSuccess(true)
      window.setTimeout(() => {
        window.location.assign('/auth/sign-in')
      }, 2500)
    } catch (error) {
      setMessage(getAuthErrorMessage(error, 'Password reset failed.'))
    }
  }

  const resetMessage = message
    ?? (success ? 'Password changed. Redirecting to sign in.' : null)
    ?? (!tokenReady ? 'Checking reset link.' : null)
    ?? (!token ? 'Reset link is invalid or expired.' : null)

  return (
    <AuthPageShell eyebrow="Account recovery" title="Set New Password">
      {token && !success ? (
        <form className="auth-form" onSubmit={handleSubmit}>
          <AuthField autoComplete="new-password" label="Password" name="password" type="password" />
          <AuthField
            autoComplete="new-password"
            label="Confirm Password"
            name="confirmPassword"
            type="password"
          />
          <button className="auth-submit auth-submit-teal" type="submit">
            Set New Password
          </button>
        </form>
      ) : null}
      <AuthMessage message={resetMessage} />
    </AuthPageShell>
  )
}
