import { z } from 'zod'

import {
  AniListRequestError,
  requestAniList,
  type AniListDependencies,
} from '../../../lib/anilist-client.server'
import { slugifyAnimeTitle } from '../../discover/shared/discover-contracts'
import {
  createQuickSearchDestination,
  normalizeSearchQuery,
  quickSearchGroupsSchema,
  type QuickSearchRow,
} from '../shared/quick-search-contracts'

const QUICK_SEARCH_DOCUMENT = `
  query QuickCatalogSearch($query: String!, $perPage: Int!) {
    anime: Page(page: 1, perPage: $perPage) {
      pageInfo { currentPage }
      media(search: $query, type: ANIME, isAdult: false, sort: SEARCH_MATCH) {
        id type isAdult
        title { english romaji native }
        coverImage { large }
        format seasonYear
      }
    }
    characters: Page(page: 1, perPage: $perPage) {
      pageInfo { currentPage }
      characters(search: $query, sort: SEARCH_MATCH) {
        id name { full native } image { large }
      }
    }
    staff: Page(page: 1, perPage: $perPage) {
      pageInfo { currentPage }
      staff(search: $query, sort: SEARCH_MATCH) {
        id name { full native } image { large }
      }
    }
  }
`

const positiveIdSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const httpsUrlSchema = z.url({ protocol: /^https$/ })
const pageInfoSchema = z.object({ currentPage: z.literal(1) }).strict()
const imageSchema = z.object({ large: httpsUrlSchema.nullable() }).strict().nullable()
const personSchema = z.object({
  id: positiveIdSchema,
  name: z.object({
    full: z.string(),
    native: z.string().nullable(),
  }).strict(),
  image: imageSchema,
}).strict()
const animeSchema = z.object({
  id: positiveIdSchema,
  type: z.literal('ANIME'),
  isAdult: z.literal(false),
  title: z.object({
    english: z.string().nullable(),
    romaji: z.string().nullable(),
    native: z.string().nullable(),
  }).strict(),
  coverImage: imageSchema,
  format: z.enum(['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA', 'MUSIC']).nullable(),
  seasonYear: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
}).strict()
const quickSearchResponseSchema = z.object({
  data: z.object({
    anime: z.object({
      pageInfo: pageInfoSchema,
      media: z.array(animeSchema).max(5),
    }).strict(),
    characters: z.object({
      pageInfo: pageInfoSchema,
      characters: z.array(personSchema).max(5),
    }).strict(),
    staff: z.object({
      pageInfo: pageInfoSchema,
      staff: z.array(personSchema).max(5),
    }).strict(),
  }).strict(),
}).strict()

type ParsedAnime = z.infer<typeof animeSchema>
type ParsedPerson = z.infer<typeof personSchema>
type PersonKind = 'character' | 'staff'

const upstreamError = (): AniListRequestError =>
  new AniListRequestError('UPSTREAM', 'AniList is temporarily unavailable.', null)

const text = (value: string | null): string | null => {
  if (value === null) return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

const animeMetadata = (anime: ParsedAnime): string | null => {
  const format = anime.format?.replaceAll('_', ' ') ?? null
  if (format !== null && anime.seasonYear !== null) {
    return `${format} · ${anime.seasonYear}`
  }
  if (format !== null) return format
  if (anime.seasonYear !== null) return String(anime.seasonYear)
  return null
}

/** Converts strict Anime provider data into one public Quick Search row. */
const normalizeAnimeRow = (anime: ParsedAnime): QuickSearchRow => {
  const label = text(anime.title.english)
    ?? text(anime.title.romaji)
    ?? text(anime.title.native)
  if (label === null) throw upstreamError()

  return {
    id: String(anime.id),
    label,
    imageUrl: anime.coverImage?.large ?? null,
    metadata: animeMetadata(anime),
    destination: createQuickSearchDestination({
      kind: 'anime',
      id: anime.id,
      slug: slugifyAnimeTitle(label),
    }),
  }
}

/** Converts strict Character or Staff data into one public Quick Search row. */
const normalizePersonRow = (
  kind: PersonKind,
  person: ParsedPerson,
): QuickSearchRow => {
  const label = text(person.name.full)
  if (label === null) throw upstreamError()

  return {
    id: String(person.id),
    label,
    imageUrl: person.image?.large ?? null,
    metadata: text(person.name.native),
    destination: createQuickSearchDestination({
      kind,
      id: person.id,
      label,
    }),
  }
}

export interface QuickCatalogSearchResult {
  anime: QuickSearchRow[]
  characters: QuickSearchRow[]
  staff: QuickSearchRow[]
}

/** Searches all public provider groups through one strict AniList operation. */
export const searchQuickCatalogFromAniList = async (
  query: string,
  dependencies: AniListDependencies,
): Promise<QuickCatalogSearchResult> => {
  try {
    const normalizedQuery = normalizeSearchQuery(query)
    const body = await requestAniList(
      QUICK_SEARCH_DOCUMENT,
      { query: normalizedQuery, perPage: 5 },
      dependencies,
    )
    const parsed = quickSearchResponseSchema.parse(body).data
    const groups = quickSearchGroupsSchema.parse({
      anime: parsed.anime.media.map(normalizeAnimeRow),
      characters: parsed.characters.characters.map((person) =>
        normalizePersonRow('character', person)),
      staff: parsed.staff.staff.map((person) => normalizePersonRow('staff', person)),
      users: [],
    })

    return {
      anime: groups.anime,
      characters: groups.characters,
      staff: groups.staff,
    }
  } catch (error) {
    if (error instanceof AniListRequestError) throw error
    throw upstreamError()
  }
}
