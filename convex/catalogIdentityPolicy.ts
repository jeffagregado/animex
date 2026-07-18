import { type CatalogEntityKind } from '../src/features/catalog-identity/shared/catalog-identity-contracts'

export const CATALOG_PROVIDER_REF_BATCH_MAX = 100

export type CatalogProviderRef = {
  provider: 'anilist'
  kind: CatalogEntityKind
  providerId: number
}

type CatalogIdentityPolicyErrorCode =
  | 'CATALOG_ENTITY_KIND_CONFLICT'
  | 'CATALOG_ENTITY_PROVIDER_CONFLICT'
  | 'PROVIDER_REF_BATCH_LIMIT_EXCEEDED'
  | 'PROVIDER_REF_DUPLICATE'
  | 'PROVIDER_REF_INVALID'
  | 'PROVIDER_REFS_EMPTY'

export class CatalogIdentityPolicyError extends Error {
  readonly code: CatalogIdentityPolicyErrorCode

  constructor(code: CatalogIdentityPolicyErrorCode, message: string) {
    super(message)
    this.name = 'CatalogIdentityPolicyError'
    this.code = code
  }
}

/** Validates one server-only provider reference. */
const validateProviderRef = (ref: CatalogProviderRef): void => {
  const validKind = ref.kind === 'anime' || ref.kind === 'character' || ref.kind === 'staff'
  if (
    ref.provider !== 'anilist'
    || !validKind
    || !Number.isSafeInteger(ref.providerId)
    || ref.providerId <= 0
  ) {
    throw new CatalogIdentityPolicyError(
      'PROVIDER_REF_INVALID',
      'Provider reference must use AniList, a supported kind, and a positive safe integer ID.',
    )
  }
}

/** Validates a bounded, ordered batch with no repeated provider tuple. */
export const validateProviderRefBatch = (refs: readonly CatalogProviderRef[]): void => {
  if (refs.length === 0) {
    throw new CatalogIdentityPolicyError(
      'PROVIDER_REFS_EMPTY',
      'Provider reference batch must contain at least one item.',
    )
  }
  if (refs.length > CATALOG_PROVIDER_REF_BATCH_MAX) {
    throw new CatalogIdentityPolicyError(
      'PROVIDER_REF_BATCH_LIMIT_EXCEEDED',
      `Provider reference batch cannot exceed ${CATALOG_PROVIDER_REF_BATCH_MAX} items.`,
    )
  }

  const keys = new Set<string>()
  for (const ref of refs) {
    validateProviderRef(ref)
    const key = `${ref.provider}:${ref.kind}:${ref.providerId}`
    if (keys.has(key)) {
      throw new CatalogIdentityPolicyError(
        'PROVIDER_REF_DUPLICATE',
        `Provider reference batch repeats ${key}.`,
      )
    }
    keys.add(key)
  }
}

/** Prevents one entity from changing kind or acquiring a second provider slot. */
export const assertEntityAcceptsProviderRef = (
  entityKind: CatalogEntityKind,
  currentRef: CatalogProviderRef | null,
  ref: CatalogProviderRef,
): void => {
  validateProviderRef(ref)
  if (entityKind !== ref.kind) {
    throw new CatalogIdentityPolicyError(
      'CATALOG_ENTITY_KIND_CONFLICT',
      `Catalog entity kind ${entityKind} cannot accept ${ref.kind}.`,
    )
  }
  if (
    currentRef
    && (
      currentRef.provider !== ref.provider
      || currentRef.kind !== ref.kind
      || currentRef.providerId !== ref.providerId
    )
  ) {
    throw new CatalogIdentityPolicyError(
      'CATALOG_ENTITY_PROVIDER_CONFLICT',
      `Catalog entity already has a different ${ref.provider} reference.`,
    )
  }
}
