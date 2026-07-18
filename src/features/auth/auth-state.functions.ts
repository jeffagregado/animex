import { createServerFn } from '@tanstack/react-start'

import { api } from '../../../convex/_generated/api'
import { getAuthProxy } from '../../lib/server-auth-proxy'
import { authStateSchema, type AuthState } from './auth-contracts'

export const PROFILE_ROUTE_AUTH_SCOPE = 'Profile route authentication'

/** Runs the authenticated application-state query through server transport. */
export const runAuthStateQuery = async (
  query: () => Promise<unknown>,
): Promise<AuthState> => {
  try {
    return authStateSchema.parse(await query())
  } catch (error) {
    throw new Error('AUTH_STATE_UNAVAILABLE', { cause: error })
  }
}

export const getAuthState = createServerFn({ method: 'GET' })
  .handler(async () => await runAuthStateQuery(
    async () => await getAuthProxy(PROFILE_ROUTE_AUTH_SCOPE)
      .fetchAuthQuery(api.users.getAuthState, {}),
  ))
