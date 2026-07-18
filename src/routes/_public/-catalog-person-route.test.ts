import { describe, expect, it, vi } from 'vitest'

import type { CatalogPersonState } from '#/features/catalog-person/server/catalog-person-cache.server'
import {
  ensureCatalogPersonChildData,
  getCatalogPersonRedirectHref,
  getCatalogPersonTabNavigation,
  parseCatalogPersonRouteId,
  parseCatalogPersonRouteSearch,
} from '#/features/catalog-person/ui/catalog-person-route'

const ready = (kind: 'character' | 'staff', name: string): CatalogPersonState => ({
  status: 'ready',
  entry: {
    detail: kind === 'character'
      ? { kind, id: 7, name, nativeName: null, imageUrl: null, description: null, age: null, gender: null, birthday: null, bloodType: null }
      : { kind, id: 7, name, nativeName: null, imageUrl: null, description: null, occupations: [], language: null, hometown: null, activeYears: null },
    refreshedAt: 1,
    expiresAt: 2,
  },
})

describe('catalog person routes', () => {
  it('accepts only canonical positive safe integer IDs', () => {
    expect(parseCatalogPersonRouteId('7')).toBe(7)
    for (const value of ['07', '0', '-1', '1.5', '7x', String(Number.MAX_SAFE_INTEGER + 1)]) {
      expect(() => parseCatalogPersonRouteId(value)).toThrow('CATALOG_PERSON_ID_INVALID')
    }
  })

  it('normalizes tabs by person kind and marks explicit or invalid overview for replacement', () => {
    expect(parseCatalogPersonRouteSearch('character', undefined)).toEqual({ tab: 'overview', replace: false })
    expect(parseCatalogPersonRouteSearch('character', 'anime')).toEqual({ tab: 'anime', replace: false })
    expect(parseCatalogPersonRouteSearch('character', 'works')).toEqual({ tab: 'overview', replace: true })
    expect(parseCatalogPersonRouteSearch('staff', 'works')).toEqual({ tab: 'anime', replace: true })
    expect(parseCatalogPersonRouteSearch('staff', 'anime')).toEqual({ tab: 'anime', replace: false })
    expect(parseCatalogPersonRouteSearch('staff', 'overview')).toEqual({ tab: 'overview', replace: true })
  })

  it('replaces missing or stale slugs, preserves valid tabs, and encodes Unicode once', () => {
    expect(getCatalogPersonRedirectHref(ready('character', 'Frieren'), 'character', 7, null, 'anime')).toBe('/characters/7/frieren?tab=anime')
    expect(getCatalogPersonRedirectHref(ready('staff', '山田 太郎'), 'staff', 7, 'old', 'works')).toBe('/staff/7/%E5%B1%B1%E7%94%B0-%E5%A4%AA%E9%83%8E?tab=anime')
    expect(getCatalogPersonRedirectHref(ready('staff', '山田 太郎'), 'staff', 7, '山田-太郎', 'works')).toBe('/staff/7/%E5%B1%B1%E7%94%B0-%E5%A4%AA%E9%83%8E?tab=anime')
  })

  it('corrects invalid search before work tabs and leaves non-ready detail states visible', () => {
    expect(getCatalogPersonRedirectHref(ready('character', 'Frieren'), 'character', 7, 'frieren', 'works')).toBe('/characters/7/frieren')
    expect(getCatalogPersonRedirectHref({ status: 'not-found' }, 'character', 7, null, 'anime')).toBeNull()
    expect(getCatalogPersonRedirectHref({ status: 'error', code: 'UPSTREAM', message: 'Down', retryAfterSeconds: null }, 'staff', 7, 'old', 'works')).toBeNull()
  })

  it('uses push navigation without scroll reset for tab clicks', () => {
    expect(getCatalogPersonTabNavigation('character', 'overview')).toEqual({ search: {}, resetScroll: false })
    expect(getCatalogPersonTabNavigation('character', 'anime')).toEqual({ search: { tab: 'anime' }, resetScroll: false })
    expect(getCatalogPersonTabNavigation('staff', 'anime' as never)).toEqual({ search: { tab: 'anime' }, resetScroll: false })
  })

  it('ensures child detail data with an initially empty query cache', async () => {
    const state = ready('character', 'Frieren')
    const queryClient = { ensureQueryData: vi.fn().mockResolvedValue(state) }
    await expect(ensureCatalogPersonChildData(queryClient, 'character', '7')).resolves.toBe(state)
    expect(queryClient.ensureQueryData).toHaveBeenCalledOnce()
  })
})
