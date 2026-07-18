import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { api } from '../../../../convex/_generated/api'
import { getAuthProxy } from '../../../lib/server-auth-proxy'
import {
  parseProfileContentPage,
  profileResultSchema,
  type ProfileContentPage,
  type ProfileResult,
  type ProfileTab,
} from '../shared/profile-contracts'

const PROFILE_READ_SCOPE = 'Profile server read'

const profileUsernameInputSchema = z.object({
  username: z.string().trim().min(1),
}).strict()
const profileContentInputSchema = profileUsernameInputSchema.extend({
  cursor: z.string().nullable(),
  tab: z.enum(['activity', 'reviews', 'favorites']),
}).strict()

/** Runs a strict Profile header read through authenticated server transport. */
export const runProfileRead = async (
  input: unknown,
  query: (input: { username: string }) => Promise<unknown>,
): Promise<ProfileResult> => {
  const parsed = profileUsernameInputSchema.parse(input)
  return profileResultSchema.parse(await query(parsed))
}

/** Runs one strict Profile content lane through authenticated server transport. */
export const runProfileContentRead = async (
  input: unknown,
  query: (
    tab: ProfileTab,
    input: { username: string; cursor: string | null },
  ) => Promise<unknown>,
): Promise<ProfileContentPage> => {
  const parsed = profileContentInputSchema.parse(input)
  const result = await query(parsed.tab, {
    username: parsed.username,
    cursor: parsed.cursor,
  })
  return parseProfileContentPage(parsed.tab, result)
}

export const getProfileByUsername = createServerFn({ method: 'GET' })
  .validator(profileUsernameInputSchema)
  .handler(async ({ data }) => await runProfileRead(
    data,
    async (input) => await getAuthProxy(PROFILE_READ_SCOPE)
      .fetchAuthQuery(api.profiles.getByUsername, input),
  ))

export const getProfileContentPage = createServerFn({ method: 'GET' })
  .validator(profileContentInputSchema)
  .handler(async ({ data }) => await runProfileContentRead(
    data,
    async (tab, input) => {
      const proxy = getAuthProxy(PROFILE_READ_SCOPE)
      if (tab === 'activity') {
        return await proxy.fetchAuthQuery(api.feed.listForProfile, input)
      }
      if (tab === 'reviews') {
        return await proxy.fetchAuthQuery(api.reviews.listForProfile, input)
      }
      return await proxy.fetchAuthQuery(api.userAnime.listProfileFavorites, input)
    },
  ))
