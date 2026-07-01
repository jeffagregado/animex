import { authClient } from '../../lib/auth-client'

export const readAuthFormData = (
  event: React.FormEvent<HTMLFormElement>,
  setMessage: (message: string | null) => void,
): FormData => {
  event.preventDefault()
  setMessage(null)
  return new FormData(event.currentTarget)
}

export const getAuthErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

export const assertAuthResponse = async <TResponse,>(
  response: TResponse,
  fallback: string,
): Promise<TResponse> => {
  const maybeError = response as {
    error?: {
      message?: string
    } | null
  }
  if (maybeError.error) {
    throw new Error(maybeError.error.message ?? fallback)
  }
  return response
}

export const sendGoogleSignIn = async (): Promise<void> => {
  await assertAuthResponse(
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/auth/username',
    }),
    'Google sign-in failed.',
  )
}

export const postAuthEndpoint = async <TBody extends Record<string, string>>(
  path: string,
  body: TBody,
): Promise<void> => {
  await authClient.$fetch(path, {
    method: 'POST',
    body,
  })
}
