import { describe, expect, test } from 'vitest'

import {
  catalogPersonGetInputSchema,
  catalogPersonSearchInputSchema,
  catalogPersonWorksInputSchema,
  getCatalogPerson,
  getCatalogPersonWorks,
  runCatalogPersonGet,
  runCatalogPersonSearch,
  searchCatalogPeople,
} from './catalog-person.functions'

describe('catalog person server functions', () => {
  test('exports strict GET functions and trims local search input', () => {
    expect(getCatalogPerson).toBeTypeOf('function')
    expect(getCatalogPersonWorks).toBeTypeOf('function')
    expect(searchCatalogPeople).toBeTypeOf('function')
    expect(catalogPersonGetInputSchema.parse({ kind: 'character', publicId: 'character_12' })).toEqual({ kind: 'character', publicId: 'character_12' })
    expect(catalogPersonWorksInputSchema.parse({ kind: 'staff', publicId: 'staff_21', page: 2 })).toEqual({ kind: 'staff', publicId: 'staff_21', page: 2 })
    expect(catalogPersonSearchInputSchema.parse({ kind: 'staff', query: '  name  ', page: 1 })).toEqual({ kind: 'staff', query: 'name', page: 1 })
    expect(() => catalogPersonSearchInputSchema.parse({ kind: 'staff', query: 'x', page: 0 })).toThrow()
    expect(() => catalogPersonGetInputSchema.parse({ kind: 'character', publicId: '12' })).toThrow('CATALOG_PUBLIC_ID_INVALID')
    expect(() => catalogPersonGetInputSchema.parse({ kind: 'character', id: 12 })).toThrow()
    expect(() => catalogPersonGetInputSchema.parse({ kind: 'character', publicId: 'character_12', providerId: 12 })).toThrow()
  })

  test('returns serialized states without provider fields', async () => {
    const ready = await runCatalogPersonGet({ kind: 'character', publicId: 'character_12' }, async () => ({
      status: 'ready', entry: { detail: { kind: 'character', publicId: 'character_12', name: 'Frieren', nativeName: null, imageUrl: null, description: null, age: null, gender: null, birthday: null, bloodType: null, voiceActorScope: 'all-languages', voiceActors: [] }, refreshedAt: 1, expiresAt: 2 },
    }))
    const search = await runCatalogPersonSearch({ kind: 'character', query: 'frieren', page: 1 }, async () => ({
      items: [], currentPage: 1, hasNextPage: false, perPage: 20,
    }))
    expect(JSON.parse(JSON.stringify(ready))).toEqual(ready)
    expect(JSON.parse(JSON.stringify(search))).toEqual(search)
    expect(ready).not.toHaveProperty('provider')
  })
})
