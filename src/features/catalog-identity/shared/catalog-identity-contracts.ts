import { z } from 'zod'

export const catalogEntityKindSchema = z.enum(['anime', 'character', 'staff'])
export type CatalogEntityKind = z.infer<typeof catalogEntityKindSchema>
export type CatalogPublicId = string

const catalogPublicIdSchema = z.string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^(?!\d+$)[A-Za-z0-9_-]+$/)

export type CatalogRouteId =
  | { source: 'public'; publicId: CatalogPublicId }
  | { source: 'legacy'; providerId: number }

/** Parses an opaque serialized catalog entity ID. */
export const parseCatalogPublicId = (value: unknown): CatalogPublicId => {
  const result = catalogPublicIdSchema.safeParse(value)
  if (!result.success) {
    throw new RangeError('CATALOG_PUBLIC_ID_INVALID')
  }
  return result.data
}

/** Classifies one route segment without treating invalid decimals as public IDs. */
export const classifyCatalogRouteId = (value: unknown): CatalogRouteId => {
  if (typeof value !== 'string') throw new RangeError('CATALOG_ROUTE_ID_INVALID')
  const normalized = value.trim()
  if (/^[1-9]\d*$/.test(normalized)) {
    const providerId = Number(normalized)
    if (Number.isSafeInteger(providerId)) return { source: 'legacy', providerId }
    throw new RangeError('CATALOG_ROUTE_ID_INVALID')
  }
  if (/^\d+$/.test(normalized)) throw new RangeError('CATALOG_ROUTE_ID_INVALID')
  try {
    return { source: 'public', publicId: parseCatalogPublicId(normalized) }
  } catch {
    throw new RangeError('CATALOG_ROUTE_ID_INVALID')
  }
}
