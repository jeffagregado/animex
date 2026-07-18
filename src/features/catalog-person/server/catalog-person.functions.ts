import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { parseCatalogPublicId } from '../../catalog-identity/shared/catalog-identity-contracts'
import { catalogPersonKindSchema, type CatalogPersonSearchPage } from '../shared/catalog-person-contracts'
import { type CatalogPersonState, type CatalogPersonWorksState } from './catalog-person-cache.server'

const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const publicIdSchema = z.string().transform((value, context) => {
  try {
    return parseCatalogPublicId(value)
  } catch {
    context.addIssue({ code: 'custom', message: 'CATALOG_PUBLIC_ID_INVALID' })
    return z.NEVER
  }
})
export const catalogPersonGetInputSchema = z.object({
  kind: catalogPersonKindSchema,
  publicId: publicIdSchema,
}).strict()
export const catalogPersonWorksInputSchema = z.object({
  kind: catalogPersonKindSchema,
  publicId: publicIdSchema,
  page: positive,
}).strict()
export const catalogPersonSearchInputSchema = z.object({
  kind: catalogPersonKindSchema,
  query: z.string().transform((value) => value.trim()).pipe(z.string().min(2).max(100)),
  page: positive,
}).strict()

export type CatalogPersonGetInput = z.infer<typeof catalogPersonGetInputSchema>
type CatalogPersonWorksInput = z.infer<typeof catalogPersonWorksInputSchema>
export type CatalogPersonSearchInput = z.infer<typeof catalogPersonSearchInputSchema>

/** Runs validated person detail through injected server behavior. */
export const runCatalogPersonGet = async (input: CatalogPersonGetInput, runner: (input: CatalogPersonGetInput) => Promise<CatalogPersonState>): Promise<CatalogPersonState> => {
  return await runner(catalogPersonGetInputSchema.parse(input))
}

/** Runs validated person work through injected server behavior. */
const runCatalogPersonWorks = async (input: CatalogPersonWorksInput, runner: (input: CatalogPersonWorksInput) => Promise<CatalogPersonWorksState>): Promise<CatalogPersonWorksState> => {
  return await runner(catalogPersonWorksInputSchema.parse(input))
}

/** Runs validated uncached search through injected server behavior. */
export const runCatalogPersonSearch = async (input: CatalogPersonSearchInput, runner: (input: CatalogPersonSearchInput) => Promise<CatalogPersonSearchPage>): Promise<CatalogPersonSearchPage> => {
  return await runner(catalogPersonSearchInputSchema.parse(input))
}

export const getCatalogPerson = createServerFn({ method: 'GET' })
  .validator(catalogPersonGetInputSchema)
  .handler(async ({ data }) => {
    const cache = await import('./catalog-person-cache.server')
    return await runCatalogPersonGet(data, async (input) => await cache.getCatalogPersonServer(input.kind, input.publicId, cache.createCatalogPersonCacheDependencies()))
  })

export const getCatalogPersonWorks = createServerFn({ method: 'GET' })
  .validator(catalogPersonWorksInputSchema)
  .handler(async ({ data }) => {
    const cache = await import('./catalog-person-cache.server')
    return await runCatalogPersonWorks(data, async (input) => await cache.getCatalogPersonWorksServer(input.kind, input.publicId, input.page, cache.createCatalogPersonCacheDependencies()))
  })

export const searchCatalogPeople = createServerFn({ method: 'GET' })
  .validator(catalogPersonSearchInputSchema)
  .handler(async ({ data }) => {
    const provider = await import('./anilist-person.server')
    const client = await import('../../../lib/anilist-client.server')
    const identity = await import('../../catalog-identity/server/catalog-identity.server')
    const mapper = await import('./catalog-person-public.server')
    return await runCatalogPersonSearch(data, async (input) => {
      const page = await provider.searchCatalogPeopleFromAniList(
        input.kind,
        input.query,
        input.page,
        client.createAniListDependencies(),
      )
      return await mapper.mapCatalogPersonSearchPage(page, identity.ensurePublicIds)
    })
  })
