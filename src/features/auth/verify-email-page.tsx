import { useEffect, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { Mail, ShieldCheck } from 'lucide-react'

import {
  accountEmailSchema,
  emailChangeConfirmSchema,
  emailChangeRequestSchema,
  verifyEmailSchema,
} from '../../lib/auth-schemas'
import { getAuthErrorMessage, postAuthEndpoint } from './auth-actions'
import { parseAuthInput, submitAuthForm } from './auth-form'
import {
  AuthControlledField,
  AuthMessage,
  AuthPageShell,
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
  const [changingEmail, setChangingEmail] = useState(false)

  const verifyForm = useForm({
    defaultValues: {
      email: '',
      otp: '',
    },
    onSubmit: async ({ value }) => {
      setMessage(null)
      const input = parseAuthInput(verifyEmailSchema, value, 'Verification failed.')
      if (!input.ok) {
        setMessage(input.message)
        return
      }

      try {
        await postAuthEndpoint('/email-otp/verify-email', {
          email: input.data.email,
          otp: input.data.otp,
        })
        window.location.assign('/auth/username')
      } catch (error) {
        setMessage(getAuthErrorMessage(error, 'Verification failed.'))
      }
    },
  })

  const emailChangeForm = useForm({
    defaultValues: {
      newEmail: '',
      otp: '',
    },
    onSubmit: async () => undefined,
  })

  useEffect(() => {
    const queryEmail = readEmailQuery(window.location.search)
    if (queryEmail) {
      verifyForm.setFieldValue('email', queryEmail)
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
          verifyForm.setFieldValue('email', state.email)
        }
      })
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : 'Auth state check failed.')
      })
  }, [verifyForm])

  const handleResend = async () => {
    setMessage(null)
    const input = parseAuthInput(accountEmailSchema, verifyForm.state.values.email, 'Resend code failed.')
    if (!input.ok) {
      setMessage(input.message)
      return
    }

    try {
      await postAuthEndpoint('/email-otp/send-verification-otp', {
        email: input.data,
        type: 'email-verification',
      })
      setMessage('Verification code sent.')
    } catch (error) {
      setMessage(getAuthErrorMessage(error, 'Resend code failed.'))
    }
  }

  const handleRequestEmailChange = async () => {
    setMessage(null)
    const input = parseAuthInput(emailChangeRequestSchema, emailChangeForm.state.values, 'Email change request failed.')
    if (!input.ok) {
      setMessage(input.message)
      return
    }

    try {
      await postAuthEndpoint('/email-otp/request-email-change', { newEmail: input.data.newEmail })
      emailChangeForm.setFieldValue('newEmail', input.data.newEmail)
      setMessage('Enter the code sent to the new email.')
    } catch (error) {
      setMessage(getAuthErrorMessage(error, 'Email change request failed.'))
    }
  }

  const handleConfirmEmailChange = async () => {
    setMessage(null)
    const input = parseAuthInput(emailChangeConfirmSchema, emailChangeForm.state.values, 'Email change failed.')
    if (!input.ok) {
      setMessage(input.message)
      return
    }

    try {
      await postAuthEndpoint('/email-otp/change-email', {
        newEmail: input.data.newEmail,
        otp: input.data.otp,
      })
      verifyForm.setFieldValue('email', input.data.newEmail)
      emailChangeForm.setFieldValue('newEmail', '')
      emailChangeForm.setFieldValue('otp', '')
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
          <emailChangeForm.Field
            name="newEmail"
            children={(field) => (
              <AuthControlledField
                autoComplete="email"
                icon={Mail}
                label="New Account Email"
                name={field.name}
                type="email"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
          />
          <emailChangeForm.Field
            name="otp"
            children={(field) => (
              <AuthControlledField
                autoComplete="one-time-code"
                icon={ShieldCheck}
                label="New Email Code"
                name={field.name}
                type="text"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
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
        <form className="auth-form" onSubmit={(event) => submitAuthForm(event, verifyForm.handleSubmit)}>
          <verifyForm.Field
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
          <verifyForm.Field
            name="otp"
            children={(field) => (
              <AuthControlledField
                autoComplete="one-time-code"
                icon={ShieldCheck}
                label="Verification Code"
                name={field.name}
                type="text"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
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
