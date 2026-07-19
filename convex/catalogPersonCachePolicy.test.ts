import { describe, expect, test } from 'vitest'

import {
  CATALOG_PERSON_CACHE_TTL_MS,
  CATALOG_PERSON_LEASE_MS,
  assertCatalogPersonLease,
  createCatalogPersonTiming,
  decideCatalogPersonLease,
  decideCatalogPersonLeaseRelease,
  personDetailKey,
  personWorkKey,
  resolveCatalogPersonRead,
  validateCatalogPersonDetail,
  validateCatalogPersonWorkPage,
} from './catalogPersonCachePolicy'

describe('catalog person cache policy', () => {
  test('locks exact TTL, lease, and cache keys', () => {
    expect(CATALOG_PERSON_CACHE_TTL_MS).toBe(86_400_000)
    expect(CATALOG_PERSON_LEASE_MS).toBe(60_000)
    expect(createCatalogPersonTiming(5)).toEqual({ refreshedAt: 5, expiresAt: 86_400_005 })
    expect(personDetailKey('character', 12)).toBe('person:character:12')
    expect(personWorkKey('staff', 21, 2)).toBe('person-work:staff:21:2')
  })

  test('never exposes entries at or after exact expiry', () => {
    const entry = { payload: 'value', refreshedAt: 1, expiresAt: 10 }
    expect(resolveCatalogPersonRead(entry, 9).status).toBe('fresh')
    expect(resolveCatalogPersonRead(entry, 10)).toEqual({ status: 'expired', entry: null })
    expect(resolveCatalogPersonRead(null, 10)).toEqual({ status: 'missing', entry: null })
  })

  test('enforces lease ownership and active windows', () => {
    expect(decideCatalogPersonLease(null, 'owner', 10, 70)).toEqual({ acquired: true, leaseUntil: 70 })
    expect(decideCatalogPersonLease({ leaseId: 'other', leaseUntil: 70 }, 'owner', 10, 70)).toEqual({ acquired: false, leaseUntil: 70 })
    expect(() => assertCatalogPersonLease({ leaseId: 'other', leaseUntil: 70 }, 'owner', 10)).toThrow('another worker')
    expect(() => assertCatalogPersonLease({ leaseId: 'owner', leaseUntil: 10 }, 'owner', 10)).toThrow('missing or expired')
    expect(decideCatalogPersonLeaseRelease({ leaseId: 'owner', leaseUntil: 70 }, 'owner', 10)).toBe(true)
  })

  test('validates strict details and bounded ordered work rows', () => {
    const detail = {
      kind: 'character',
      id: 12,
      name: 'Frieren',
      nativeName: null,
      imageUrl: null,
      description: null,
      age: null,
      gender: null,
      birthday: null,
      bloodType: null,
      voiceActorScope: 'all-languages',
      voiceActors: [
        {
          id: 21,
          name: 'Atsumi Tanezaki',
          imageUrl: null,
          language: 'Japanese',
        },
        {
          id: 22,
          name: 'English Actor',
          imageUrl: null,
          language: 'English',
        },
      ],
    }
    expect(() => validateCatalogPersonDetail('character', 12, detail)).not.toThrow()
    expect(() => validateCatalogPersonDetail('staff', 12, detail)).toThrow()
    expect(() => validateCatalogPersonDetail('character', 12, {
      ...detail,
      voiceActors: Array.from({ length: 100 }, (_, index) => ({
        id: index + 1,
        name: `Actor ${index + 1}`,
        imageUrl: null,
        language: 'Japanese',
      })),
    })).not.toThrow()
    expect(() => validateCatalogPersonWorkPage('character', 12, 1, Array.from({ length: 21 }, () => ({ animeId: 1, role: null })))).toThrow()
    expect(() => validateCatalogPersonWorkPage('character', 12, 1, [{ animeId: 0, role: null }])).toThrow()
  })
})
