import { api } from '../../../../convex/_generated/api'
import { createFileRoute } from '@tanstack/react-router'
import type {} from '@tanstack/react-start'
import { getAuthProxy } from '../../../lib/server-auth-proxy'

const AUTH_STATE_SCOPE = 'AnimeX auth state'

export const Route = createFileRoute('/api/profile/state')({
  server: {
    handlers: {
      GET: async () => {
        const state = await getAuthProxy(AUTH_STATE_SCOPE).fetchAuthQuery(api.users.getAuthState, {})
        return Response.json(state)
      },
    },
  },
})
