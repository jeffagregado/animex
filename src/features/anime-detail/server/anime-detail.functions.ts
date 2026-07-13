import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { animePeopleKindSchema } from '../shared/anime-detail-contracts'
import { createAnimeDetailCacheDependencies, getAnimeDetailServer, getAnimePeoplePageServer } from './anime-detail-cache.server'

const positiveSafeInteger = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const detailInputSchema = z.object({ anilistId: positiveSafeInteger }).strict()
const peopleInputSchema = z.object({ anilistId: positiveSafeInteger, kind: animePeopleKindSchema, page: positiveSafeInteger }).strict()

/** Returns one validated, serializable public anime detail state. */
export const getAnimeDetail = createServerFn({ method: 'GET' })
  .validator(detailInputSchema)
  .handler(async ({ data }) => await getAnimeDetailServer(data.anilistId, createAnimeDetailCacheDependencies()))

/** Returns one validated, serializable Character or Staff page state. */
export const getAnimePeoplePage = createServerFn({ method: 'GET' })
  .validator(peopleInputSchema)
  .handler(async ({ data }) => await getAnimePeoplePageServer(data.anilistId, data.kind, data.page, createAnimeDetailCacheDependencies()))
