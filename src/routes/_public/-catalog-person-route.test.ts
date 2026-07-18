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
      ? { kind, publicId: 'character_frieren', name, nativeName: null, imageUrl: null, description: null, age: null, gender: null, birthday: null, bloodType: null, voiceActorScope: 'all-languages', voiceActors: [] }
      : { kind, publicId: 'staff_yamada', name, nativeName: null, imageUrl: null, description: null, occupations: [], language: null, hometown: null, activeYears: null },
    refreshedAt: 1,
    expiresAt: 2,
  },
})

describe('catalog person routes', () => {
  it('accepts only opaque canonical public IDs', () => {
    expect(parseCatalogPersonRouteId('character_frieren')).toBe('character_frieren')
    for (const value of ['07', '0', '1.5', '7 x']) {
      expect(() => parseCatalogPersonRouteId(value)).toThrow('CATALOG_PUBLIC_ID_INVALID')
    }
  })

  it('normalizes tabs by person kind and marks explicit or invalid overview for replacement', () => {
    expect(parseCatalogPersonRouteSearch('character', undefined)).toEqual({ tab: 'overview', replace: false })
    expect(parseCatalogPersonRouteSearch('character', 'anime')).toEqual({ tab: 'anime', replace: false })
    expect(parseCatalogPersonRouteSearch('character', 'voice-actors')).toEqual({ tab: 'voice-actors', replace: false })
    expect(parseCatalogPersonRouteSearch('character', 'works')).toEqual({ tab: 'overview', replace: true })
    expect(parseCatalogPersonRouteSearch('staff', 'works')).toEqual({ tab: 'anime', replace: true })
    expect(parseCatalogPersonRouteSearch('staff', 'anime')).toEqual({ tab: 'anime', replace: false })
    expect(parseCatalogPersonRouteSearch('staff', 'voice-actors')).toEqual({ tab: 'overview', replace: true })
    expect(parseCatalogPersonRouteSearch('staff', 'overview')).toEqual({ tab: 'overview', replace: true })
  })

  it('replaces missing or stale slugs, preserves valid tabs, and encodes Unicode once', () => {
    expect(getCatalogPersonRedirectHref(ready('character', 'Frieren'), 'character', '123', null, 'anime')).toBe('/characters/character_frieren/frieren?tab=anime')
    expect(getCatalogPersonRedirectHref(ready('character', 'Frieren'), 'character', '123', 'frieren', 'anime')).toBe('/characters/character_frieren/frieren?tab=anime')
    expect(getCatalogPersonRedirectHref(ready('character', 'Frieren'), 'character', 'character_frieren', null, 'voice-actors')).toBe('/characters/character_frieren/frieren?tab=voice-actors')
    expect(getCatalogPersonRedirectHref(ready('staff', '山田 太郎'), 'staff', '700', '山田-太郎', 'works')).toBe('/staff/staff_yamada/%E5%B1%B1%E7%94%B0-%E5%A4%AA%E9%83%8E?tab=anime')
    expect(getCatalogPersonRedirectHref(ready('staff', '山田 太郎'), 'staff', '700', null, undefined)).toBe('/staff/staff_yamada/%E5%B1%B1%E7%94%B0-%E5%A4%AA%E9%83%8E')
    expect(getCatalogPersonRedirectHref(ready('staff', '山田 太郎'), 'staff', 'staff_yamada', 'old', 'works')).toBe('/staff/staff_yamada/%E5%B1%B1%E7%94%B0-%E5%A4%AA%E9%83%8E?tab=anime')
    expect(getCatalogPersonRedirectHref(ready('staff', '山田 太郎'), 'staff', 'staff_yamada', '山田-太郎', 'works')).toBe('/staff/staff_yamada/%E5%B1%B1%E7%94%B0-%E5%A4%AA%E9%83%8E?tab=anime')
  })

  it('corrects invalid search before work tabs and leaves non-ready detail states visible', () => {
    expect(getCatalogPersonRedirectHref(ready('character', 'Frieren'), 'character', 'character_frieren', 'frieren', 'works')).toBe('/characters/character_frieren/frieren')
    expect(getCatalogPersonRedirectHref({ status: 'not-found' }, 'character', 'character_frieren', null, 'anime')).toBeNull()
    expect(getCatalogPersonRedirectHref({ status: 'error', code: 'UPSTREAM', message: 'Down', retryAfterSeconds: null }, 'staff', 'staff_yamada', 'old', 'works')).toBeNull()
  })

  it('uses push navigation without scroll reset for tab clicks', () => {
    expect(getCatalogPersonTabNavigation('character', 'overview')).toEqual({ search: {}, resetScroll: false })
    expect(getCatalogPersonTabNavigation('character', 'anime')).toEqual({ search: { tab: 'anime' }, resetScroll: false })
    expect(getCatalogPersonTabNavigation('character', 'voice-actors')).toEqual({ search: { tab: 'voice-actors' }, resetScroll: false })
    expect(getCatalogPersonTabNavigation('staff', 'anime')).toEqual({ search: { tab: 'anime' }, resetScroll: false })
    expect(() => getCatalogPersonTabNavigation('staff', 'voice-actors')).toThrow('CATALOG_PERSON_TAB_INVALID')
  })

  it('resolves a legacy decimal before querying person detail by public ID', async () => {
    const state = ready('character', 'Frieren')
    const queryClient = {
      fetchQuery: vi.fn()
        .mockResolvedValueOnce({
          status: 'resolved',
          source: 'legacy',
          publicId: 'character_frieren',
          kind: 'character',
        })
        .mockResolvedValueOnce(state),
    }
    await expect(ensureCatalogPersonChildData(queryClient, 'character', '7')).resolves.toBe(state)
    expect(queryClient.fetchQuery).toHaveBeenCalledTimes(2)
    expect(queryClient.fetchQuery.mock.calls[0]?.[0].queryKey).toEqual([
      'catalog-route-identity',
      'character',
      '7',
    ])
    expect(queryClient.fetchQuery.mock.calls[1]?.[0].queryKey).toEqual([
      'catalog-person',
      'character',
      'character_frieren',
    ])
  })
})
