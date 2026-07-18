import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import type {
  UserSearchPage,
  UserSearchRow,
} from '../shared/user-search-contracts'

export const userSearchInputSchema = z.object({
  cursor: z.string().nullable(),
  query: z.string().trim().min(2).max(100),
}).strict()
export const userSearchPreviewInputSchema = z.object({
  query: z.string().trim().min(2).max(100),
}).strict()

/** Runs a paginated User search through authenticated server transport. */
export const runUserSearch = async (
  _input: unknown,
  _query: (input: {
    query: string
    paginationOpts: { cursor: string | null; numItems: 20 }
  }) => Promise<unknown>,
): Promise<UserSearchPage> => {
  throw new Error('NOT_IMPLEMENTED: authenticated User search')
}

/** Runs a five-row User preview through authenticated server transport. */
export const runUserSearchPreview = async (
  _input: unknown,
  _query: (input: { query: string }) => Promise<unknown>,
): Promise<UserSearchRow[]> => {
  throw new Error('NOT_IMPLEMENTED: authenticated User preview search')
}

export const searchUsers = createServerFn({ method: 'GET' })
  .validator(userSearchInputSchema)
  .handler(async ({ data }) => await runUserSearch(data, async () => {
    throw new Error('NOT_IMPLEMENTED: User search proxy transport')
  }))

export const searchUsersPreview = createServerFn({ method: 'GET' })
  .validator(userSearchPreviewInputSchema)
  .handler(async ({ data }) => await runUserSearchPreview(data, async () => {
    throw new Error('NOT_IMPLEMENTED: User preview proxy transport')
  }))
