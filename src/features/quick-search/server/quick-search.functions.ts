import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import type { QuickCatalogSearchResult } from './anilist-quick-search.server'

export interface QuickCatalogSearchInput {
  query: string
}

export const quickCatalogSearchInputSchema: z.ZodType<QuickCatalogSearchInput> = z.object({
  query: z.string()
    .transform((value) => value.trim())
    .pipe(z.string().min(2).max(100)),
}).strict()

/** Runs one validated provider search through injected server behavior. */
export const runQuickCatalogSearch = async (
  input: QuickCatalogSearchInput,
  runner: (input: QuickCatalogSearchInput) => Promise<QuickCatalogSearchResult>,
): Promise<QuickCatalogSearchResult> => {
  return await runner(quickCatalogSearchInputSchema.parse(input))
}

export const searchQuickCatalog = createServerFn({ method: 'GET' })
  .validator(quickCatalogSearchInputSchema)
  .handler(async ({ data }) => {
    const provider = await import('./anilist-quick-search.server')
    const client = await import('../../../lib/anilist-client.server')
    return await runQuickCatalogSearch(
      data,
      async (input) => await provider.searchQuickCatalogFromAniList(
        input.query,
        client.createAniListDependencies(),
      ),
    )
  })
