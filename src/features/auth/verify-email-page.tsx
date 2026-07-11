import { useEffect, useRef, useState } from 'react'
import { revalidateLogic, useForm } from '@tanstack/react-form'
import { Mail, ShieldCheck } from 'lucide-react'

import { AsyncButton } from '../../components/async-button'
import {
  accountEmailSchema,
  emailChangeConfirmSchema,
  emailChangeRequestSchema,
  emailChangeSendSchema,
  verifyEmailSchema,
} from '../../lib/auth-schemas'
import { getAuthErrorMessage, getAuthFieldErrorMessage, postAuthEndpoint } from './auth-actions'
import { focusFirstInvalidAuthField, getAuthFieldError, getAuthSchemaErrors, parseAuthInput, submitAuthForm } from './auth-form'
import { navigateToAuthPath } from './auth-navigation'
import {
  AuthControlledField,
  AuthMessage,
  AuthPageShell,
} from './auth-page-shell'
import { readAuthState } from './profile-actions'

type VerifyPendingAction = 'resend' | 'requestEmail' | 'confirmEmail' | null
type EmailChangeIntent = 'request' | 'confirm'

export function VerifyEmailPage() {
  const [message, setMessage] = useState<string | null>(null)
  const [messageKind, setMessageKind] = useState<'error' | 'status'>('error')
  const [verifySubmitted, setVerifySubmitted] = useState(false)
  const [verifyReady, setVerifyReady] = useState(false)
  const [changeIntent, setChangeIntent] = useState<EmailChangeIntent>('confirm')
  const [verifyErrors, setVerifyErrors] = useState<Readonly<Record<string, string>>>({})
  const [changeErrors, setChangeErrors] = useState<Readonly<Record<string, string>>>({})
  const [otpServerError, setOtpServerError] = useState<string | null>(null)
  const [newEmailServerError, setNewEmailServerError] = useState<string | null>(null)
  const verifyFormRef = useRef<HTMLFormElement>(null)
  const changeFormRef = useRef<HTMLFormElement>(null)
  const [changingEmail, setChangingEmail] = useState(false)
  const [pendingAction, setPendingAction] = useState<VerifyPendingAction>(null)

  const verifyForm = useForm({
    defaultValues: {
      email: '',
      otp: '',
    },
    validationLogic: revalidateLogic({ mode: 'blur', modeAfterSubmission: 'change' }),
    validators: { onDynamic: verifyEmailSchema },
    onSubmit: async ({ value }) => {
      setMessage(null)
      setMessageKind('error')
      setOtpServerError(null)
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
        navigateToAuthPath('/auth/username')
      } catch (error) {
        const mappedError = getAuthFieldErrorMessage(error, 'otp')
        if (mappedError) {
          setOtpServerError(mappedError)
          window.setTimeout(() => focusFirstInvalidAuthField(verifyFormRef.current, ['otp']), 0)
          return
        }
        setMessage(getAuthErrorMessage(error, 'Verification failed.'))
      }
    },
  })

  const emailChangeForm = useForm({
    defaultValues: {
      newEmail: '',
      otp: '',
    },
    validationLogic: revalidateLogic({ mode: 'blur', modeAfterSubmission: 'change' }),
    validators: {
      onDynamic: changeIntent === 'request' ? emailChangeSendSchema : emailChangeConfirmSchema,
    },
    onSubmit: async () => undefined,
  })

  useEffect(() => {
    void readAuthState()
      .then((state) => {
        if (state.status === 'signedOut') {
          navigateToAuthPath('/auth/sign-in')
          return
        }
        if (state.status === 'complete') {
          navigateToAuthPath('/home')
          return
        }
        if (state.status === 'needsProfile') {
          navigateToAuthPath('/auth/username')
          return
        }
        if (state.status === 'emailUnverified') {
          verifyForm.setFieldValue('email', state.email)
          setVerifyErrors({})
          setVerifyReady(true)
        }
      })
      .catch((error: unknown) => {
        console.error('Verification auth state check failed.', error)
        setMessage('Verification status couldn’t be checked. Try again.')
      })
  }, [verifyForm])

  const handleResend = async () => {
    setMessage(null)
    setMessageKind('error')
    const input = parseAuthInput(accountEmailSchema, verifyForm.state.values.email, 'Resend code failed.')
    if (!input.ok) {
      setMessage(input.message)
      return
    }

    setPendingAction('resend')
    try {
      await postAuthEndpoint('/email-otp/send-verification-otp', {
        email: input.data,
        type: 'email-verification',
      })
      setMessageKind('status')
      setMessage('Verification code sent.')
    } catch (error) {
      setMessage(getAuthErrorMessage(error, 'Verification email couldn’t be sent. Try again.'))
    } finally {
      setPendingAction(null)
    }
  }

  const handleRequestEmailChange = async () => {
    setMessage(null)
    setMessageKind('error')
    setNewEmailServerError(null)
    setChangeIntent('request')
    window.setTimeout(() => void emailChangeForm.handleSubmit(), 0)
    const errors = getAuthSchemaErrors(emailChangeRequestSchema, emailChangeForm.state.values)
    setChangeErrors(errors)
    if (Object.keys(errors).length > 0) {
      window.setTimeout(() => focusFirstInvalidAuthField(changeFormRef.current, ['newEmail']), 0)
      return
    }
    const input = parseAuthInput(emailChangeRequestSchema, emailChangeForm.state.values, 'Email change request failed.')
    if (!input.ok) {
      setMessage(input.message)
      return
    }

    setPendingAction('requestEmail')
    try {
      await postAuthEndpoint('/email-otp/request-email-change', { newEmail: input.data.newEmail })
      emailChangeForm.setFieldValue('newEmail', input.data.newEmail)
      setMessageKind('status')
      setMessage('Enter the code sent to the new email.')
    } catch (error) {
      const mappedError = getAuthFieldErrorMessage(error, 'newEmail')
      if (mappedError) {
        setNewEmailServerError(mappedError)
        window.setTimeout(() => focusFirstInvalidAuthField(changeFormRef.current, ['newEmail']), 0)
        return
      }
      setMessage(getAuthErrorMessage(error, 'Verification email couldn’t be sent. Try again.'))
    } finally {
      setPendingAction(null)
    }
  }

  const handleConfirmEmailChange = async () => {
    setMessage(null)
    setMessageKind('error')
    setNewEmailServerError(null)
    setOtpServerError(null)
    setChangeIntent('confirm')
    window.setTimeout(() => void emailChangeForm.handleSubmit(), 0)
    const errors = getAuthSchemaErrors(emailChangeConfirmSchema, emailChangeForm.state.values)
    setChangeErrors(errors)
    if (Object.keys(errors).length > 0) {
      window.setTimeout(() => focusFirstInvalidAuthField(changeFormRef.current, ['newEmail', 'otp']), 0)
      return
    }
    const input = parseAuthInput(emailChangeConfirmSchema, emailChangeForm.state.values, 'Email change failed.')
    if (!input.ok) {
      setMessage(input.message)
      return
    }

    setPendingAction('confirmEmail')
    try {
      await postAuthEndpoint('/email-otp/change-email', {
        newEmail: input.data.newEmail,
        otp: input.data.otp,
      })
      navigateToAuthPath('/auth/username')
    } catch (error) {
      const emailError = getAuthFieldErrorMessage(error, 'newEmail')
      const otpError = getAuthFieldErrorMessage(error, 'otp')
      if (emailError || otpError) {
        setNewEmailServerError(emailError)
        setOtpServerError(otpError)
        window.setTimeout(() => focusFirstInvalidAuthField(changeFormRef.current, ['newEmail', 'otp']), 0)
        return
      }
      setMessage(getAuthErrorMessage(error, 'Email change failed.'))
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <AuthPageShell
      eyebrow="One more step"
      subtitle="Enter the verification code we sent to your email to continue."
      title="Verify Email"
    >
      {changingEmail ? (
        <form ref={changeFormRef} className="auth-form" method="post" noValidate onSubmit={(event) => event.preventDefault()}>
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
                error={newEmailServerError ?? changeErrors.newEmail ?? getAuthFieldError(field.state.meta.errors)}
                onBlur={field.handleBlur}
                onChange={(value) => {
                  setNewEmailServerError(null)
                  field.handleChange(value)
                  const schema = changeIntent === 'request' ? emailChangeRequestSchema : emailChangeConfirmSchema
                  setChangeErrors(getAuthSchemaErrors(schema, { ...emailChangeForm.state.values, newEmail: value }))
                }}
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
                error={otpServerError ?? changeErrors.otp ?? (changeIntent === 'confirm' ? getAuthFieldError(field.state.meta.errors) : null)}
                onBlur={field.handleBlur}
                onChange={(value) => {
                  setOtpServerError(null)
                  field.handleChange(value)
                  if (changeIntent === 'confirm') {
                    setChangeErrors(getAuthSchemaErrors(emailChangeConfirmSchema, { ...emailChangeForm.state.values, otp: value }))
                  }
                }}
              />
            )}
          />
          <AsyncButton
            className="auth-submit auth-submit-coral"
            isLoading={pendingAction === 'requestEmail'}
            type="button"
            onClick={() => void handleRequestEmailChange()}
          >
            Send code
          </AsyncButton>
          <AsyncButton
            className="auth-submit auth-submit-teal"
            isLoading={pendingAction === 'confirmEmail'}
            type="button"
            onClick={() => void handleConfirmEmailChange()}
          >
            Confirm email
          </AsyncButton>
          <button className="auth-secondary-action" type="button" onClick={() => setChangingEmail(false)}>
            Back to verification
          </button>
        </form>
      ) : (
        <form
          ref={verifyFormRef}
          className="auth-form"
          method="post"
          noValidate
          onSubmit={(event) => submitAuthForm(event, () => {
            setVerifySubmitted(true)
            const errors = getAuthSchemaErrors(verifyEmailSchema, verifyForm.state.values)
            setVerifyErrors(errors)
            if (Object.keys(errors).length > 0) {
              window.setTimeout(() => focusFirstInvalidAuthField(verifyFormRef.current, ['otp']), 0)
              return
            }
            void verifyForm.handleSubmit()
          })}
        >
          <verifyForm.Field
            name="email"
            children={(field) => (
              <AuthControlledField
                autoComplete="email"
                icon={Mail}
                label="Account Email"
                name={field.name}
                readOnly
                type="email"
                value={field.state.value}
                error={verifySubmitted ? verifyErrors.email ?? null : getAuthFieldError(field.state.meta.errors as Array<string | { message?: string }>)}
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
                error={otpServerError ?? (verifySubmitted ? verifyErrors.otp ?? null : getAuthFieldError(field.state.meta.errors as Array<string | { message?: string }>))}
                onBlur={field.handleBlur}
                onChange={(value) => {
                  setOtpServerError(null)
                  field.handleChange(value)
                  if (verifySubmitted) setVerifyErrors(getAuthSchemaErrors(verifyEmailSchema, { ...verifyForm.state.values, otp: value }))
                }}
              />
            )}
          />
          <verifyForm.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
            children={([, isSubmitting]) => (
              <AsyncButton
                className="auth-submit auth-submit-teal"
                disabled={isSubmitting || !verifyReady}
                isLoading={isSubmitting}
                type="submit"
              >
                Verify Email
              </AsyncButton>
            )}
          />
        </form>
      )}
      <AuthMessage kind={messageKind} message={message} />
      {!changingEmail ? (
        <div className="auth-actions-row">
          <span>Didn&apos;t receive the code?</span>
          <AsyncButton
            className="auth-inline-button"
            isLoading={pendingAction === 'resend'}
            type="button"
            onClick={() => void handleResend()}
          >
            Resend code
          </AsyncButton>
          <span>Wrong email?</span>
          <button className="auth-inline-button auth-inline-link-coral" type="button" onClick={() => setChangingEmail(true)}>
            Go back
          </button>
        </div>
      ) : null}
    </AuthPageShell>
  )
}
