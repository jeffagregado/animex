import { convexBetterAuthReactStart } from '@convex-dev/better-auth/react-start'

import { api } from '../../../../convex/_generated/api'
import { createStartServerRoute } from '../../../lib/server-route'

const requireServerEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required for AnimeX auth state.`)
  }
  return value
}

const getAuthProxy = () => {
  return convexBetterAuthReactStart({
    convexUrl: requireServerEnv('VITE_CONVEX_URL'),
    convexSiteUrl: requireServerEnv('CONVEX_SITE_URL'),
  })
}

export const Route = createStartServerRoute('/api/profile/state', {
  server: {
    handlers: {
      GET: async () => {
        const state = await getAuthProxy().fetchAuthQuery(api.users.getAuthState, {})
        return Response.json(state)
      },
    },
  },
})
