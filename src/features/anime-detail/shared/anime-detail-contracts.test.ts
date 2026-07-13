import { describe, expect, expectTypeOf, test } from 'vitest'

import {
  ANIME_DETAIL_CACHE_TTL_MS,
  ANIME_EXTERNAL_LINKS_LIMIT,
  ANIME_PEOPLE_PER_PAGE,
  ANIME_RECOMMENDATIONS_LIMIT,
  ANIME_RELATED_LIMIT,
  ANIME_REWATCHES_PER_PAGE,
  animeDetailSchema,
  animeCharacterPageSchema,
  animeMilestoneSchema,
  animeRewatchPageSchema,
  animeScoreSchema,
  animeStaffPageSchema,
  animeStatusSchema,
  recordAnimeRewatchInputSchema,
  removeLatestAnimeRewatchInputSchema,
  setAnimeFavoriteInputSchema,
  setAnimeScoreInputSchema,
  setAnimeStatusInputSchema,
  createCanonicalAnimePath,
  normalizeAnimeDetailTab,
  parseAnilistId,
  parseAnimePage,
  publicAnimeDetailStateSchema,
  userAnimeEntrySchema,
  userAnimeMutationResultSchema,
  type AnimeCharacter,
  type AnimePeoplePage,
} from './anime-detail-contracts'

const validDetail = {
  anilistId: 52991,
  slug: 'frieren-beyond-journeys-end',
  titles: { display: "Frieren: Beyond Journey's End", english: "Frieren: Beyond Journey's End", romaji: 'Sousou no Frieren', native: '葬送のフリーレン' },
  coverImageUrl: 'https://img.example/frieren.jpg',
  bannerImageUrl: null,
  synopsis: 'An elf mage retraces a heroic journey.',
  format: 'TV',
  status: 'FINISHED',
  source: 'MANGA',
  season: 'FALL',
  seasonYear: 2023,
  episodes: 28,
  durationMinutes: 24,
  startDate: { year: 2023, month: 9, day: 29 },
  endDate: { year: 2024, month: 3, day: 22 },
  genres: ['Adventure', 'Drama'],
  mainStudio: { name: 'Madhouse', siteUrl: 'https://anilist.co/studio/11' },
  related: [],
  recommendations: [],
  trailer: { youtubeId: 'Iwr1aLEDpe4', thumbnailUrl: 'https://img.youtube.com/frieren.jpg' },
  externalLinks: [{ site: 'Official Site', url: 'https://frieren-anime.jp/' }],
  charactersPage: { items: [], currentPage: 1, hasNextPage: false, perPage: 24 },
  staffPage: { items: [], currentPage: 1, hasNextPage: false, perPage: 24 },
}

