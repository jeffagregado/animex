import { createServerFn } from '@tanstack/react-start'

import type { AuthState } from './auth-contracts'

export const PROFILE_ROUTE_AUTH_SCOPE = 'Profile route authentication'

/** Runs the authenticated application-state query through server transport. */
export const runAuthStateQuery = async (
  _query: () => Promise<unknown>,
): Promise<AuthState> => {
  throw new Error('NOT_IMPLEMENTED: authenticated server state')
}

export const getAuthState = createServerFn({ method: 'GET' })
  .handler(async () => await runAuthStateQuery(async () => {
    throw new Error('NOT_IMPLEMENTED: auth proxy transport')
  }))
