import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { api } from '../../../../convex/_generated/api'
import { getAuthProxy } from '../../../lib/server-auth-proxy'
import type {
  UserSearchPage,
  UserSearchRow,
} from '../shared/user-search-contracts'
import {
  userSearchPageSchema,
  userSearchPreviewSchema,
} from '../shared/user-search-contracts'

const USER_SEARCH_SCOPE = 'User search server read'

export const userSearchInputSchema = z.object({
  cursor: z.string().nullable(),
  query: z.string().trim().min(2).max(100),
}).strict()
export const userSearchPreviewInputSchema = z.object({
  query: z.string().trim().min(2).max(100),
}).strict()

/** Runs a paginated User search through authenticated server transport. */
export const runUserSearch = async (
  input: unknown,
  query: (input: {
    query: string
    paginationOpts: { cursor: string | null; numItems: 20 }
  }) => Promise<unknown>,
): Promise<UserSearchPage> => {
  const parsed = userSearchInputSchema.parse(input)
  return userSearchPageSchema.parse(await query({
    query: parsed.query,
    paginationOpts: { cursor: parsed.cursor, numItems: 20 },
  }))
}

/** Runs a five-row User preview through authenticated server transport. */
export const runUserSearchPreview = async (
  input: unknown,
  query: (input: { query: string }) => Promise<unknown>,
): Promise<UserSearchRow[]> => {
  const parsed = userSearchPreviewInputSchema.parse(input)
  return userSearchPreviewSchema.parse(await query(parsed))
}

export const searchUsers = createServerFn({ method: 'GET' })
  .validator(userSearchInputSchema)
  .handler(async ({ data }) => await runUserSearch(
    data,
    async (input) => await getAuthProxy(USER_SEARCH_SCOPE)
      .fetchAuthQuery(api.userSearch.search, input),
  ))

export const searchUsersPreview = createServerFn({ method: 'GET' })
  .validator(userSearchPreviewInputSchema)
  .handler(async ({ data }) => await runUserSearchPreview(
    data,
    async (input) => await getAuthProxy(USER_SEARCH_SCOPE)
      .fetchAuthQuery(api.userSearch.searchPreview, input),
  ))
