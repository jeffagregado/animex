import { ConvexError, v } from 'convex/values'

import { type CatalogEntityKind } from '../src/features/catalog-identity/shared/catalog-identity-contracts'
import { type Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { requireCacheWriteToken } from './animeCache'
import {
  CatalogIdentityModelError,
  ensureCatalogEntity,
  resolveProviderByCatalogPublicId,
  resolveProviderRef,
} from './catalogIdentityModel'
import {
  CatalogIdentityPolicyError,
  validateProviderRefBatch,
} from './catalogIdentityPolicy'

const catalogEntityKindValidator = v.union(
  v.literal('anime'),
  v.literal('character'),
  v.literal('staff'),
)

const providerRefValidator = v.object({
  provider: v.literal('anilist'),
  kind: catalogEntityKindValidator,
  providerId: v.number(),
})

const publicIdentityValidator = v.object({
  publicId: v.id('catalogEntities'),
  kind: catalogEntityKindValidator,
})

type PublicIdentity = {
  publicId: Id<'catalogEntities'>
  kind: CatalogEntityKind
}

/** Converts identity-domain failures into explicit client-safe errors. */
const throwIdentityError = (error: unknown): never => {
  if (error instanceof CatalogIdentityPolicyError || error instanceof CatalogIdentityModelError) {
    throw new ConvexError({ code: error.code, message: error.message })
  }
  throw error
}

/** Materializes a bounded provider batch while preserving input order. */
export const ensureProviderRefs = mutation({
  args: {
    token: v.string(),
    refs: v.array(providerRefValidator),
  },
  returns: v.array(publicIdentityValidator),
  handler: async (ctx, args): Promise<PublicIdentity[]> => {
    requireCacheWriteToken(args.token)
    try {
      validateProviderRefBatch(args.refs)
      const identities: PublicIdentity[] = []
      for (const ref of args.refs) {
        const entityId = await ensureCatalogEntity(ctx, ref)
        identities.push({ publicId: entityId, kind: ref.kind })
      }
      return identities
    } catch (error) {
      return throwIdentityError(error)
    }
  },
})

/** Resolves a bounded provider batch without creating missing identities. */
export const resolveProviderRefs = query({
  args: {
    token: v.string(),
    refs: v.array(providerRefValidator),
  },
  returns: v.array(publicIdentityValidator),
  handler: async (ctx, args): Promise<PublicIdentity[]> => {
    requireCacheWriteToken(args.token)
    try {
      validateProviderRefBatch(args.refs)
      const identities: PublicIdentity[] = []
      for (const ref of args.refs) {
        const entityId = await resolveProviderRef(ctx, ref)
        if (!entityId) {
          throw new CatalogIdentityModelError(
            'CATALOG_PROVIDER_REF_MISSING',
            `Provider tuple ${ref.provider}:${ref.kind}:${ref.providerId} has no catalog identity.`,
          )
        }
        identities.push({ publicId: entityId, kind: ref.kind })
      }
      return identities
    } catch (error) {
      return throwIdentityError(error)
    }
  },
})

/** Reverse-resolves one public ID for token-gated server metadata reads. */
export const resolveProviderByPublicId = query({
  args: {
    token: v.string(),
    publicId: v.string(),
    kind: catalogEntityKindValidator,
  },
  returns: providerRefValidator,
  handler: async (ctx, args) => {
    requireCacheWriteToken(args.token)
    try {
      return await resolveProviderByCatalogPublicId(ctx, args.publicId, args.kind)
    } catch (error) {
      return throwIdentityError(error)
    }
  },
})
