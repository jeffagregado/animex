import { api } from '../../../../convex/_generated/api'
import { toResetTokenKey } from '../../../lib/reset-token'
import { getAuthProxy } from '../../../lib/server-auth-proxy'
import { createStartServerRoute } from '../../../lib/server-route'

const AUTH_PROXY_SCOPE = 'AnimeX auth proxy'

const readResetToken = async (request: Request): Promise<string> => {
  const body: unknown = await request.clone().json()
  if (!body || typeof body !== 'object' || typeof (body as Record<string, unknown>).token !== 'string') {
    throw new Error('Password reset token is required.')
  }
  return (body as Record<string, string>).token
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

export const Route = createStartServerRoute('/api/auth/$', {
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
