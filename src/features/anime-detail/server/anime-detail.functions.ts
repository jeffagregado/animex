import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { parseCatalogPublicId } from '../../catalog-identity/shared/catalog-identity-contracts'
import {
  animePeopleKindSchema,
  type AnimeCharacter,
  type AnimePeoplePage,
  type AnimeStaff,
  type PublicAnimeDetailState,
} from '../shared/anime-detail-contracts'

const positiveSafeInteger = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const publicIdSchema = z.string().transform((value, context) => {
  try {
    return parseCatalogPublicId(value)
  } catch {
    context.addIssue({ code: 'custom', message: 'CATALOG_PUBLIC_ID_INVALID' })
    return z.NEVER
  }
})
export const animeDetailGetInputSchema = z.object({ publicId: publicIdSchema }).strict()
export const animePeopleGetInputSchema = z.object({ publicId: publicIdSchema, kind: animePeopleKindSchema, page: positiveSafeInteger }).strict()

export type AnimeDetailGetInput = z.infer<typeof animeDetailGetInputSchema>
export type AnimePeopleGetInput = z.infer<typeof animePeopleGetInputSchema>
type AnimePeoplePageState =
  | { status: 'ready'; page: AnimePeoplePage<AnimeCharacter> | AnimePeoplePage<AnimeStaff> }
  | { status: 'not-found' }
  | { status: 'error'; code: 'UPSTREAM' | 'RATE_LIMITED' | 'CATALOG_IDENTITY_MISSING'; message: string; retryAfterSeconds: number | null }
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
      async (input) => await cache.getAnimeDetailServer(input.publicId, cache.createAnimeDetailCacheDependencies()),
    )
  })

/** Returns one validated, serializable Character or Staff page state. */
export const getAnimePeoplePage = createServerFn({ method: 'GET' })
  .validator(animePeopleGetInputSchema)
  .handler(async ({ data }) => {
    const cache = await import('./anime-detail-cache.server')
    return await runAnimePeopleGet(
      data,
      async (input) => await cache.getAnimePeoplePageServer(input.publicId, input.kind, input.page, cache.createAnimeDetailCacheDependencies()),
    )
  })
