import { queryOptions, type QueryClient } from '@tanstack/react-query'

import { getProfileByUsername } from '../server/profile-read.functions'

export const profileQueryKey = (username: string) => [
  'profile',
  'server',
  username,
] as const

/** Shares one Profile header query between route loader and page. */
export const profileQueryOptions = (username: string) => queryOptions({
  queryKey: profileQueryKey(username),
  queryFn: async () => await getProfileByUsername({ data: { username } }),
  staleTime: 30_000,
})

/** Refreshes server-owned Profile data after one successful owner mutation. */
export const refreshProfileQuery = async (
  queryClient: QueryClient,
  username: string,
): Promise<void> => {
  const queryKey = profileQueryKey(username)
  await queryClient.invalidateQueries({ queryKey, refetchType: 'none' })
  await queryClient.refetchQueries({ queryKey, exact: true })
}
