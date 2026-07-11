import { useRef, useState } from 'react'
import { revalidateLogic, useForm } from '@tanstack/react-form'
import { Mail } from 'lucide-react'

import { AsyncButton } from '../../components/async-button'
import { authClient } from '../../lib/auth-client'
import { signUpSchema } from '../../lib/auth-schemas'
import {
  assertAuthResponse,
  getAuthCallbackUrl,
  getAuthErrorMessage,
  getAuthFieldErrorMessage,
  sendGoogleSignIn,
} from './auth-actions'
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
  Divider,
  GoogleButton,
} from './auth-page-shell'
import { PasswordField } from './password-field'
import { useRedirectSignedInAuthPage } from './use-auth-state'

const PENDING_PROFILE_NAME = 'AnimeX User'

export function SignUpPage() {
  const [message, setMessage] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitErrors, setSubmitErrors] = useState<Readonly<Record<string, string>>>({})
  const [emailServerError, setEmailServerError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const authState = useRedirectSignedInAuthPage()
  const authMessage = authState.status === 'error' ? authState.message : null

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
    validationLogic: revalidateLogic({ mode: 'blur', modeAfterSubmission: 'change' }),
    validators: {
      onDynamic: signUpSchema,
    },
    onSubmit: async ({ value }) => {
      setMessage(null)
      setEmailServerError(null)
      const input = signUpSchema.safeParse(value)
      if (!input.success) {
        setMessage(input.error.issues[0]?.message ?? 'Create account failed.')
        return
      }

      try {
        const verifyEmailPath = '/auth/verify-email'
        await assertAuthResponse(
          await authClient.signUp.email({
            email: input.data.email,
            password: input.data.password,
            name: PENDING_PROFILE_NAME,
            callbackURL: getAuthCallbackUrl(verifyEmailPath),
          }),
          'Create account failed.',
        )
        window.location.assign(verifyEmailPath)
      } catch (error) {
        const mappedError = getAuthFieldErrorMessage(error, 'email')
        if (mappedError) {
          setEmailServerError(mappedError)
          window.setTimeout(() => focusFirstInvalidAuthField(formRef.current, ['email']), 0)
          return
        }
        setMessage(getAuthErrorMessage(error, 'Create account failed.'))
      }
    },
  })

  return (
    <AuthPageShell eyebrow="Join AnimeX" subtitle={null} title="Create Account">
      <GoogleButton onClick={sendGoogleSignIn} />
      <Divider />
      <form
        ref={formRef}
        className="auth-form"
        method="post"
        noValidate
        onSubmit={(event) => submitAuthForm(event, () => {
          setSubmitted(true)
          const errors = getAuthSchemaErrors(signUpSchema, form.state.values)
          setSubmitErrors(errors)
          if (Object.keys(errors).length > 0) {
            window.setTimeout(() => focusFirstInvalidAuthField(formRef.current, ['email', 'password', 'confirmPassword']), 0)
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
              error={emailServerError ?? (submitted ? submitErrors.email ?? null : getAuthFieldError(field.state.meta.errors as Array<string | { message?: string }>))}
              onBlur={field.handleBlur}
              onChange={(value) => {
                setEmailServerError(null)
                field.handleChange(value)
                if (submitted) setSubmitErrors(getAuthSchemaErrors(signUpSchema, { ...form.state.values, email: value }))
              }}
            />
          )}
        />
        <form.Field
          name="password"
          children={(field) => (
            <PasswordField
              autoComplete="new-password"
              label="Password"
              name={field.name}
              value={field.state.value}
              error={submitted ? submitErrors.password ?? null : getAuthFieldError(field.state.meta.errors as Array<string | { message?: string }>)}
              onBlur={field.handleBlur}
              onChange={(value) => {
                field.handleChange(value)
                if (submitted) setSubmitErrors(getAuthSchemaErrors(signUpSchema, { ...form.state.values, password: value }))
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
              error={submitted ? submitErrors.confirmPassword ?? null : getAuthFieldError(field.state.meta.errors as Array<string | { message?: string }>)}
              onBlur={field.handleBlur}
              onChange={(value) => {
                field.handleChange(value)
                if (submitted) setSubmitErrors(getAuthSchemaErrors(signUpSchema, { ...form.state.values, confirmPassword: value }))
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
              Create Account
            </AsyncButton>
          )}
        />
      </form>
      <AuthMessage message={message ?? authMessage} />
      <p className="auth-switch">
        Already have an account? <a href="/auth/sign-in">Sign in</a>
      </p>
    </AuthPageShell>
  )
}
