import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
  animePeopleKindSchema,
  type AnimeCharacter,
  type AnimePeoplePage,
  type AnimeStaff,
  type PublicAnimeDetailState,
} from '../shared/anime-detail-contracts'

const positiveSafeInteger = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
export const animeDetailGetInputSchema = z.object({ anilistId: positiveSafeInteger }).strict()
export const animePeopleGetInputSchema = z.object({ anilistId: positiveSafeInteger, kind: animePeopleKindSchema, page: positiveSafeInteger }).strict()

export type AnimeDetailGetInput = z.infer<typeof animeDetailGetInputSchema>
export type AnimePeopleGetInput = z.infer<typeof animePeopleGetInputSchema>
type AnimePeoplePageState =
  | { status: 'ready'; page: AnimePeoplePage<AnimeCharacter> | AnimePeoplePage<AnimeStaff> }
  | { status: 'not-found' }
  | { status: 'error'; code: 'UPSTREAM' | 'RATE_LIMITED'; message: string; retryAfterSeconds: number | null }
type AnimeDetailGetRunner = (input: AnimeDetailGetInput) => Promise<PublicAnimeDetailState>
type AnimePeopleGetRunner = (input: AnimePeopleGetInput) => Promise<AnimePeoplePageState>

/** Runs validated detail GET behavior through an injected serializable runner. */
export const runAnimeDetailGet = async (input: AnimeDetailGetInput, runner: AnimeDetailGetRunner): Promise<PublicAnimeDetailState> => {
  const data = animeDetailGetInputSchema.parse(input)
  return await runner(data)
}

/** Runs validated people GET behavior through an injected serializable runner. */
export const runAnimePeopleGet = async (input: AnimePeopleGetInput, runner: AnimePeopleGetRunner): Promise<AnimePeoplePageState> => {
  const data = animePeopleGetInputSchema.parse(input)
  return await runner(data)
}

/** Returns one validated, serializable public anime detail state. */
export const getAnimeDetail = createServerFn({ method: 'GET' })
  .validator(animeDetailGetInputSchema)
  .handler(async ({ data }) => {
    const cache = await import('./anime-detail-cache.server')
    return await runAnimeDetailGet(
      data,
      async (input) => await cache.getAnimeDetailServer(input.anilistId, cache.createAnimeDetailCacheDependencies()),
    )
  })

/** Returns one validated, serializable Character or Staff page state. */
export const getAnimePeoplePage = createServerFn({ method: 'GET' })
  .validator(animePeopleGetInputSchema)
  .handler(async ({ data }) => {
    const cache = await import('./anime-detail-cache.server')
    return await runAnimePeopleGet(
      data,
      async (input) => await cache.getAnimePeoplePageServer(input.anilistId, input.kind, input.page, cache.createAnimeDetailCacheDependencies()),
    )
  })
