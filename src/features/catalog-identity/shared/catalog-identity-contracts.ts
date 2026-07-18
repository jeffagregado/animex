import { z } from 'zod'

export const catalogEntityKindSchema = z.enum(['anime', 'character', 'staff'])
export type CatalogEntityKind = z.infer<typeof catalogEntityKindSchema>
export type CatalogPublicId = string

const catalogPublicIdSchema = z.string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^(?![1-9]\d*$)[A-Za-z0-9_-]+$/)

/** Parses an opaque serialized catalog entity ID. */
export const parseCatalogPublicId = (value: unknown): CatalogPublicId => {
  const result = catalogPublicIdSchema.safeParse(value)
  if (!result.success) {
    throw new RangeError('CATALOG_PUBLIC_ID_INVALID', { cause: result.error })
  }
  return result.data
}
