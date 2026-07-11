import { useRef, useState } from 'react'
import { revalidateLogic, useForm } from '@tanstack/react-form'
import { Mail } from 'lucide-react'

import { AsyncButton } from '../../components/async-button'
import { forgotPasswordSchema } from '../../lib/auth-schemas'
import { getAuthCallbackUrl, postAuthEndpoint } from './auth-actions'
import {
  focusFirstInvalidAuthField,
  getAuthFieldError,
  getAuthSchemaErrors,
  submitAuthForm,
} from './auth-form'
import {
  AuthControlledField,
  AuthMessage,
  AuthPageShell,
} from './auth-page-shell'
import { useRedirectSignedInAuthPage } from './use-auth-state'

export function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitErrors, setSubmitErrors] = useState<Readonly<Record<string, string>>>({})
  const [messageKind, setMessageKind] = useState<'error' | 'status'>('error')
  const formRef = useRef<HTMLFormElement>(null)
  const authState = useRedirectSignedInAuthPage()
  const authMessage = authState.status === 'error' ? authState.message : null

  const form = useForm({
    defaultValues: {
      email: '',
    },
    validationLogic: revalidateLogic({ mode: 'blur', modeAfterSubmission: 'change' }),
    validators: {
      onDynamic: forgotPasswordSchema,
    },
    onSubmit: async ({ value }) => {
      setMessage(null)
      setMessageKind('error')
      const input = forgotPasswordSchema.safeParse(value)
      if (!input.success) {
        setMessage(input.error.issues[0]?.message ?? 'Password reset request failed.')
        return
      }

      try {
        await postAuthEndpoint('/request-password-reset', {
          email: input.data.email,
          redirectTo: getAuthCallbackUrl('/auth/reset-password'),
        })
        setMessageKind('status')
        setMessage('If an account exists, reset instructions were sent.')
      } catch {
        setMessageKind('status')
        setMessage('If an account exists, reset instructions were sent.')
      }
    },
  })

  return (
    <AuthPageShell eyebrow="Account recovery" subtitle={null} title="Reset Password">
      <form
        ref={formRef}
        className="auth-form"
        method="post"
        noValidate
        onSubmit={(event) => submitAuthForm(event, () => {
          setSubmitted(true)
          const errors = getAuthSchemaErrors(forgotPasswordSchema, form.state.values)
          setSubmitErrors(errors)
          if (Object.keys(errors).length > 0) {
            window.setTimeout(() => focusFirstInvalidAuthField(formRef.current, ['email']), 0)
            return
          }
          void form.handleSubmit()
        })}
      >
        <form.Field
          name="email"
          children={(field) => (
            <AuthControlledField
              autoComplete="email"
              icon={Mail}
              label="Account Email"
              name={field.name}
              type="email"
              value={field.state.value}
              error={submitted ? submitErrors.email ?? null : getAuthFieldError(field.state.meta.errors)}
              onBlur={field.handleBlur}
              onChange={(value) => {
                field.handleChange(value)
                if (submitted) setSubmitErrors(getAuthSchemaErrors(forgotPasswordSchema, { email: value }))
              }}
            />
          )}
        />
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([, isSubmitting]) => (
            <AsyncButton
              className="auth-submit auth-submit-coral"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              type="submit"
            >
              Send Reset Link
            </AsyncButton>
          )}
        />
      </form>
      <AuthMessage kind={message ? messageKind : 'error'} message={message ?? authMessage} />
      <p className="auth-switch">
        Remembered it? <a href="/auth/sign-in">Sign in</a>
      </p>
    </AuthPageShell>
  )
}
