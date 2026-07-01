export type AuthStatus = 'signedOut' | 'emailUnverified' | 'needsProfile' | 'complete'

export type AuthState = {
  status: AuthStatus
  email: string | null
  emailVerified: boolean
  profile: unknown
}

export type UsernameCheck = {
  available: boolean
  message: string | null
}

export type ResetTokenCheck = {
  valid: boolean
}

export const readAuthState = async (): Promise<AuthState> => {
  const response = await fetch('/api/profile/state')
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Auth state check failed.')
  }
  return await response.json() as AuthState
}

export const checkUsername = async (username: string): Promise<UsernameCheck> => {
  const response = await fetch('/api/profile/check-username', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Username check failed.')
  }

  return await response.json() as UsernameCheck
}

export const checkResetToken = async (token: string): Promise<ResetTokenCheck> => {
  const response = await fetch('/api/profile/check-reset-token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Reset token check failed.')
  }

  return await response.json() as ResetTokenCheck
}

export const completeAuthProfile = async (username: string): Promise<void> => {
  const response = await fetch('/api/profile/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Profile completion failed.')
  }
}
