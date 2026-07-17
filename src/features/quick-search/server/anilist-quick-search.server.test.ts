import { describe, expect, test, vi } from 'vitest'

import {
  AniListRequestError,
  type AniListDependencies,
} from '../../../lib/anilist-client.server'
import { searchQuickCatalogFromAniList } from './anilist-quick-search.server'

interface ProviderImage {
  large: string
}

interface ProviderTitle {
  english: string | null
  romaji: string | null
  native: string | null
}

interface ProviderMedia {
  id: number
  type: string
  isAdult: boolean
  title: ProviderTitle
  coverImage: ProviderImage | null
  format: string | null
  seasonYear: number | null
}

interface ProviderPerson {
  id: number
  name: { full: string; native: string | null }
  image: ProviderImage | null
}

const media: ProviderMedia = {
  id: 52991,
  type: 'ANIME',
  isAdult: false,
  title: {
    english: "  Frieren: Beyond Journey's End  ",
    romaji: 'Sousou no Frieren',
    native: '葬送のフリーレン',
  },
  coverImage: { large: 'https://img.example/frieren.webp' },
  format: 'TV',
  seasonYear: 2023,
}
const character: ProviderPerson = {
  id: 12,
  name: { full: '  Flamme  ', native: '  フランメ  ' },
  image: { large: 'https://img.example/flamme.webp' },
}
const staff: ProviderPerson = {
  id: 21,
  name: { full: "  Tanezaki Atsumi's  ", native: '  種﨑 敦美  ' },
  image: { large: 'https://img.example/tanezaki.webp' },
}

const body = () => ({
  data: {
    anime: {
      pageInfo: { currentPage: 1 },
      media: [media],
    },
    characters: {
      pageInfo: { currentPage: 1 },
      characters: [character],
    },
    staff: {
      pageInfo: { currentPage: 1 },
      staff: [staff],
    },
  },
})

const responseDependencies = (
  responses: Response[],
  onFetch: (input: RequestInfo | URL, init?: RequestInit) => void = () => {},
): AniListDependencies => ({
  fetch: async (input, init) => {
    onFetch(input, init)
    const response = responses.shift()
    if (!response) throw new Error('Unexpected request.')
    return response
  },
  delay: async () => {},
  warn: () => {},
  now: () => 0,
})

const jsonResponse = (value: unknown, status = 200, headers?: HeadersInit): Response =>
  new Response(JSON.stringify(value), { status, headers })

