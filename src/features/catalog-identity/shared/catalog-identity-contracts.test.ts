import { describe, expect, test } from 'vitest'

import {
  classifyCatalogRouteId,
  parseCatalogPublicId,
} from './catalog-identity-contracts'

describe('catalog identity contracts', () => {
  test('accepts an opaque serialized catalog entity ID', () => {
    expect(parseCatalogPublicId('jh7abc123')).toBe('jh7abc123')
  })

  test.each(['52991', '0', '01', '9007199254740992'])(
    'rejects every digit-only value as a canonical public ID: %s',
    (value) => {
      expect(() => parseCatalogPublicId(value)).toThrow('CATALOG_PUBLIC_ID_INVALID')
    },
  )

  test('classifies only positive safe decimals without leading zero as legacy', () => {
    expect(classifyCatalogRouteId('52991')).toEqual({ source: 'legacy', providerId: 52991 })
    expect(() => classifyCatalogRouteId('0')).toThrow('CATALOG_ROUTE_ID_INVALID')
    expect(() => classifyCatalogRouteId('01')).toThrow('CATALOG_ROUTE_ID_INVALID')
    expect(() => classifyCatalogRouteId('9007199254740992')).toThrow('CATALOG_ROUTE_ID_INVALID')
  })

  test('classifies opaque public IDs separately from legacy IDs', () => {
    expect(classifyCatalogRouteId('jh7abc123')).toEqual({
      source: 'public',
      publicId: 'jh7abc123',
    })
  })

  test('rejects public IDs containing route separators', () => {
    expect(() => parseCatalogPublicId('bad/id')).toThrow('CATALOG_PUBLIC_ID_INVALID')
  })
})
