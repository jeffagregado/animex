import { authClient } from '../../lib/auth-client'
import {
  AUTH_ERROR_CODES,
  type AuthResponse,
  type AuthResponseError,
} from './auth-contracts'

const AUTH_ERROR_COPY: Readonly<Record<string, string>> = {
  [AUTH_ERROR_CODES.invalidCredentials]: 'Invalid email or password.',
  [AUTH_ERROR_CODES.invalidOtp]: 'Verification code is invalid.',
  [AUTH_ERROR_CODES.accountNotLinked]: 'Email already in use. Sign in instead.',
  [AUTH_ERROR_CODES.emailInUse]: 'Email already in use. Sign in instead.',
  [AUTH_ERROR_CODES.providerNotFound]: 'Google sign-in couldn\u2019t continue. Try another sign-in method.',
  [AUTH_ERROR_CODES.providerNotConfigured]: 'Google sign-in couldn\u2019t continue. Try another sign-in method.',
  [AUTH_ERROR_CODES.providerNotSupported]: 'Google sign-in couldn\u2019t continue. Try another sign-in method.',
  [AUTH_ERROR_CODES.otpExpired]: 'Verification code expired. Request a new code.',
  [AUTH_ERROR_CODES.tooManyOtpAttempts]: 'Too many incorrect codes. Request a new code.',
  [AUTH_ERROR_CODES.tooManyRequests]: 'Too many attempts. Try again later.',
}

class AuthActionError extends Error {
  readonly authError: AuthResponseError | null

  constructor(message: string, authError: AuthResponseError | null) {
    super(message)
    this.name = 'AuthActionError'
    this.authError = authError
  }
}

const getSafeAuthCopy = (error: AuthResponseError | null, fallback: string): string => {
  if (error?.status === 429) {
    return 'Too many attempts. Try again later.'
  }
  return error?.code === undefined ? fallback : AUTH_ERROR_COPY[error.code] ?? fallback
}

export const getAuthErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof AuthActionError) {
    return getSafeAuthCopy(error.authError, fallback)
  }
  return fallback
}

type AuthErrorField = 'email' | 'newEmail' | 'otp'

// Maps only explicit auth codes whose field is certain in current flow.
export const getAuthFieldErrorMessage = (
  error: unknown,
  field: AuthErrorField,
): string | null => {
  if (!(error instanceof AuthActionError) || error.authError?.status === 429) return null
  const code = error.authError?.code
  if (field === 'otp') {
    if (
      code === AUTH_ERROR_CODES.invalidOtp
      || code === AUTH_ERROR_CODES.otpExpired
      || code === AUTH_ERROR_CODES.tooManyOtpAttempts
    ) {
      return getSafeAuthCopy(error.authError, error.message)
    }
    return null
  }
  if (code === AUTH_ERROR_CODES.accountNotLinked || code === AUTH_ERROR_CODES.emailInUse) {
    return getSafeAuthCopy(error.authError, error.message)
  }
  return null
}

export const assertAuthResponse = async <TData,>(
  response: AuthResponse<TData>,
  fallback: string,
): Promise<TData> => {
  if (response.error !== null) {
    throw new AuthActionError(getSafeAuthCopy(response.error, fallback), response.error)
  }
  if (response.data === null || response.data === undefined) {
    throw new AuthActionError(fallback, null)
  }
  return response.data
}

export const getAuthCallbackUrl = (path: string): string => {
  return new URL(path, window.location.origin).href
}

export const sendGoogleSignIn = async (): Promise<void> => {
  const returnTo = new URLSearchParams(window.location.search).get('returnTo')
  const callbackPath = returnTo
    ? `/auth/oauth-callback?${new URLSearchParams({ returnTo }).toString()}`
    : '/auth/oauth-callback'
  const callbackURL = getAuthCallbackUrl(callbackPath)
  await assertAuthResponse(
    await authClient.signIn.social({
      provider: 'google',
      callbackURL,
      errorCallbackURL: callbackURL,
    }),
    'Google sign-in failed.',
  )
}

export const postAuthEndpoint = async <TBody extends Record<string, string>>(
  path: string,
  body: TBody,
): Promise<void> => {
  const response = await authClient.$fetch(path, {
    method: 'POST',
    body,
  })
  await assertAuthResponse(response, 'Auth request failed.')
}
