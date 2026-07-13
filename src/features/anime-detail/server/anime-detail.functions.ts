import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { animePeopleKindSchema } from '../shared/anime-detail-contracts'
import {
  createAnimeDetailCacheDependencies,
  getAnimeDetailServer,
  getAnimePeoplePageServer,
  type AnimeDetailCacheDependencies,
} from './anime-detail-cache.server'

const positiveSafeInteger = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
export const animeDetailGetInputSchema = z.object({ anilistId: positiveSafeInteger }).strict()
export const animePeopleGetInputSchema = z.object({ anilistId: positiveSafeInteger, kind: animePeopleKindSchema, page: positiveSafeInteger }).strict()

type AnimeDetailGetInput = z.infer<typeof animeDetailGetInputSchema>
type AnimePeopleGetInput = z.infer<typeof animePeopleGetInputSchema>

/** Runs validated detail GET behavior with explicit server dependencies. */
export const runAnimeDetailGet = async (input: AnimeDetailGetInput, dependencies: AnimeDetailCacheDependencies) => {
  const data = animeDetailGetInputSchema.parse(input)
  return await getAnimeDetailServer(data.anilistId, dependencies)
}

/** Runs validated people-page GET behavior with explicit server dependencies. */
export const runAnimePeopleGet = async (input: AnimePeopleGetInput, dependencies: AnimeDetailCacheDependencies) => {
  const data = animePeopleGetInputSchema.parse(input)
  return await getAnimePeoplePageServer(data.anilistId, data.kind, data.page, dependencies)
}

/** Returns one validated, serializable public anime detail state. */
export const getAnimeDetail = createServerFn({ method: 'GET' })
  .validator(animeDetailGetInputSchema)
  .handler(async ({ data }) => await runAnimeDetailGet(data, createAnimeDetailCacheDependencies()))

/** Returns one validated, serializable Character or Staff page state. */
export const getAnimePeoplePage = createServerFn({ method: 'GET' })
  .validator(animePeopleGetInputSchema)
  .handler(async ({ data }) => await runAnimePeopleGet(data, createAnimeDetailCacheDependencies()))
