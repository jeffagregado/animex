import { z } from 'zod'

import { authStateSchema, type AuthState } from './auth-contracts'

export { type AuthState } from './auth-contracts'

const usernameCheckSchema = z.object({
  available: z.boolean(),
  message: z.string().nullable(),
}).strict()

export type UsernameCheck = z.infer<typeof usernameCheckSchema>

class ProfileActionError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ProfileActionError'
    this.status = status
  }
}

export const isUsernameUnavailableError = (error: unknown): boolean => {
  return error instanceof ProfileActionError && error.status === 409
}

export const readAuthState = async (): Promise<AuthState> => {
  const response = await fetch('/api/profile/state')
  if (!response.ok) {
    throw new Error('Auth state check failed.')
  }
  const result = authStateSchema.safeParse(await response.json())
  if (!result.success) {
    throw new Error('Invalid auth state response.')
  }
  return result.data
}

export const checkUsername = async (username: string): Promise<UsernameCheck> => {
  const response = await fetch('/api/profile/check-username', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username }),
  })

  if (!response.ok) {
    throw new Error('Username check failed.')
  }

  const result = usernameCheckSchema.safeParse(await response.json())
  if (!result.success) {
    throw new Error('Invalid username check response.')
  }
  return result.data
}

export const completeAuthProfile = async (username: string): Promise<void> => {
  const response = await fetch('/api/profile/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new ProfileActionError(message || 'Profile completion failed.', response.status)
  }
}
