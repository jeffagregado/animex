import { type AuthState } from './auth-contracts'
import { resolveAuthReturnTo } from './auth-return'

export type AuthFlowResult =
  | { kind: 'message'; message: string }
  | { kind: 'redirect'; path: string }

const GOOGLE_ERROR = 'Google sign-in couldn’t continue. Try another sign-in method.'
const OAUTH_CONFLICT = 'Email already in use. Sign in instead.'

const OAUTH_CONFLICT_CODES = new Set([
  'account_not_linked',
  'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
])

const GOOGLE_ERROR_CODES = new Set([
  'GOOGLE_EMAIL_NOT_VERIFIED',
  'email_not_found',
  'invalid_code',
  'no_code',
  'oauth_provider_not_found',
  'unable_to_create_user',
  'unable_to_get_user_info',
])

const resolveCompleteReturn = (returnTo: string | null): AuthFlowResult => {
  const result = resolveAuthReturnTo(returnTo)
  return result.available
    ? { kind: 'redirect', path: result.path }
    : { kind: 'message', message: result.message }
}

export const resolvePasswordSignIn = (
  state: AuthState,
  returnTo: string | null,
): AuthFlowResult => {
  if (state.status === 'emailUnverified') return { kind: 'redirect', path: '/auth/verify-email' }
  if (state.status === 'needsProfile') return { kind: 'redirect', path: '/auth/username' }
  if (state.status === 'complete') return resolveCompleteReturn(returnTo)
  return { kind: 'message', message: 'Sign-in couldn’t be completed. Try again.' }
}

export const resolveOAuthCallback = (
  state: AuthState,
  errorCode: string | null,
  returnTo: string | null,
): AuthFlowResult => {
  if (errorCode) {
    if (OAUTH_CONFLICT_CODES.has(errorCode)) return { kind: 'message', message: OAUTH_CONFLICT }
    if (GOOGLE_ERROR_CODES.has(errorCode)) return { kind: 'message', message: GOOGLE_ERROR }
    return { kind: 'message', message: GOOGLE_ERROR }
  }
  if (state.status === 'complete') return resolveCompleteReturn(returnTo)
  if (state.status === 'needsProfile') return { kind: 'redirect', path: '/auth/username' }
  if (state.status === 'signedOut') return { kind: 'redirect', path: '/auth/sign-in' }
  return { kind: 'message', message: GOOGLE_ERROR }
}

export const readAuthSearchParam = (search: string, name: string): string | null => {
  return new URLSearchParams(search).get(name)
}