describe('anime detail contracts', () => {
  test('locks collection limits and cache lifetime', () => {
    expect(ANIME_RELATED_LIMIT).toBe(5)
    expect(ANIME_RECOMMENDATIONS_LIMIT).toBe(5)
    expect(ANIME_PEOPLE_PER_PAGE).toBe(24)
    expect(ANIME_REWATCHES_PER_PAGE).toBe(20)
    expect(ANIME_EXTERNAL_LINKS_LIMIT).toBe(8)
    expect(ANIME_DETAIL_CACHE_TTL_MS).toBe(24 * 60 * 60 * 1000)
  })

  test.each([1, 52991, Number.MAX_SAFE_INTEGER])('accepts positive safe integer %s', (value) => {
    expect(parseAnilistId(value)).toBe(value)
    expect(parseAnimePage(value)).toBe(value)
  })

  test.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN, '52991'])('rejects invalid ID/page %s', (value) => {
    expect(() => parseAnilistId(value)).toThrow('AniList ID must be a positive safe integer.')
    expect(() => parseAnimePage(value)).toThrow('Page must be a positive safe integer.')
  })

  test('normalizes supported tabs and defaults absent or invalid values to overview', () => {
    expect(normalizeAnimeDetailTab('reviews')).toBe('reviews')
    expect(normalizeAnimeDetailTab('characters')).toBe('characters')
    expect(normalizeAnimeDetailTab('staff')).toBe('staff')
    expect(normalizeAnimeDetailTab('overview')).toBe('overview')
    expect(normalizeAnimeDetailTab(undefined)).toBe('overview')
    expect(normalizeAnimeDetailTab('unknown')).toBe('overview')
    expect(normalizeAnimeDetailTab(['staff'])).toBe('overview')
  })

  test('creates encoded canonical paths and omits overview search', () => {
    expect(createCanonicalAnimePath(52991, "Frieren: Beyond Journey's End", 'overview')).toBe('/anime/52991/frieren-beyond-journeys-end')
    expect(createCanonicalAnimePath(52991, '葬送のフリーレン', 'staff')).toBe('/anime/52991/%E8%91%AC%E9%80%81%E3%81%AE%E3%83%95%E3%83%AA%E3%83%BC%E3%83%AC%E3%83%B3?tab=staff')
  })

  test('validates serializable full detail metadata and exact caps', () => {
    expect(animeDetailSchema.parse(validDetail)).toEqual(validDetail)
    const compactItem = { anilistId: 1, slug: 'x', title: 'X', coverImageUrl: null, format: 'TV', seasonYear: 2026 }
    expect(animeDetailSchema.parse({ ...validDetail, related: [compactItem] }).related).toEqual([compactItem])
    expect(() => animeDetailSchema.parse({ ...validDetail, related: Array.from({ length: 6 }, () => compactItem) })).toThrow()
    expect(() => animeDetailSchema.parse({ ...validDetail, recommendations: Array.from({ length: 6 }, () => compactItem) })).toThrow()
    expect(() => animeDetailSchema.parse({ ...validDetail, related: [{ anilistId: 1, slug: 'x', title: 'X', coverImageUrl: null }] })).toThrow()
    expect(() => animeDetailSchema.parse({ ...validDetail, externalLinks: [{ site: 'Bad', url: 'http://example.com' }] })).toThrow()
    expect(() => animeDetailSchema.parse({ ...validDetail, externalLinks: Array.from({ length: 9 }, (_, index) => ({ site: `Site ${index}`, url: `https://example.com/${index}` })) })).toThrow()
    expect(() => animeDetailSchema.parse({ ...validDetail, charactersPage: { ...validDetail.charactersPage, currentPage: 2 } })).toThrow()
    expect(() => animeDetailSchema.parse({ ...validDetail, staffPage: { ...validDetail.staffPage, items: Array.from({ length: 25 }, () => ({ anilistId: 2, name: 'Staff', role: 'Director', imageUrl: null })) } })).toThrow()
    const { charactersPage: _charactersPage, ...missingCharacters } = validDetail
    expect(() => animeDetailSchema.parse(missingCharacters)).toThrow()
  })

  test('locks generic people pages to 24 and validates character data', () => {
    const character: AnimeCharacter = { anilistId: 1, name: 'Frieren', role: 'MAIN', imageUrl: null, japaneseVoiceActor: null }
    const page: AnimePeoplePage<AnimeCharacter> = { items: [character], currentPage: 1, hasNextPage: false, perPage: 24 }

    expect(animeCharacterPageSchema.parse(page)).toEqual(page)
    expect(() => animeCharacterPageSchema.parse({ ...page, perPage: 25 })).toThrow()
    expect(() => animeCharacterPageSchema.parse({ ...page, items: [{ ...character, japaneseVoiceActor: { anilistId: 2, name: 'Atsumi Tanezaki', imageUrl: null, language: 'English' } }] })).toThrow()
    expect(() => animeCharacterPageSchema.parse({ ...page, items: Array.from({ length: 25 }, () => character) })).toThrow()
    expect(() => animeStaffPageSchema.parse({ ...page, items: [{ anilistId: 2, name: 'Keiichirou Saitou', role: 42, imageUrl: null }] })).toThrow()
    expectTypeOf(page.items).toEqualTypeOf<AnimeCharacter[]>()
  })

  test('accepts exact user statuses and nullable one-decimal scores', () => {
    expect(['watching', 'planned', 'dropped', 'completed', 'rewatched'].map((status) => animeStatusSchema.parse(status))).toHaveLength(5)
    expect(animeScoreSchema.parse(null)).toBeNull()
    expect(animeScoreSchema.parse(0)).toBe(0)
    expect(animeScoreSchema.parse(9.5)).toBe(9.5)
    expect(animeScoreSchema.parse(10)).toBe(10)
    expect(() => animeScoreSchema.parse(10.1)).toThrow()
    expect(() => animeScoreSchema.parse(8.25)).toThrow()
  })

  test('validates exact identity-free mutation inputs', () => {
    expect(setAnimeStatusInputSchema.parse({ anilistId: 52991, status: 'watching' })).toEqual({ anilistId: 52991, status: 'watching' })
    expect(setAnimeScoreInputSchema.parse({ anilistId: 52991, score: null })).toEqual({ anilistId: 52991, score: null })
    expect(setAnimeFavoriteInputSchema.parse({ anilistId: 52991, isFavorite: false })).toEqual({ anilistId: 52991, isFavorite: false })
    expect(recordAnimeRewatchInputSchema.parse({ anilistId: 52991 })).toEqual({ anilistId: 52991 })
    expect(removeLatestAnimeRewatchInputSchema.parse({ anilistId: 52991 })).toEqual({ anilistId: 52991 })
    expect(() => setAnimeStatusInputSchema.parse({ anilistId: 52991, status: 'watching', userId: 'leak' })).toThrow()
    expect(() => setAnimeFavoriteInputSchema.parse({ anilistId: 52991 })).toThrow()
    expect(() => recordAnimeRewatchInputSchema.parse({ anilistId: 52991, completedAt: 1 })).toThrow()
  })

  test('validates user entry, milestone, rewatch page, and mutation result semantics', () => {
    const entry = { anilistId: 52991, status: null, score: 9.5, isFavorite: true, favoriteChangedAt: 10, rewatchCount: 1, createdAt: 1, updatedAt: 10 }
    const milestone = { anilistId: 52991, kind: 'completed', settledAt: 10 }
    const rewatch = { id: 'rewatch-1', anilistId: 52991, completedAt: 10 }

    expect(userAnimeEntrySchema.parse(entry)).toEqual(entry)
    expect(animeMilestoneSchema.parse(milestone)).toEqual(milestone)
    expect(animeRewatchPageSchema.parse({ items: [rewatch], currentPage: 1, hasNextPage: false, perPage: 20 }).items).toEqual([rewatch])
    expect(userAnimeMutationResultSchema.parse({ status: 'saved', entry })).toEqual({ status: 'saved', entry })
    expect(() => animeMilestoneSchema.parse({ ...milestone, kind: 'started' })).toThrow()
    expect(() => animeRewatchPageSchema.parse({ items: Array.from({ length: 21 }, () => rewatch), currentPage: 1, hasNextPage: false, perPage: 20 })).toThrow()
    expect(() => userAnimeEntrySchema.parse({ ...entry, updatedAt: Number.POSITIVE_INFINITY })).toThrow()
  })

  test.each([
    { status: 'loading' },
    { status: 'empty' },
    { status: 'not-found', code: 'NOT_FOUND', message: 'Anime not found.' },
    { status: 'error', code: 'UPSTREAM', message: 'AniList request failed.', retryAfterSeconds: null },
    { status: 'error', code: 'RATE_LIMITED', message: 'Try later.', retryAfterSeconds: 30 },
    { status: 'pagination-error', code: 'UPSTREAM', message: 'Page failed.', page: 2, retryAfterSeconds: null },
  ])('validates serialized public state %#', (state) => {
    expect(publicAnimeDetailStateSchema.parse(state)).toEqual(state)
  })

  test('requires finite nonnegative cache timestamps and exact 24-hour expiry', () => {
    const entry = { detail: validDetail, refreshedAt: 1_000, expiresAt: 1_000 + ANIME_DETAIL_CACHE_TTL_MS }

    expect(publicAnimeDetailStateSchema.parse({ status: 'ready', entry })).toEqual({ status: 'ready', entry })
    expect(() => publicAnimeDetailStateSchema.parse({ status: 'ready', entry: { ...entry, refreshedAt: -1 } })).toThrow()
    expect(() => publicAnimeDetailStateSchema.parse({ status: 'ready', entry: { ...entry, expiresAt: Number.POSITIVE_INFINITY } })).toThrow()
    expect(() => publicAnimeDetailStateSchema.parse({ status: 'ready', entry: { ...entry, expiresAt: entry.expiresAt + 1 } })).toThrow()
  })
})
