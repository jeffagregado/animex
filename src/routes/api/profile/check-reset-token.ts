import { api } from '../../../../convex/_generated/api'
import { resetTokenBodySchema } from '../../../lib/auth-schemas'
import { toResetTokenKey } from '../../../lib/reset-token'
import { getAuthProxy } from '../../../lib/server-auth-proxy'
import { parseJsonBody } from '../../../lib/server-json'
import { createStartServerRoute } from '../../../lib/server-route'

const RESET_TOKEN_SCOPE = 'AnimeX reset token checks'

const readToken = async (request: Request): Promise<string> => {
  const body = await parseJsonBody(request, resetTokenBodySchema, 'Reset token check requires a token.')
  return body.token
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
