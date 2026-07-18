import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { catalogEntityKindSchema } from '../shared/catalog-identity-contracts'
import type { CatalogRouteIdentity } from './catalog-identity.server'

export const catalogRouteIdentityInputSchema = z.object({
  kind: catalogEntityKindSchema,
  rawId: z.string().trim().min(1).max(128),
}).strict()

export type CatalogRouteIdentityInput = z.infer<typeof catalogRouteIdentityInputSchema>
type CatalogRouteIdentityRunner = (
  input: CatalogRouteIdentityInput,
) => Promise<CatalogRouteIdentity>

/** Runs one validated canonical-or-legacy route identity lookup. */
export const runCatalogRouteIdentity = async (
  input: CatalogRouteIdentityInput,
  runner: CatalogRouteIdentityRunner,
): Promise<CatalogRouteIdentity> => {
  const data = catalogRouteIdentityInputSchema.parse(input)
  return await runner(data)
}

/** Resolves one provider-neutral browser route identity on the server. */
export const getCatalogRouteIdentity = createServerFn({ method: 'GET' })
  .validator(catalogRouteIdentityInputSchema)
  .handler(async ({ data }) => {
    const identity = await import('./catalog-identity.server')
    return await runCatalogRouteIdentity(
      data,
      async (input) => await identity.resolveRouteIdentity(input),
    )
  })
