import { convexBetterAuthReactStart } from '@convex-dev/better-auth/react-start'

import { api } from '../../../../convex/_generated/api'
import { createStartServerRoute } from '../../../lib/server-route'

const requireServerEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required for AnimeX username checks.`)
  }
  return value
}

const getAuthProxy = () => {
  return convexBetterAuthReactStart({
    convexUrl: requireServerEnv('VITE_CONVEX_URL'),
    convexSiteUrl: requireServerEnv('CONVEX_SITE_URL'),
  })
}

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
          const result = await getAuthProxy().fetchAuthQuery(api.users.checkUsername, { username })
          return Response.json(result)
        } catch (error) {
          console.error('Username check failed.', error)
          return new Response('Username check failed.', { status: 400 })
        }
      },
    },
  },
})
