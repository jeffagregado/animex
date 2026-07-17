import { describe, expect, test } from 'vitest'

import { type AniListDependencies } from '../../../lib/anilist-client.server'
import {
  fetchCatalogPersonFromAniList,
  fetchCatalogPersonWorksFromAniList,
  searchCatalogPeopleFromAniList,
} from './anilist-person.server'

const response = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const deps = (bodies: Response[]) => {
  const requests: Array<{ query: string; variables: Record<string, unknown> }> = []
  const dependencies: AniListDependencies = {
    fetch: async (_input, init) => {
      requests.push(JSON.parse(String(init?.body)) as { query: string; variables: Record<string, unknown> })
      const body = bodies.shift()
      if (!body) throw new Error('Unexpected request')
      return body
    },
    delay: async () => {},
    warn: () => {},
    now: () => 0,
  }
  return { dependencies, requests }
}
const media = (id: number) => ({
  id, type: 'ANIME', isAdult: false,
  title: { english: `Anime ${id}`, romaji: null, native: null },
  coverImage: { large: 'https://img.example/a.jpg' }, bannerImage: null,
  format: 'TV', season: null, seasonYear: 2024, episodes: 12, genres: [],
  popularity: 1, averageScore: 80, trending: null,
  startDate: { year: 2024, month: 1, day: 1 }, nextAiringEpisode: null,
})
const staff = (yearsActive: number[] | null) => ({
  id: 21, name: { full: 'Atsumi Tanezaki', native: null }, image: null, description: null,
  primaryOccupations: [' Voice Actor ', 'Voice Actor', 'Singer'], languageV2: 'Japanese',
  homeTown: 'Oita', yearsActive,
})

