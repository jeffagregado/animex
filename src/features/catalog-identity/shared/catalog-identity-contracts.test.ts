import { describe, expect, test } from 'vitest'

import { parseCatalogPublicId } from './catalog-identity-contracts'

describe('catalog identity contracts', () => {
  test('accepts an opaque serialized catalog entity ID', () => {
    expect(parseCatalogPublicId('jh7abc123')).toBe('jh7abc123')
  })

  test('rejects positive decimal legacy IDs as canonical public IDs', () => {
    expect(() => parseCatalogPublicId('52991')).toThrow('CATALOG_PUBLIC_ID_INVALID')
  })

  test('rejects public IDs containing route separators', () => {
    expect(() => parseCatalogPublicId('bad/id')).toThrow('CATALOG_PUBLIC_ID_INVALID')
  })
})
