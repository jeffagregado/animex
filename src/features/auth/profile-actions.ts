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
