import { useEffect, useRef, useState } from 'react'
import { revalidateLogic, useForm } from '@tanstack/react-form'
import { Mail } from 'lucide-react'

import { AsyncButton } from '../../components/async-button'
import { authClient } from '../../lib/auth-client'
import { signInSchema } from '../../lib/auth-schemas'
import {
  assertAuthResponse,
  getAuthErrorMessage,
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
import { readAuthSearchParam, resolvePasswordSignIn } from './auth-flow'
import { navigateToAuthPath } from './auth-navigation'
import { readAuthState } from './profile-actions'
import { useAuthState } from './use-auth-state'

const applySignInResult = (
  result: ReturnType<typeof resolvePasswordSignIn>,
  setMessage: (message: string | null) => void,
): void => {
  if (result.kind === 'redirect') {
    navigateToAuthPath(result.path)
    return
  }
  setMessage(result.message)
}

const readReturnTo = (): string | null => {
  return readAuthSearchParam(window.location.search, 'returnTo')
}

export function SignInPage() {
  const [message, setMessage] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitErrors, setSubmitErrors] = useState<Readonly<Record<string, string>>>({})
  const formRef = useRef<HTMLFormElement>(null)
  const authState = useAuthState()
  const authMessage = authState.status === 'error'
    ? 'Sign-in status couldn’t be checked. Try again.'
    : null

  useEffect(() => {
    if (authState.status !== 'ready' || authState.authState.status === 'signedOut') return
    applySignInResult(resolvePasswordSignIn(authState.authState, readReturnTo()), setMessage)
  }, [authState])

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    validationLogic: revalidateLogic({ mode: 'blur', modeAfterSubmission: 'change' }),
    validators: {
      onDynamic: signInSchema,
    },
    onSubmit: async ({ value }) => {
      setMessage(null)
      const input = signInSchema.safeParse(value)
      if (!input.success) {
        setMessage(input.error.issues[0]?.message ?? 'Invalid email or password.')
        return
      }

      try {
        await assertAuthResponse(
          await authClient.signIn.email({
            email: input.data.email,
            password: input.data.password,
          }),
          'Invalid email or password.',
        )
        const state = await readAuthState()
        applySignInResult(resolvePasswordSignIn(state, readReturnTo()), setMessage)
      } catch (error) {
        setMessage(getAuthErrorMessage(error, 'Invalid email or password.'))
      }
    },
  })

  return (
    <AuthPageShell eyebrow="Welcome back" subtitle={null} title="Sign in">
      <GoogleButton onClick={sendGoogleSignIn} />
      <Divider />
      <form
        ref={formRef}
        className="auth-form"
        method="post"
        noValidate
        onSubmit={(event) => submitAuthForm(event, () => {
          setSubmitted(true)
          const errors = getAuthSchemaErrors(signInSchema, form.state.values)
          setSubmitErrors(errors)
          if (Object.keys(errors).length > 0) {
            window.setTimeout(() => focusFirstInvalidAuthField(formRef.current, ['email', 'password']), 0)
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
              error={submitted ? submitErrors.email ?? null : getAuthFieldError(field.state.meta.errors as Array<string | { message?: string }>)}
              onBlur={field.handleBlur}
              onChange={(value) => {
                field.handleChange(value)
                if (submitted) setSubmitErrors(getAuthSchemaErrors(signInSchema, { ...form.state.values, email: value }))
              }}
            />
          )}
        />
        <form.Field
          name="password"
          children={(field) => (
            <PasswordField
              autoComplete="current-password"
              label="Password"
              name={field.name}
              value={field.state.value}
              error={submitted ? submitErrors.password ?? null : getAuthFieldError(field.state.meta.errors as Array<string | { message?: string }>)}
              onBlur={field.handleBlur}
              onChange={(value) => {
                field.handleChange(value)
                if (submitted) setSubmitErrors(getAuthSchemaErrors(signInSchema, { ...form.state.values, password: value }))
              }}
            />
          )}
        />
        <a href="/auth/forgot-password" className="auth-inline-link">
          Forgot password?
        </a>
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([, isSubmitting]) => (
            <AsyncButton
              className="auth-submit auth-submit-coral"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              type="submit"
            >
              Sign in
            </AsyncButton>
          )}
        />
      </form>
      <AuthMessage message={message ?? authMessage} />
      <p className="auth-switch">
        New to AnimeX? <a href="/auth/sign-up">Create account</a>
      </p>
    </AuthPageShell>
  )
}
