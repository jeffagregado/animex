import { convexBetterAuthReactStart } from '@convex-dev/better-auth/react-start'

import { api } from '../../../../convex/_generated/api'
import { toResetTokenKey } from '../../../lib/reset-token'
import { createStartServerRoute } from '../../../lib/server-route'

const requireServerEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required for AnimeX auth proxy.`)
  }
  return value
}

const getAuthProxy = () => {
  return convexBetterAuthReactStart({
    convexUrl: requireServerEnv('VITE_CONVEX_URL'),
    convexSiteUrl: requireServerEnv('CONVEX_SITE_URL'),
  })
}

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
    return await getAuthProxy().handler(request)
  }

  const token = await readResetToken(request)
  const tokenKey = await toResetTokenKey(token)
  const isCurrent = await getAuthProxy().fetchAuthQuery(api.passwordResets.isCurrent, {
    tokenKey,
  })

  if (!isCurrent) {
    return new Response('Reset link is invalid or expired.', { status: 400 })
  }

  const response = await getAuthProxy().handler(request)
  if (response.ok) {
    await getAuthProxy().fetchAuthMutation(api.passwordResets.clear, { tokenKey })
  }
  return response
}

export const Route = createStartServerRoute('/api/auth/$', {
  server: {
    handlers: {
      GET: async ({ request }) => {
        return await getAuthProxy().handler(request)
      },
      POST: async ({ request }) => {
        return await handlePost(request)
      },
    },
  },
})