describe('AniList catalog person adapter', () => {
  test('normalizes character detail, description, and full birthday', async () => {
    const fixture = deps([response({ data: { Character: {
      id: 12, name: { full: ' Frieren ', native: 'フリーレン' }, image: { large: 'https://img.example/f.jpg' },
      description: '<b>Elf</b> &amp; mage.', age: '1000+', gender: 'Female',
      dateOfBirth: { year: 1900, month: 2, day: 28 }, bloodType: null,
    } } })])
    await expect(fetchCatalogPersonFromAniList('character', 12, fixture.dependencies)).resolves.toMatchObject({
      kind: 'character', id: 12, name: 'Frieren', description: 'Elf & mage.', birthday: 'February 28, 1900',
    })
    expect(fixture.requests[0]?.query).toContain('query CharacterDetail')
  })

  test.each([
    [[], null],
    [[2012], '2012–Present'],
    [[2012, 2026], '2012–2026'],
  ] as const)('normalizes staff years %j to %s', async (yearsActive, activeYears) => {
    const fixture = deps([response({ data: { Staff: staff([...yearsActive]) } })])
    await expect(fetchCatalogPersonFromAniList('staff', 21, fixture.dependencies)).resolves.toMatchObject({
      occupations: ['Voice Actor', 'Singer'], activeYears,
    })
  })

  test.each([[[2026, 2012]], [[2012, 2020, 2026]], [[0]]])(
    'rejects invalid staff years %j',
    async (yearsActive) => {
      const fixture = deps([response({ data: { Staff: staff(yearsActive) } })])
      await expect(fetchCatalogPersonFromAniList('staff', 21, fixture.dependencies))
        .rejects.toMatchObject({ code: 'UPSTREAM' })
    },
  )

  test('accepts strict Character and Staff HTTP 404 detail and work roots', async () => {
    for (const [kind, root] of [['character', 'Character'], ['staff', 'Staff']] as const) {
      const notFound = () => response({
        errors: [{ message: 'Not Found.', status: 404 }],
        data: { [root]: null },
      }, 404)
      await expect(fetchCatalogPersonFromAniList(kind, 99, deps([notFound()]).dependencies))
        .resolves.toBeNull()
      await expect(fetchCatalogPersonWorksFromAniList(kind, 99, 1, deps([notFound()]).dependencies))
        .resolves.toBeNull()
    }
  })

  test('uses 20 rows, preserves work order and roles, and requests full summary fields', async () => {
    const fixture = deps([response({ data: { Character: { id: 12, media: {
      pageInfo: { currentPage: 2, hasNextPage: true },
      edges: [{ characterRole: 'MAIN', node: media(2) }, { characterRole: 'SUPPORTING', node: media(1) }],
    } } } })])
    const page = await fetchCatalogPersonWorksFromAniList('character', 12, 2, fixture.dependencies)
    expect(page?.page.items.map((item) => [item.anime.id, item.role])).toEqual([[2, 'MAIN'], [1, 'SUPPORTING']])
    expect(fixture.requests[0]?.variables).toMatchObject({ perPage: 20 })
    expect(fixture.requests[0]?.query).toContain('nextAiringEpisode')
    expect(fixture.requests[0]?.query).toContain('media(type: ANIME,')
  })

  test('filters adult Character work and preserves eligible order', async () => {
    const fixture = deps([response({ data: { Character: { id: 12, media: {
      pageInfo: { currentPage: 1, hasNextPage: false },
      edges: [
        { characterRole: 'MAIN', node: media(2) },
        { characterRole: 'MAIN', node: { ...media(3), isAdult: true } },
        { characterRole: 'SUPPORTING', node: media(1) },
      ],
    } } } })])
    const result = await fetchCatalogPersonWorksFromAniList('character', 12, 1, fixture.dependencies)
    expect(result?.page.items.map((item) => item.anime.id)).toEqual([2, 1])
  })

  test('normalizes Staff work and requires Anime filter', async () => {
    const fixture = deps([response({ data: { Staff: { id: 21, staffMedia: {
      pageInfo: { currentPage: 1, hasNextPage: false },
      edges: [{ staffRole: 'Director', node: media(4) }],
    } } } })])
    await expect(fetchCatalogPersonWorksFromAniList('staff', 21, 1, fixture.dependencies))
      .resolves.toMatchObject({ page: { items: [{ anime: { id: 4 }, role: 'Director' }] } })
    expect(fixture.requests[0]?.query).toContain('staffMedia(type: ANIME,')
  })

  test('search is strict, destination-ready, and not cache-shaped', async () => {
    const fixture = deps([response({ data: { Page: {
      pageInfo: { currentPage: 1, hasNextPage: false },
      characters: [{ id: 12, name: { full: 'Frieren', native: null }, image: null }],
    } } })])
    await expect(searchCatalogPeopleFromAniList('character', ' frieren ', 1, fixture.dependencies)).resolves.toEqual({
      items: [{ kind: 'character', id: 12, name: 'Frieren', nativeName: null, imageUrl: null, destination: '/characters/12/frieren' }],
      currentPage: 1, hasNextPage: false, perPage: 20,
    })
    expect(fixture.requests[0]?.variables).toMatchObject({ query: 'frieren', page: 1, perPage: 20 })
  })

  test('normalizes Staff search and rejects search page mismatch', async () => {
    const fixture = deps([response({ data: { Page: {
      pageInfo: { currentPage: 2, hasNextPage: false },
      staff: [{ id: 21, name: { full: 'Atsumi Tanezaki', native: null }, image: null }],
    } } })])
    await expect(searchCatalogPeopleFromAniList('staff', 'atsumi', 2, fixture.dependencies))
      .resolves.toMatchObject({ items: [{ kind: 'staff', id: 21, destination: '/staff/21/atsumi-tanezaki' }] })

    const mismatch = deps([response({ data: { Page: {
      pageInfo: { currentPage: 1, hasNextPage: false }, staff: [],
    } } })])
    await expect(searchCatalogPeopleFromAniList('staff', 'atsumi', 2, mismatch.dependencies))
      .rejects.toMatchObject({ code: 'UPSTREAM' })
  })

  test('rejects Character and Staff work page mismatches', async () => {
    const character = deps([response({ data: { Character: { id: 12, media: {
      pageInfo: { currentPage: 1, hasNextPage: false }, edges: [],
    } } } })])
    await expect(fetchCatalogPersonWorksFromAniList('character', 12, 2, character.dependencies))
      .rejects.toMatchObject({ code: 'UPSTREAM' })
    const staffFixture = deps([response({ data: { Staff: { id: 21, staffMedia: {
      pageInfo: { currentPage: 1, hasNextPage: false }, edges: [],
    } } } })])
    await expect(fetchCatalogPersonWorksFromAniList('staff', 21, 2, staffFixture.dependencies))
      .rejects.toMatchObject({ code: 'UPSTREAM' })
  })

  test('returns null for missing detail and rejects extra provider fields and HTTP images', async () => {
    const missing = deps([response({ data: { Character: null } })])
    await expect(fetchCatalogPersonFromAniList('character', 99, missing.dependencies)).resolves.toBeNull()
    const extra = deps([response({ data: { Character: {
      id: 12, name: { full: 'Frieren', native: null }, image: { large: 'http://bad.example/f.jpg' },
      description: null, age: null, gender: null, dateOfBirth: null, bloodType: null, raw: true,
    } } })])
    await expect(fetchCatalogPersonFromAniList('character', 12, extra.dependencies)).rejects.toMatchObject({ code: 'UPSTREAM' })
  })
})
