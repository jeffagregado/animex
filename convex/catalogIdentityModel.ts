import { type CatalogPublicId, parseCatalogPublicId } from '../src/features/catalog-identity/shared/catalog-identity-contracts'
import { type Doc, type Id } from './_generated/dataModel'
import { type MutationCtx, type QueryCtx } from './_generated/server'
import {
  CatalogIdentityPolicyError,
  type CatalogProviderRef,
  assertEntityAcceptsProviderRef,
} from './catalogIdentityPolicy'

type CatalogIdentityReader = Pick<QueryCtx, 'db'>

type CatalogIdentityModelErrorCode =
  | 'CATALOG_ENTITY_MISSING'
  | 'CATALOG_PROVIDER_REF_CONFLICT'
  | 'CATALOG_PROVIDER_REF_MISSING'
  | 'CATALOG_PUBLIC_ID_INVALID'
  | 'CATALOG_PUBLIC_ID_MISSING'

export class CatalogIdentityModelError extends Error {
  readonly code: CatalogIdentityModelErrorCode

  constructor(code: CatalogIdentityModelErrorCode, message: string) {
    super(message)
    this.name = 'CatalogIdentityModelError'
    this.code = code
  }
}

/** Reads at most two rows so tuple corruption fails explicitly. */
const findProviderRows = async (
  ctx: CatalogIdentityReader,
  ref: CatalogProviderRef,
): Promise<Doc<'catalogProviderRefs'>[]> => await ctx.db
  .query('catalogProviderRefs')
  .withIndex('by_provider_kind_id', (q) => q
    .eq('provider', ref.provider)
    .eq('kind', ref.kind)
    .eq('providerId', ref.providerId))
  .take(2)

/** Verifies a stored mapping agrees with its entity and sole provider slot. */
const validateStoredMapping = async (
  ctx: CatalogIdentityReader,
  mapping: Doc<'catalogProviderRefs'>,
  ref: CatalogProviderRef,
): Promise<Id<'catalogEntities'>> => {
  const entity = await ctx.db.get('catalogEntities', mapping.entityId)
  if (!entity) {
    throw new CatalogIdentityModelError(
      'CATALOG_ENTITY_MISSING',
      `Catalog provider reference points to missing entity ${mapping.entityId}.`,
    )
  }

  const entityRefs = await ctx.db
    .query('catalogProviderRefs')
    .withIndex('by_entity_provider', (q) => q
      .eq('entityId', mapping.entityId)
      .eq('provider', ref.provider))
    .take(2)
  if (entityRefs.length > 1) {
    throw new CatalogIdentityPolicyError(
      'CATALOG_ENTITY_PROVIDER_CONFLICT',
      `Catalog entity ${mapping.entityId} has multiple ${ref.provider} references.`,
    )
  }

  assertEntityAcceptsProviderRef(entity.kind, {
    provider: mapping.provider,
    kind: mapping.kind,
    providerId: mapping.providerId,
  }, ref)
  return mapping.entityId
}

/** Resolves one provider tuple through its composite index. */
export const resolveProviderRef = async (
  ctx: CatalogIdentityReader,
  ref: CatalogProviderRef,
): Promise<Id<'catalogEntities'> | null> => {
  assertEntityAcceptsProviderRef(ref.kind, null, ref)
  const rows = await findProviderRows(ctx, ref)
  if (rows.length > 1) {
    throw new CatalogIdentityModelError(
      'CATALOG_PROVIDER_REF_CONFLICT',
      `Provider tuple ${ref.provider}:${ref.kind}:${ref.providerId} has multiple mappings.`,
    )
  }
  const mapping = rows[0]
  return mapping ? await validateStoredMapping(ctx, mapping, ref) : null
}

/** Resolves one opaque public ID after Convex table-ID normalization. */
export const resolveCatalogEntityByPublicId = async (
  ctx: CatalogIdentityReader,
  publicId: CatalogPublicId,
): Promise<Doc<'catalogEntities'>> => {
  let parsedPublicId: CatalogPublicId
  try {
    parsedPublicId = parseCatalogPublicId(publicId)
  } catch (error) {
    throw new CatalogIdentityModelError(
      'CATALOG_PUBLIC_ID_INVALID',
      error instanceof Error ? error.message : 'Catalog public ID is invalid.',
    )
  }
  const entityId = ctx.db.normalizeId('catalogEntities', parsedPublicId)
  if (!entityId) {
    throw new CatalogIdentityModelError(
      'CATALOG_PUBLIC_ID_INVALID',
      'Catalog public ID is not a valid catalog entity ID.',
    )
  }
  const entity = await ctx.db.get('catalogEntities', entityId)
  if (!entity) {
    throw new CatalogIdentityModelError(
      'CATALOG_PUBLIC_ID_MISSING',
      `Catalog entity ${publicId} does not exist.`,
    )
  }
  return entity
}

/** Ensures one stable entity exists for a provider tuple. */
export const ensureCatalogEntity = async (
  ctx: MutationCtx,
  ref: CatalogProviderRef,
): Promise<Id<'catalogEntities'>> => {
  const current = await resolveProviderRef(ctx, ref)
  if (current) return current

  const now = Date.now()
  const entityId = await ctx.db.insert('catalogEntities', {
    kind: ref.kind,
    createdAt: now,
    updatedAt: now,
  })
  await ctx.db.insert('catalogProviderRefs', {
    entityId,
    ...ref,
    createdAt: now,
    updatedAt: now,
  })
  return entityId
}
