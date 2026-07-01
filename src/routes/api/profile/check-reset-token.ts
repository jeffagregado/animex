import { api } from '../../../../convex/_generated/api'
import { toResetTokenKey } from '../../../lib/reset-token'
import { getAuthProxy } from '../../../lib/server-auth-proxy'
import { createStartServerRoute } from '../../../lib/server-route'

const RESET_TOKEN_SCOPE = 'AnimeX reset token checks'

const readToken = async (request: Request): Promise<string> => {
  const body: unknown = await request.json()
  if (!body || typeof body !== 'object' || typeof (body as Record<string, unknown>).token !== 'string') {
    throw new Error('Reset token check requires a token.')
  }
  return (body as Record<string, string>).token
}

export const Route = createStartServerRoute('/api/profile/check-reset-token', {
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const token = await readToken(request)
          const tokenKey = await toResetTokenKey(token)
          const valid = await getAuthProxy(RESET_TOKEN_SCOPE).fetchAuthQuery(api.passwordResets.isCurrent, {
            tokenKey,
          })
          return Response.json({ valid })
        } catch (error) {
          console.error('Reset token check failed.', error)
          return new Response('Reset token check failed.', { status: 400 })
        }
      },
    },
  },
})
