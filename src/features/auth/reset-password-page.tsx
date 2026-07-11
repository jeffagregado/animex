import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { revalidateLogic, useForm } from '@tanstack/react-form'
import { Check } from 'lucide-react'

import { AsyncButton } from '../../components/async-button'
import { resetPasswordSchema } from '../../lib/auth-schemas'
import { getAuthErrorMessage, postAuthEndpoint } from './auth-actions'
import {
  focusFirstInvalidAuthField,
  getAuthFieldError,
  getAuthSchemaErrors,
  submitAuthForm,
} from './auth-form'
import { AuthMessage, AuthPageShell } from './auth-page-shell'
import { PasswordField } from './password-field'

const RESET_SUCCESS_SECONDS = 5

type ResetFormOptions = {
  setMessage: (message: string | null) => void
  setSecondsRemaining: Dispatch<SetStateAction<number>>
  setSuccess: (success: boolean) => void
  token: string | null
}

type ResetPasswordPageProps = {
  token: string | null
}

const startResetSuccessTimer = (
  setSecondsRemaining: Dispatch<SetStateAction<number>>,
): void => {
  setSecondsRemaining(RESET_SUCCESS_SECONDS)
  const intervalId = window.setInterval(() => {
    setSecondsRemaining((current) => Math.max(current - 1, 0))
  }, 1000)
  window.setTimeout(() => {
    window.clearInterval(intervalId)
    window.location.assign('/auth/sign-in')
  }, RESET_SUCCESS_SECONDS * 1000)
}

const useResetPasswordForm = ({
  setMessage,
  setSecondsRemaining,
  setSuccess,
  token,
}: ResetFormOptions) => {
  return useForm({
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
    validationLogic: revalidateLogic({ mode: 'blur', modeAfterSubmission: 'change' }),
    validators: {
      onDynamic: resetPasswordSchema,
    },
    onSubmit: async ({ value }) => {
      setMessage(null)
      const input = resetPasswordSchema.safeParse(value)
      if (!input.success) {
        setMessage(input.error.issues[0]?.message ?? 'Password reset failed.')
        return
      }
      if (!token) {
        setMessage('Reset link is invalid or expired. Request a new one.')
        return
      }

      try {
        await postAuthEndpoint('/reset-password', { token, newPassword: input.data.password })
        setSuccess(true)
        startResetSuccessTimer(setSecondsRemaining)
      } catch (error) {
        setMessage(getAuthErrorMessage(error, 'Password reset failed.'))
      }
    },
  })
}

export function ResetPasswordPage({ token }: ResetPasswordPageProps) {
  const [message, setMessage] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitErrors, setSubmitErrors] = useState<Readonly<Record<string, string>>>({})
  const [success, setSuccess] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(RESET_SUCCESS_SECONDS)
  const formRef = useRef<HTMLFormElement>(null)

  const form = useResetPasswordForm({
    setMessage,
    setSecondsRemaining,
    setSuccess,
    token,
  })

  const resetMessage = message
    ?? (!token ? 'Reset link is invalid or expired. Request a new one.' : null)

  return (
    <AuthPageShell eyebrow="Account recovery" subtitle={null} title={success ? 'Password reset.' : 'Set New Password'}>
      {success ? (
        <section className="auth-success-state" aria-label="Password reset success" role="status">
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
        <form
          ref={formRef}
          className="auth-form"
          method="post"
          noValidate
          onSubmit={(event) => submitAuthForm(event, () => {
            setSubmitted(true)
            const errors = getAuthSchemaErrors(resetPasswordSchema, form.state.values)
            setSubmitErrors(errors)
            if (Object.keys(errors).length > 0) {
              window.setTimeout(() => focusFirstInvalidAuthField(formRef.current, ['password', 'confirmPassword']), 0)
              return
            }
            void form.handleSubmit()
          })}
        >
          <form.Field
            name="password"
            children={(field) => (
              <PasswordField
                autoComplete="new-password"
                label="Password"
                name={field.name}
                value={field.state.value}
                error={submitted ? submitErrors.password ?? null : getAuthFieldError(field.state.meta.errors)}
                onBlur={field.handleBlur}
                onChange={(value) => {
                  field.handleChange(value)
                  if (submitted) setSubmitErrors(getAuthSchemaErrors(resetPasswordSchema, { ...form.state.values, password: value }))
                }}
              />
            )}
          />
          <form.Field
            name="confirmPassword"
            children={(field) => (
              <PasswordField
                autoComplete="new-password"
                label="Confirm Password"
                name={field.name}
                value={field.state.value}
                error={submitted ? submitErrors.confirmPassword ?? null : getAuthFieldError(field.state.meta.errors)}
                onBlur={field.handleBlur}
                onChange={(value) => {
                  field.handleChange(value)
                  if (submitted) setSubmitErrors(getAuthSchemaErrors(resetPasswordSchema, { ...form.state.values, confirmPassword: value }))
                }}
              />
            )}
          />
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
            children={([, isSubmitting]) => (
              <AsyncButton
                className="auth-submit auth-submit-teal"
                disabled={isSubmitting}
                isLoading={isSubmitting}
                type="submit"
              >
                Set New Password
              </AsyncButton>
            )}
          />
        </form>
      ) : null}
      <AuthMessage message={resetMessage} />
      {!token && !success ? (
        <a className="auth-inline-link" href="/auth/forgot-password">
          Request a new reset link
        </a>
      ) : null}
    </AuthPageShell>
  )
}
