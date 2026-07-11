import { api } from '../../../../convex/_generated/api'
import { createFileRoute } from '@tanstack/react-router'
import type {} from '@tanstack/react-start'
import { resetTokenBodySchema } from '../../../lib/auth-schemas'
import { toResetTokenKey } from '../../../lib/reset-token'
import { getAuthProxy } from '../../../lib/server-auth-proxy'
import { parseJsonBody } from '../../../lib/server-json'

const AUTH_PROXY_SCOPE = 'AnimeX auth proxy'

const readResetToken = async (request: Request): Promise<string> => {
  const body = await parseJsonBody(request.clone(), resetTokenBodySchema, 'Password reset token is required.')
  return body.token
}

const isResetPasswordRequest = (request: Request): boolean => {
  return request.method === 'POST' && new URL(request.url).pathname === '/api/auth/reset-password'
}

const handlePost = async (request: Request): Promise<Response> => {
  if (!isResetPasswordRequest(request)) {
    return await getAuthProxy(AUTH_PROXY_SCOPE).handler(request)
  }

  const token = await readResetToken(request)
  const tokenKey = await toResetTokenKey(token)
  const authProxy = getAuthProxy(AUTH_PROXY_SCOPE)
  const isCurrent = await authProxy.fetchAuthQuery(api.passwordResets.isCurrent, {
    tokenKey,
  })

  if (!isCurrent) {
    return new Response('Reset link is invalid or expired.', { status: 400 })
  }

  const response = await authProxy.handler(request)
  if (response.ok) {
    await authProxy.fetchAuthMutation(api.passwordResets.clear, { tokenKey })
  }
  return response
}

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return await getAuthProxy(AUTH_PROXY_SCOPE).handler(request)
      },
      POST: async ({ request }) => {
        return await handlePost(request)
      },
    },
  },
})
