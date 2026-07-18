import { z } from 'zod'

export const USER_SEARCH_PAGE_SIZE = 20 as const
export const USER_SEARCH_PREVIEW_SIZE = 5 as const

export const userSearchRowSchema = z.object({
  avatarUrl: z.url({ protocol: /^https$/ }).nullable(),
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  username: z.string().trim().min(1),
}).strict()

export const userSearchPageSchema = z.object({
  continueCursor: z.string(),
  isDone: z.boolean(),
  page: z.array(userSearchRowSchema).max(USER_SEARCH_PAGE_SIZE),
}).strict()

export const userSearchPreviewSchema = z.array(userSearchRowSchema)
  .max(USER_SEARCH_PREVIEW_SIZE)

export type UserSearchRow = z.infer<typeof userSearchRowSchema>
export type UserSearchPage = z.infer<typeof userSearchPageSchema>
