import { api } from '../../../../convex/_generated/api'
import { getAuthProxy } from '../../../lib/server-auth-proxy'
import { createStartServerRoute } from '../../../lib/server-route'

const AUTH_STATE_SCOPE = 'AnimeX auth state'

export const Route = createStartServerRoute('/api/profile/state', {
  server: {
    handlers: {
      GET: async () => {
        const state = await getAuthProxy(AUTH_STATE_SCOPE).fetchAuthQuery(api.users.getAuthState, {})
        return Response.json(state)
      },
    },
  },
})
