import { describe, expect, it, vi } from 'vitest'

import { ensureAnimeDetailChildData } from './$publicId/route'
import { getAnimeTabNavigationOptions, getStaleSlugRedirectHref, serializeAnimeTab } from './$publicId/$slug/route'
import { getMissingSlugRedirectHref } from './$publicId/index'
import { getCanonicalReviewEditorHref } from '../_protected/anime/$publicId/$slug/reviews/new'
import type { PublicAnimeDetailState } from '#/features/anime-detail/shared/anime-detail-contracts'

describe('anime detail route state', () => {
  it('omits Overview and normalizes invalid tabs', () => {
    expect(serializeAnimeTab('overview')).toEqual({})
    expect(serializeAnimeTab('reviews')).toEqual({ tab: 'reviews' })
    expect(serializeAnimeTab('invalid')).toEqual({})
  })

  it('preserves valid tabs in stale-slug replacement and leaves non-ready states visible', () => {
    const ready = { status: 'ready', entry: { detail: { publicId: 'anime_frieren', slug: 'frieren', titles: { display: 'Frieren' } } } } as PublicAnimeDetailState
    expect(getStaleSlugRedirectHref(ready, 'anime_frieren', 'old', '?tab=staff')).toBe('/anime/anime_frieren/frieren?tab=staff')
    expect(getStaleSlugRedirectHref(ready, '52991', 'frieren', '?tab=staff')).toBe('/anime/anime_frieren/frieren?tab=staff')
    expect(getStaleSlugRedirectHref({ status: 'not-found', code: 'NOT_FOUND', message: 'Missing' }, '52991', 'old', '?tab=staff')).toBeNull()
    expect(getMissingSlugRedirectHref(ready, '?tab=characters')).toBe('/anime/anime_frieren/frieren?tab=characters')
    expect(getMissingSlugRedirectHref({ status: 'error', code: 'UPSTREAM', message: 'Down', retryAfterSeconds: null }, '?tab=staff')).toBeNull()
  })

  it('canonicalizes a stale Review editor slug with the public Anime identity', () => {
    expect(getCanonicalReviewEditorHref({
      publicId: 'anime_frieren',
      slug: 'frieren',
    }, 'anime_frieren', 'old')).toBe('/anime/anime_frieren/frieren/reviews/new')
    expect(getCanonicalReviewEditorHref({
      publicId: 'anime_frieren',
      slug: 'frieren',
    }, '52991', 'frieren')).toBe('/anime/anime_frieren/frieren/reviews/new')
    expect(getCanonicalReviewEditorHref({
      publicId: 'anime_frieren',
      slug: 'frieren',
    }, 'anime_frieren', 'frieren')).toBeNull()
  })

  it('creates scroll-stable tab navigation options', () => {
    expect(getAnimeTabNavigationOptions('overview')).toEqual({ search: {}, resetScroll: false })
    expect(getAnimeTabNavigationOptions('characters')).toEqual({ search: { tab: 'characters' }, resetScroll: false })
  })

  it('resolves a legacy decimal before querying detail by public ID', async () => {
    const ready = { status: 'ready', entry: { detail: { publicId: 'anime_frieren' } } }
    const queryClient = {
      fetchQuery: vi.fn()
        .mockResolvedValueOnce({
          status: 'resolved',
          source: 'legacy',
          publicId: 'anime_frieren',
          kind: 'anime',
        })
        .mockResolvedValueOnce(ready),
    }
    await expect(ensureAnimeDetailChildData(queryClient, '52991')).resolves.toBe(ready)
    expect(queryClient.fetchQuery).toHaveBeenCalledTimes(2)
    expect(queryClient.fetchQuery.mock.calls[0]?.[0].queryKey).toEqual([
      'catalog-route-identity',
      'anime',
      '52991',
    ])
    expect(queryClient.fetchQuery.mock.calls[1]?.[0].queryKey).toEqual([
      'anime-detail',
      'anime_frieren',
    ])

    const error = { status: 'error', code: 'UPSTREAM', message: 'Down', retryAfterSeconds: null }
    queryClient.fetchQuery.mockResolvedValueOnce({
      status: 'resolved',
      source: 'public',
      publicId: 'anime_frieren',
      kind: 'anime',
    })
    queryClient.fetchQuery.mockResolvedValueOnce(error)
    await expect(ensureAnimeDetailChildData(queryClient, 'anime_frieren')).resolves.toBe(error)
  })

  it('does not query provider-backed detail for invalid or missing route identity', async () => {
    const queryClient = {
      fetchQuery: vi.fn().mockResolvedValueOnce({
        status: 'not-found',
        source: 'public',
        publicId: null,
        kind: 'anime',
      }),
    }
    await expect(ensureAnimeDetailChildData(queryClient, '00')).resolves.toMatchObject({
      status: 'not-found',
    })
    expect(queryClient.fetchQuery).toHaveBeenCalledOnce()
  })
})
