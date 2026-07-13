import { describe, expect, it, vi } from 'vitest'

import { ensureAnimeDetailChildData, parseAnimeRouteId } from './$anilistId/route'
import { getAnimeTabNavigationOptions, getStaleSlugRedirectHref, serializeAnimeTab } from './$anilistId/$slug/route'
import { getMissingSlugRedirectHref } from './$anilistId/index'
import type { PublicAnimeDetailState } from '#/features/anime-detail/shared/anime-detail-contracts'

describe('anime detail route state', () => {
  it('accepts only positive safe integer route IDs', () => {
    expect(parseAnimeRouteId('154587')).toBe(154587)
    for (const value of ['0', '-1', '1.5', '12x', String(Number.MAX_SAFE_INTEGER + 1)]) expect(() => parseAnimeRouteId(value)).toThrow('AniList ID must be a positive safe integer.')
  })

  it('omits Overview and normalizes invalid tabs', () => {
    expect(serializeAnimeTab('overview')).toEqual({})
    expect(serializeAnimeTab('reviews')).toEqual({ tab: 'reviews' })
    expect(serializeAnimeTab('invalid')).toEqual({})
  })

  it('preserves valid tabs in stale-slug replacement and leaves non-ready states visible', () => {
    const ready = { status: 'ready', entry: { detail: { anilistId: 1, slug: 'frieren', titles: { display: 'Frieren' } } } } as PublicAnimeDetailState
    expect(getStaleSlugRedirectHref(ready, 'old', '?tab=staff')).toBe('/anime/1/frieren?tab=staff')
    expect(getStaleSlugRedirectHref({ status: 'not-found', code: 'NOT_FOUND', message: 'Missing' }, 'old', '?tab=staff')).toBeNull()
    expect(getMissingSlugRedirectHref(ready, '?tab=characters')).toBe('/anime/1/frieren?tab=characters')
    expect(getMissingSlugRedirectHref({ status: 'error', code: 'UPSTREAM', message: 'Down', retryAfterSeconds: null }, '?tab=staff')).toBeNull()
  })

  it('creates scroll-stable tab navigation options', () => {
    expect(getAnimeTabNavigationOptions('overview')).toEqual({ search: {}, resetScroll: false })
    expect(getAnimeTabNavigationOptions('characters')).toEqual({ search: { tab: 'characters' }, resetScroll: false })
  })

  it('awaits detail data when child loader starts with an empty query cache', async () => {
    const ready = { status: 'ready', entry: { detail: { anilistId: 1 } } }
    const queryClient = { ensureQueryData: vi.fn().mockResolvedValue(ready) }
    await expect(ensureAnimeDetailChildData(queryClient, '1')).resolves.toBe(ready)
    expect(queryClient.ensureQueryData).toHaveBeenCalledOnce()

    const error = { status: 'error', code: 'UPSTREAM', message: 'Down', retryAfterSeconds: null }
    queryClient.ensureQueryData.mockResolvedValueOnce(error)
    await expect(ensureAnimeDetailChildData(queryClient, '1')).resolves.toBe(error)
  })
})
