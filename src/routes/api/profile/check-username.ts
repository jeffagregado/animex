import { api } from '../../../../convex/_generated/api'
import { createFileRoute } from '@tanstack/react-router'
import type {} from '@tanstack/react-start'
import { usernameFormSchema } from '../../../lib/auth-schemas'
import { getAuthProxy } from '../../../lib/server-auth-proxy'
import { parseJsonBody } from '../../../lib/server-json'

const USERNAME_CHECK_SCOPE = 'AnimeX username checks'

const readUsername = async (request: Request): Promise<string> => {
  const body = await parseJsonBody(request, usernameFormSchema, 'Username check requires a username.')
  return body.username
}

export const Route = createFileRoute('/api/profile/check-username')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const username = await readUsername(request)
          const result = await getAuthProxy(USERNAME_CHECK_SCOPE).fetchAuthQuery(api.users.checkUsername, { username })
          return Response.json(result)
        } catch {
          console.error('Username check failed.')
          return new Response('Username check failed.', { status: 400 })
        }
      },
    },
  },
})
