import { type AuthState, readAuthState } from './profile-actions'

export type PrivateAuthMode = 'verified' | 'profile'

class AuthRedirectError extends Error {
  redirectTo: string

  constructor(redirectTo: string) {
    super(`Auth redirect required: ${redirectTo}`)
    this.name = 'AuthRedirectError'
    this.redirectTo = redirectTo
  }
}

const getAuthRedirect = (
  state: AuthState,
  mode: PrivateAuthMode,
): string | null => {
  if (state.status === 'signedOut') {
    return '/auth/sign-in'
  }
  if (state.status === 'emailUnverified') {
    return '/auth/verify-email'
  }
  if (mode === 'profile' && state.status === 'needsProfile') {
    return '/auth/username'
  }
  return null
}

export const requireAuthState = async (mode: PrivateAuthMode): Promise<AuthState> => {
  const state = await readAuthState()
  const redirectTo = getAuthRedirect(state, mode)
  if (redirectTo) {
    throw new AuthRedirectError(redirectTo)
  }
  return state
}

export const redirectForAuthError = (error: unknown): boolean => {
  if (!(error instanceof AuthRedirectError)) {
    return false
  }

  window.location.assign(error.redirectTo)
  return true
}
