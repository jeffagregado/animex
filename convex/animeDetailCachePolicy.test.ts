import { describe, expect, test } from 'vitest'

import {
  ANIME_DETAIL_CACHE_TTL_MS,
  AnimeDetailCachePolicyError,
  assertDetailLease,
  createDetailTiming,
  decideDetailLease,
  decideDetailLeaseRelease,
  resolveDetailRead,
  validateDetailCommit,
  validatePeoplePage,
} from './animeDetailCachePolicy'
import { DiscoverCachePolicyError, validateCacheWriteToken } from './animeCachePolicy'

const getError = (run: () => void): AnimeDetailCachePolicyError => {
  try { run() } catch (error) {
    expect(error).toBeInstanceOf(AnimeDetailCachePolicyError)
    return error as AnimeDetailCachePolicyError
  }
  throw new Error('Expected anime detail cache policy failure.')
}

describe('anime detail cache policy', () => {
  const emptyPage = { items: [], currentPage: 1, hasNextPage: false, perPage: 24 as const }
  const detail = {
    anilistId: 1, slug: 'one', titles: { display: 'One', english: 'One', romaji: null, native: null },
    coverImageUrl: 'https://example.com/cover.jpg', bannerImageUrl: null, synopsis: null, format: 'TV', status: 'FINISHED', source: null,
    season: null, seasonYear: 2024, episodes: 1, durationMinutes: 24, startDate: { year: 2024, month: 1, day: 1 }, endDate: null,
    genres: ['Fantasy'], mainStudio: { name: 'Studio', siteUrl: 'https://example.com' }, related: [], recommendations: [],
    trailer: { youtubeId: 'abc', thumbnailUrl: 'https://example.com/trailer.jpg' }, externalLinks: [{ site: 'Official', url: 'https://example.com/anime' }],
    charactersPage: emptyPage, staffPage: emptyPage,
  }
  const summary = {
    anilistId: 1, slug: 'one', titles: detail.titles, coverImageUrl: detail.coverImageUrl, bannerImageUrl: null, format: 'TV', season: null,
    seasonYear: 2024, episodes: 1, genres: ['Fantasy'], popularity: 1, averageScore: 80, trending: 1,
    startDate: detail.startDate, nextAiringAt: 1,
  }

  test('uses an exact 24-hour cache window and hides expired payloads', () => {
    expect(ANIME_DETAIL_CACHE_TTL_MS).toBe(24 * 60 * 60 * 1000)
    expect(createDetailTiming(100)).toEqual({ refreshedAt: 100, expiresAt: 100 + ANIME_DETAIL_CACHE_TTL_MS })
    expect(resolveDetailRead(null, 100)).toEqual({ status: 'missing', entry: null })
    expect(resolveDetailRead({ payload: 'fresh', refreshedAt: 90, expiresAt: 101 }, 100)).toEqual({
      status: 'fresh', entry: { payload: 'fresh', refreshedAt: 90, expiresAt: 101 },
    })
    expect(resolveDetailRead({ payload: 'stale', refreshedAt: 90, expiresAt: 100 }, 100)).toEqual({ status: 'expired', entry: null })
  })

  test('enforces lease ownership for acquire, commit, and release', () => {
    expect(decideDetailLease(null, 'a', 100, 200)).toEqual({ acquired: true, leaseUntil: 200 })
    expect(decideDetailLease({ leaseId: 'a', leaseUntil: 201 }, 'b', 100, 200)).toEqual({ acquired: false, leaseUntil: 201 })
    expect(() => assertDetailLease({ leaseId: 'a', leaseUntil: 200 }, 'a', 100)).not.toThrow()
    expect(getError(() => assertDetailLease({ leaseId: 'a', leaseUntil: 200 }, 'b', 100)).code).toBe('LEASE_NOT_OWNED')
    expect(decideDetailLeaseRelease({ leaseId: 'a', leaseUntil: 200 }, 'a', 100)).toBe(true)
    expect(getError(() => decideDetailLeaseRelease({ leaseId: 'a', leaseUntil: 200 }, 'b', 100)).code).toBe('LEASE_NOT_OWNED')
  })

  test('reuses the deployment cache token gate', () => {
    expect(() => validateCacheWriteToken('worker-token', 'worker-token')).not.toThrow()
    expect(() => validateCacheWriteToken('wrong-token', 'worker-token')).toThrow(DiscoverCachePolicyError)
  })

  test('requires positive IDs and caps people pages at 24 items', () => {
    const character = { anilistId: 1, name: 'Fern', role: 'MAIN', imageUrl: null, japaneseVoiceActor: null }
    const staff = { anilistId: 2, name: 'Director', role: 'Director', imageUrl: null }
    expect(() => validatePeoplePage(1, 'characters', 1, [character])).not.toThrow()
    expect(() => validatePeoplePage(1, 'staff', 1, [staff])).not.toThrow()
    expect(getError(() => validatePeoplePage(1, 'characters', 1, [staff])).code).toBe('INVALID_PEOPLE_KIND')
    expect(getError(() => validatePeoplePage(1, 'staff', 1, [character])).code).toBe('INVALID_PEOPLE_KIND')
    expect(getError(() => validatePeoplePage(1, 'characters', 1, [{ ...character, anilistId: 0 }])).code).toBe('INVALID_DETAIL')
    expect(getError(() => validatePeoplePage(1, 'staff', 1, [{ ...staff, imageUrl: 'http://example.com' }])).code).toBe('INVALID_DETAIL')
    expect(getError(() => validatePeoplePage(0, 'characters', 1, [])).code).toBe('INVALID_ANILIST_ID')
    expect(getError(() => validatePeoplePage(1, 'characters', 0, [])).code).toBe('INVALID_PAGE')
    expect(getError(() => validatePeoplePage(1, 'characters', 1, Array.from({ length: 25 }))).code).toBe('PEOPLE_PAGE_LIMIT_EXCEEDED')
  })

  test('rejects malformed detail and summary writes at frozen contract boundaries', () => {
    expect(() => validateDetailCommit(detail, summary)).not.toThrow()
    expect(getError(() => validateDetailCommit({ ...detail, slug: '' }, summary)).code).toBe('INVALID_DETAIL')
    expect(getError(() => validateDetailCommit({ ...detail, coverImageUrl: 'http://example.com' }, summary)).code).toBe('INVALID_DETAIL')
    expect(getError(() => validateDetailCommit({ ...detail, episodes: -1 }, summary)).code).toBe('INVALID_DETAIL')
    expect(getError(() => validateDetailCommit({ ...detail, startDate: { year: 2024, month: 13, day: 1 } }, summary)).code).toBe('INVALID_DETAIL')
    expect(getError(() => validateDetailCommit({ ...detail, related: [{ anilistId: 0, slug: 'bad', title: 'Bad', coverImageUrl: null, format: null, seasonYear: null }] }, summary)).code).toBe('INVALID_DETAIL')
    expect(getError(() => validateDetailCommit(detail, { ...summary, popularity: -1 })).code).toBe('INVALID_SUMMARY')
  })
})
