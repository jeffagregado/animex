import { describe, expect, test } from 'vitest'

import { type AniListDependencies } from '../../../lib/anilist-client.server'
import { fetchAnimeDetailFromAniList, fetchAnimePeoplePageFromAniList } from './anilist-detail.server'

const media = {
  id: 52991, type: 'ANIME', isAdult: false,
  title: { english: 'Frieren', romaji: 'Sousou no Frieren', native: '葬送のフリーレン' },
  coverImage: { extraLarge: 'https://img.example/cover.jpg' }, bannerImage: null,
  description: '<p>A mage &amp; her <b>journey</b>.</p>', format: 'TV', status: 'FINISHED', source: 'MANGA',
  season: 'FALL', seasonYear: 2023, episodes: 28, duration: 24,
  popularity: 100, averageScore: 89, trending: 10, nextAiringEpisode: null,
  startDate: { year: 2023, month: 9, day: 29 }, endDate: { year: 2024, month: 3, day: 22 }, genres: ['Adventure'],
  studios: { edges: [{ isMain: true, node: { name: 'Madhouse', siteUrl: 'https://anilist.co/studio/11' } }] },
  relations: { edges: Array.from({ length: 6 }, (_, index) => ({ node: { id: index + 1, type: 'ANIME', isAdult: false, title: { english: `Related ${index}`, romaji: null, native: null }, coverImage: { large: null }, format: 'TV', seasonYear: 2023 } })) },
  recommendations: { nodes: Array.from({ length: 6 }, (_, index) => ({ mediaRecommendation: { id: index + 20, type: 'ANIME', isAdult: false, title: { english: `Rec ${index}`, romaji: null, native: null }, coverImage: { large: null }, format: 'MOVIE', seasonYear: 2024 } })) },
  trailer: { id: 'abc', site: 'youtube', thumbnail: 'https://img.youtube.com/abc.jpg' },
  externalLinks: Array.from({ length: 10 }, (_, index) => ({ site: `Site ${index}`, url: index === 0 ? 'http://bad.example' : `https://example.com/${index}` })),
}

const deps = (bodies: unknown[]): AniListDependencies => ({
  fetch: async () => new Response(JSON.stringify(bodies.shift()), { status: 200 }),
  delay: async () => {}, warn: () => {}, now: () => 0,
})
const responseDeps = (responses: Response[]): AniListDependencies => ({
  fetch: async () => {
    const response = responses.shift()
    if (!response) throw new Error('Unexpected request.')
    return response
  },
  delay: async () => {}, warn: () => {}, now: () => 0,
})
const emptyPeople = (kind: 'characters' | 'staff') => ({ data: { Media: { [kind]: { pageInfo: { currentPage: 1, hasNextPage: false }, edges: [] } } } })

describe('anime detail AniList normalization', () => {
  test('returns plain synopsis and frozen list/link caps', async () => {
    const detail = await fetchAnimeDetailFromAniList(52991, deps([{ data: { Media: media } }, emptyPeople('characters'), emptyPeople('staff')]))
    expect(detail).not.toBeNull()
    if (!detail) throw new Error('Expected detail.')
    expect(detail.synopsis).toBe('A mage & her journey.')
    expect(detail.related).toHaveLength(5)
    expect(detail.recommendations).toHaveLength(5)
    expect(detail.externalLinks).toHaveLength(8)
    expect(detail.trailer?.youtubeId).toBe('abc')
  })

  test('distinguishes a missing anime and rejects malformed provider data', async () => {
    await expect(fetchAnimeDetailFromAniList(52991, deps([{ data: { Media: null } }]))).resolves.toBeNull()
    await expect(fetchAnimeDetailFromAniList(52991, deps([{ data: { Media: { id: 'bad' } } }]))).rejects.toMatchObject({ code: 'UPSTREAM' })
  })

  test('treats valid AniList 404 detail and people payloads as not found', async () => {
    const notFound = () => new Response(JSON.stringify({
      errors: [{ message: 'Not Found.', status: 404, locations: [{ line: 1, column: 1 }] }],
      data: { Media: null },
    }), { status: 404 })

    await expect(fetchAnimeDetailFromAniList(999_999, responseDeps([notFound()]))).resolves.toBeNull()
    await expect(fetchAnimePeoplePageFromAniList(999_999, 'characters', 1, responseDeps([notFound()]))).resolves.toBeNull()
  })

  test('rejects malformed AniList 404 bodies as upstream failures', async () => {
    const malformed = new Response(JSON.stringify({ errors: [{ message: 'Upstream failed.', status: 500 }], data: { Media: null } }), { status: 404 })

    await expect(fetchAnimeDetailFromAniList(999_999, responseDeps([malformed]))).rejects.toMatchObject({ code: 'UPSTREAM' })
  })

  test('normalizes exactly 24 characters and selects Japanese voice actors', async () => {
    const nodes = Array.from({ length: 24 }, (_, index) => ({
      role: 'MAIN', node: { id: index + 1, name: { full: `Character ${index}` }, image: { large: null } },
      voiceActorRoles: [{ voiceActor: { id: 100, name: { full: 'English VA' }, image: { large: null }, languageV2: 'English' } }, { voiceActor: { id: 101, name: { full: 'Japanese VA' }, image: { large: null }, languageV2: 'Japanese' } }],
    }))
    const page = await fetchAnimePeoplePageFromAniList(52991, 'characters', 2, deps([{ data: { Media: { characters: { pageInfo: { currentPage: 2, hasNextPage: true }, edges: nodes } } } }]))
    expect(page).not.toBeNull()
    if (!page) throw new Error('Expected page.')
    expect(page).toMatchObject({ currentPage: 2, hasNextPage: true, perPage: 24 })
    expect(page.items).toHaveLength(24)
    expect(page.items[0]).toMatchObject({ japaneseVoiceActor: { name: 'Japanese VA', language: 'Japanese' } })
  })
})