describe('AniList Quick Search adapter', () => {
  test('uses one aliased operation and exact normalized variables', async () => {
    const calls: Array<{ url: string; payload: unknown }> = []
    const result = await searchQuickCatalogFromAniList(
      '  frieren  ',
      responseDependencies([jsonResponse(body())], (input, init) => {
        calls.push({
          url: String(input),
          payload: JSON.parse(String(init?.body)),
        })
      }),
    )

    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('https://graphql.anilist.co')
    expect(calls[0]?.payload).toEqual({
      query: expect.any(String),
      variables: { query: 'frieren', perPage: 5 },
    })
    const document = (calls[0]?.payload as { query: string }).query
    expect(document).toMatch(/anime:\s*Page\(page:\s*1,\s*perPage:\s*\$perPage\)/)
    expect(document).toMatch(/characters:\s*Page\(page:\s*1,\s*perPage:\s*\$perPage\)/)
    expect(document).toMatch(/staff:\s*Page\(page:\s*1,\s*perPage:\s*\$perPage\)/)
    expect(document).toContain('media(search: $query, type: ANIME, isAdult: false, sort: SEARCH_MATCH)')
    expect(document).toContain('characters(search: $query, sort: SEARCH_MATCH)')
    expect(document).toContain('staff(search: $query, sort: SEARCH_MATCH)')
    expect(document).not.toMatch(/\bUser\b|\bMANGA\b/)
    expect(result).toEqual({
      anime: [{
        id: '52991',
        label: "Frieren: Beyond Journey's End",
        imageUrl: 'https://img.example/frieren.webp',
        metadata: 'TV · 2023',
        destination: '/anime/52991/frieren-beyond-journeys-end',
      }],
      characters: [{
        id: '12',
        label: 'Flamme',
        imageUrl: 'https://img.example/flamme.webp',
        metadata: 'フランメ',
        destination: '/characters/12/flamme',
      }],
      staff: [{
        id: '21',
        label: "Tanezaki Atsumi's",
        imageUrl: 'https://img.example/tanezaki.webp',
        metadata: '種﨑 敦美',
        destination: '/staff/21/tanezaki-atsumis',
      }],
    })
  })

  test('uses title priority, nullable metadata and Unicode-safe destinations', async () => {
    const value = body()
    value.data.anime.media = [
      {
        ...media,
        id: 1,
        title: { english: ' ', romaji: '  Café 葬送’s Song  ', native: '別名' },
        coverImage: null,
        format: null,
        seasonYear: null,
      },
      {
        ...media,
        id: 2,
        title: { english: null, romaji: ' ', native: '  葬送のフリーレン  ' },
        format: 'MOVIE',
        seasonYear: null,
      },
      {
        ...media,
        id: 3,
        title: { english: 'Year Only', romaji: null, native: null },
        format: null,
        seasonYear: 2024,
      },
    ]
    value.data.characters.characters = [{
      ...character,
      name: { full: '  Élan O’Connor  ', native: ' ' },
      image: null,
    }]

    await expect(searchQuickCatalogFromAniList(
      'aa',
      responseDependencies([jsonResponse(value)]),
    )).resolves.toMatchObject({
      anime: [
        {
          label: 'Café 葬送’s Song',
          imageUrl: null,
          metadata: null,
          destination: '/anime/1/caf%C3%A9-%E8%91%AC%E9%80%81s-song',
        },
        { label: '葬送のフリーレン', metadata: 'MOVIE' },
        { label: 'Year Only', metadata: '2024' },
      ],
      characters: [{
        label: 'Élan O’Connor',
        metadata: null,
        imageUrl: null,
        destination: '/characters/12/%C3%A9lan-oconnor',
      }],
    })
  })

  test('accepts three empty provider groups', async () => {
    const value = body()
    value.data.anime.media = []
    value.data.characters.characters = []
    value.data.staff.staff = []

    await expect(searchQuickCatalogFromAniList(
      'empty',
      responseDependencies([jsonResponse(value)]),
    )).resolves.toEqual({ anime: [], characters: [], staff: [] })
  })

  test.each([
    ['root extra', () => ({ ...body(), secret: true })],
    ['data extra', () => ({ ...body(), data: { ...body().data, users: {} } })],
    ['page extra', () => {
      const value = body()
      return { data: { ...value.data, anime: { ...value.data.anime, total: 1 } } }
    }],
    ['pageInfo extra', () => {
      const value = body()
      value.data.anime.pageInfo = { currentPage: 1, hasNextPage: false } as never
      return value
    }],
    ['item extra', () => {
      const value = body()
      value.data.anime.media = [{
        ...media,
        genres: ['Fantasy'],
      } as unknown as ProviderMedia]
      return value
    }],
    ['title extra', () => {
      const value = body()
      value.data.anime.media = [{
        ...media,
        title: {
          ...media.title,
          userPreferred: 'x',
        } as unknown as ProviderTitle,
      }]
      return value
    }],
    ['name extra', () => {
      const value = body()
      value.data.characters.characters = [{
        ...character,
        name: {
          ...character.name,
          userPreferred: 'x',
        } as unknown as ProviderPerson['name'],
      }]
      return value
    }],
    ['image extra', () => {
      const value = body()
      value.data.staff.staff = [{
        ...staff,
        image: {
          large: staff.image?.large ?? 'https://x.test/a',
          medium: 'https://x.test/a',
        } as unknown as ProviderImage,
      }]
      return value
    }],
  ])('rejects strict %s fields as sanitized upstream errors', async (_name, createValue) => {
    await expect(searchQuickCatalogFromAniList(
      'strict',
      responseDependencies([jsonResponse(createValue())]),
    )).rejects.toMatchObject({
      name: 'AniListRequestError',
      code: 'UPSTREAM',
      message: 'AniList is temporarily unavailable.',
      retryAfterSeconds: null,
    })
  })

  test.each([
    ['missing alias', () => {
      const value = body()
      const { staff: _staff, ...withoutStaff } = value.data
      return { data: withoutStaff }
    }],
    ['wrong page', () => {
      const value = body()
      value.data.characters.pageInfo.currentPage = 2
      return value
    }],
    ['Manga row', () => {
      const value = body()
      value.data.anime.media = [{ ...media, type: 'MANGA' }]
      return value
    }],
    ['adult row', () => {
      const value = body()
      value.data.anime.media = [{ ...media, isAdult: true }]
      return value
    }],
    ['blank anime label', () => {
      const value = body()
      value.data.anime.media = [{
        ...media,
        title: { english: ' ', romaji: '\n', native: '' },
      }]
      return value
    }],
    ['blank person label', () => {
      const value = body()
      value.data.staff.staff = [{ ...staff, name: { full: ' ', native: null } }]
      return value
    }],
    ['six rows', () => {
      const value = body()
      value.data.anime.media = Array.from({ length: 6 }, (_, index) => ({
        ...media,
        id: index + 1,
      }))
      return value
    }],
    ['HTTP image', () => {
      const value = body()
      value.data.characters.characters = [{
        ...character,
        image: { large: 'http://img.example/flamme.webp' },
      }]
      return value
    }],
  ])('rejects %s for the whole response', async (_name, createValue) => {
    await expect(searchQuickCatalogFromAniList(
      'invalid',
      responseDependencies([jsonResponse(createValue())]),
    )).rejects.toMatchObject({ code: 'UPSTREAM' })
  })

  test('preserves transport errors and sanitizes live-shaped upstream failures', async () => {
    await expect(searchQuickCatalogFromAniList(
      '404',
      responseDependencies([jsonResponse({ data: { anime: null } }, 404)]),
    )).rejects.toMatchObject({ code: 'UPSTREAM', retryAfterSeconds: null })
    await expect(searchQuickCatalogFromAniList(
      'graphql',
      responseDependencies([jsonResponse({
        errors: [{ message: 'private provider detail' }],
        data: { anime: null },
      })]),
    )).rejects.toMatchObject({ code: 'UPSTREAM', message: 'AniList is temporarily unavailable.' })
    const limited = searchQuickCatalogFromAniList(
      'limited',
      responseDependencies([
        new Response('provider secret', {
          status: 429,
          headers: { 'retry-after': '15' },
        }),
      ]),
    )
    await expect(limited).rejects.toBeInstanceOf(AniListRequestError)
    await expect(limited).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryAfterSeconds: 15,
      message: 'AniList rate limit exceeded.',
    })
  })

  test('returns only provider-neutral public row fields', async () => {
    const result = await searchQuickCatalogFromAniList(
      'privacy',
      responseDependencies([jsonResponse(body())]),
    )
    expect(Object.keys(result)).toEqual(['anime', 'characters', 'staff'])
    for (const rows of Object.values(result)) {
      for (const row of rows) {
        expect(Object.keys(row)).toEqual([
          'id',
          'label',
          'imageUrl',
          'metadata',
          'destination',
        ])
      }
    }
    expect(JSON.stringify(result)).not.toMatch(/isAdult|romaji|native|format|seasonYear|provider|user/i)
  })

  test('wraps unexpected dependency failures as sanitized upstream errors', async () => {
    const dependencies = responseDependencies([])
    dependencies.fetch = vi.fn(async () => {
      throw new RangeError('private dependency failure')
    })

    await expect(searchQuickCatalogFromAniList('wrap', dependencies)).rejects.toMatchObject({
      code: 'UPSTREAM',
      message: 'AniList is temporarily unavailable.',
    })
  })
})
