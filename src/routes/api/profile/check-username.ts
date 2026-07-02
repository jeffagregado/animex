import { api } from '../../../../convex/_generated/api'
import { usernameFormSchema } from '../../../lib/auth-schemas'
import { getAuthProxy } from '../../../lib/server-auth-proxy'
import { parseJsonBody } from '../../../lib/server-json'
import { createStartServerRoute } from '../../../lib/server-route'

const USERNAME_CHECK_SCOPE = 'AnimeX username checks'

const readUsername = async (request: Request): Promise<string> => {
  const body = await parseJsonBody(request, usernameFormSchema, 'Username check requires a username.')
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
