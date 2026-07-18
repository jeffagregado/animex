import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import type {
  ProfileContentPage,
  ProfileResult,
  ProfileTab,
} from '../shared/profile-contracts'

export const profileUsernameInputSchema = z.object({
  username: z.string().trim().min(1),
}).strict()
export const profileContentInputSchema = profileUsernameInputSchema.extend({
  cursor: z.string().nullable(),
  tab: z.enum(['activity', 'reviews', 'favorites']),
}).strict()

/** Runs a strict Profile header read through authenticated server transport. */
export const runProfileRead = async (
  _input: unknown,
  _query: (input: { username: string }) => Promise<unknown>,
): Promise<ProfileResult> => {
  throw new Error('NOT_IMPLEMENTED: authenticated Profile read')
}

/** Runs one strict Profile content lane through authenticated server transport. */
export const runProfileContentRead = async (
  _input: unknown,
  _query: (
    tab: ProfileTab,
    input: { username: string; cursor: string | null },
  ) => Promise<unknown>,
): Promise<ProfileContentPage> => {
  throw new Error('NOT_IMPLEMENTED: authenticated Profile content read')
}

export const getProfileByUsername = createServerFn({ method: 'GET' })
  .validator(profileUsernameInputSchema)
  .handler(async ({ data }) => await runProfileRead(data, async () => {
    throw new Error('NOT_IMPLEMENTED: Profile proxy transport')
  }))

export const getProfileContentPage = createServerFn({ method: 'GET' })
  .validator(profileContentInputSchema)
  .handler(async ({ data }) => await runProfileContentRead(data, async () => {
    throw new Error('NOT_IMPLEMENTED: Profile content proxy transport')
  }))
