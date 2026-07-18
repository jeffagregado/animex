import { queryOptions } from '@tanstack/react-query'

import { getAuthState } from './auth-state.functions'

export const AUTH_STATE_QUERY_KEY = ['auth-state'] as const
export const AUTH_STATE_STALE_TIME_MS = 30_000

/** Shares one auth-state cache entry across loaders and public consumers. */
export const authStateQueryOptions = () => queryOptions({
  queryKey: AUTH_STATE_QUERY_KEY,
  queryFn: async () => await getAuthState(),
  staleTime: AUTH_STATE_STALE_TIME_MS,
})
