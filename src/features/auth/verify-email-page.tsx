import { useEffect, useState } from 'react'
import { Mail, ShieldCheck } from 'lucide-react'

import { getAuthErrorMessage, postAuthEndpoint, readAuthFormData } from './auth-actions'
import {
  AuthControlledField,
  AuthField,
  AuthMessage,
  AuthPageShell,
  getFormValue,
} from './auth-page-shell'
import { normalizeAccountEmail } from './auth-validation'
import { readAuthState } from './profile-actions'

const readEmailQuery = (search: string): string => {
  const params = new URLSearchParams(search)
  const email = params.get('email')
  if (!email) {
    return ''
  }
  return normalizeAccountEmail(email)
}

export function VerifyEmailPage() {
  const [message, setMessage] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [changeOtp, setChangeOtp] = useState('')
  const [changingEmail, setChangingEmail] = useState(false)

  useEffect(() => {
    const queryEmail = readEmailQuery(window.location.search)
    if (queryEmail) {
      setEmail(queryEmail)
    }

    void readAuthState()
      .then((state) => {
        if (state.status === 'complete') {
          window.location.assign('/home')
          return
        }
        if (state.status === 'needsProfile') {
          window.location.assign('/auth/username')
          return
        }
        if (state.email) {
          setEmail(state.email)
        }
      })
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : 'Auth state check failed.')
      })
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    const formData = readAuthFormData(event, setMessage)
    const accountEmail = normalizeAccountEmail(getFormValue(formData, 'email'))
    const otp = getFormValue(formData, 'otp').trim()

    try {
      await postAuthEndpoint('/email-otp/verify-email', { email: accountEmail, otp })
      window.location.assign('/auth/username')
    } catch (error) {
      setMessage(getAuthErrorMessage(error, 'Verification failed.'))
    }
  }

  const handleResend = async () => {
    try {
      const accountEmail = normalizeAccountEmail(email)
      await postAuthEndpoint('/email-otp/send-verification-otp', {
        email: accountEmail,
        type: 'email-verification',
      })
      setMessage('Verification code sent.')
    } catch (error) {
      setMessage(getAuthErrorMessage(error, 'Resend code failed.'))
    }
  }

  const handleRequestEmailChange = async () => {
    try {
      const accountEmail = normalizeAccountEmail(newEmail)
      await postAuthEndpoint('/email-otp/request-email-change', { newEmail: accountEmail })
      setNewEmail(accountEmail)
      setMessage('Enter the code sent to the new email.')
    } catch (error) {
      setMessage(getAuthErrorMessage(error, 'Email change request failed.'))
    }
  }

  const handleConfirmEmailChange = async () => {
    try {
      const accountEmail = normalizeAccountEmail(newEmail)
      await postAuthEndpoint('/email-otp/change-email', {
        newEmail: accountEmail,
        otp: changeOtp.trim(),
      })
      setEmail(accountEmail)
      setNewEmail('')
      setChangeOtp('')
      setChangingEmail(false)
      setMessage('Account email changed. Enter the new verification code.')
    } catch (error) {
      setMessage(getAuthErrorMessage(error, 'Email change failed.'))
    }
  }

  return (
    <AuthPageShell
      eyebrow="One more step"
      subtitle="Enter the verification code we sent to your email to continue."
      title="Verify Email"
    >
      {changingEmail ? (
        <form className="auth-form" onSubmit={(event) => event.preventDefault()}>
          <AuthControlledField
            autoComplete="email"
            icon={Mail}
            label="New Account Email"
            name="newEmail"
            onChange={setNewEmail}
            type="email"
            value={newEmail}
          />
          <AuthControlledField
            autoComplete="one-time-code"
            icon={ShieldCheck}
            label="New Email Code"
            name="changeOtp"
            onChange={setChangeOtp}
            type="text"
            value={changeOtp}
          />
          <button className="auth-submit auth-submit-coral" type="button" onClick={() => void handleRequestEmailChange()}>
            Send code
          </button>
          <button className="auth-submit auth-submit-teal" type="button" onClick={() => void handleConfirmEmailChange()}>
            Confirm email
          </button>
          <button className="auth-secondary-action" type="button" onClick={() => setChangingEmail(false)}>
            Back to verification
          </button>
        </form>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          <AuthControlledField
            autoComplete="email"
            icon={Mail}
            label="Account Email"
            name="email"
            onChange={setEmail}
            type="email"
            value={email}
          />
          <AuthField
            autoComplete="one-time-code"
            icon={ShieldCheck}
            label="Verification Code"
            name="otp"
            type="text"
          />
          <button className="auth-submit auth-submit-teal" type="submit">
            Verify Email
          </button>
        </form>
      )}
      <AuthMessage message={message} />
      {!changingEmail ? (
        <div className="auth-actions-row">
          <span>Didn&apos;t receive the code?</span>
          <button className="auth-inline-button" type="button" onClick={() => void handleResend()}>
            Resend code
          </button>
          <span>Wrong email?</span>
          <button className="auth-inline-button auth-inline-link-coral" type="button" onClick={() => setChangingEmail(true)}>
            Go back
          </button>
        </div>
      ) : null}
    </AuthPageShell>
  )
}
