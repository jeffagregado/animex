import { api } from '../../../../convex/_generated/api'
import { getAuthProxy } from '../../../lib/server-auth-proxy'
import { createStartServerRoute } from '../../../lib/server-route'

const USERNAME_CHECK_SCOPE = 'AnimeX username checks'

const isRecordBody = (body: unknown): body is Record<string, unknown> => {
  return Boolean(body) && typeof body === 'object'
}

const readUsername = async (request: Request): Promise<string> => {
  const body: unknown = await request.json()

  if (!isRecordBody(body) || typeof body.username !== 'string') {
    throw new Error('Username check requires a username.')
  }

  return body.username
}

export const Route = createStartServerRoute('/api/profile/check-username', {
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const username = await readUsername(request)
          const result = await getAuthProxy(USERNAME_CHECK_SCOPE).fetchAuthQuery(api.users.checkUsername, { username })
          return Response.json(result)
        } catch (error) {
          console.error('Username check failed.', error)
          return new Response('Username check failed.', { status: 400 })
        }
      },
    },
  },
})
