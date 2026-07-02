import { authClient } from '../../lib/auth-client'

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

export const getAuthCallbackUrl = (path: string): string => {
  return new URL(path, window.location.origin).href
}

export const sendGoogleSignIn = async (): Promise<void> => {
  await assertAuthResponse(
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: getAuthCallbackUrl('/auth/oauth-callback'),
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
