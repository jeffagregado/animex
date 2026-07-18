import { describe, expect, test } from 'vitest'

import {
  CATALOG_PROVIDER_REF_BATCH_MAX,
  CatalogIdentityPolicyError,
  assertEntityAcceptsProviderRef,
  validateProviderRefBatch,
} from './catalogIdentityPolicy'

const ref = (providerId: number, kind: 'anime' | 'character' | 'staff' = 'anime') => ({
  provider: 'anilist' as const,
  kind,
  providerId,
})

const getPolicyError = (callback: () => void): CatalogIdentityPolicyError => {
  try {
    callback()
  } catch (error) {
    expect(error).toBeInstanceOf(CatalogIdentityPolicyError)
    return error as CatalogIdentityPolicyError
  }
  throw new Error('Expected catalog identity policy to reject input.')
}

describe('catalog identity policy', () => {
  test('accepts bounded unique positive provider references', () => {
    expect(() => validateProviderRefBatch([ref(1), ref(2, 'character')])).not.toThrow()
  })

  test('rejects empty and invalid provider reference batches', () => {
    expect(getPolicyError(() => validateProviderRefBatch([])).code)
      .toBe('PROVIDER_REFS_EMPTY')
    expect(getPolicyError(() => validateProviderRefBatch([ref(0)])).code)
      .toBe('PROVIDER_REF_INVALID')
    expect(getPolicyError(() => validateProviderRefBatch([ref(Number.MAX_SAFE_INTEGER + 1)])).code)
      .toBe('PROVIDER_REF_INVALID')
  })

  test('rejects duplicate and oversized provider reference batches', () => {
    expect(getPolicyError(() => validateProviderRefBatch([ref(1), ref(1)])).code)
      .toBe('PROVIDER_REF_DUPLICATE')
    const oversized = Array.from(
      { length: CATALOG_PROVIDER_REF_BATCH_MAX + 1 },
      (_, index) => ref(index + 1),
    )
    expect(getPolicyError(() => validateProviderRefBatch(oversized)).code)
      .toBe('PROVIDER_REF_BATCH_LIMIT_EXCEEDED')
  })

  test('keeps entity kinds and AniList provider slots immutable', () => {
    expect(getPolicyError(() => assertEntityAcceptsProviderRef(
      'character',
      null,
      ref(1, 'staff'),
    )).code).toBe('CATALOG_ENTITY_KIND_CONFLICT')
    expect(getPolicyError(() => assertEntityAcceptsProviderRef(
      'character',
      ref(1, 'character'),
      ref(2, 'character'),
    )).code).toBe('CATALOG_ENTITY_PROVIDER_CONFLICT')
    expect(() => assertEntityAcceptsProviderRef(
      'character',
      ref(1, 'character'),
      ref(1, 'character'),
    )).not.toThrow()
  })
})
