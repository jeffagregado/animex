import { z } from 'zod'

import {
  parseCatalogPublicId,
  type CatalogPublicId,
} from '../../catalog-identity/shared/catalog-identity-contracts'

export const animeFormatSchema = z.enum(['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA', 'MUSIC'])
export const animeSeasonSchema = z.enum(['WINTER', 'SPRING', 'SUMMER', 'FALL'])
export const discoverSectionKeySchema = z.enum(['trending', 'seasonal', 'recommendations', 'upcoming'])
export const animeSearchSortSchema = z.enum(['relevance', 'trending', 'popularity', 'score', 'newest'])
export const DISCOVER_GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Mystery',
  'Supernatural',
] as const
const animeGenreSchema = z.enum(DISCOVER_GENRES)

export type AnimeFormat = z.infer<typeof animeFormatSchema>
export type AnimeSeason = z.infer<typeof animeSeasonSchema>
export type DiscoverSectionKey = z.infer<typeof discoverSectionKeySchema>
export type AnimeSearchSort = z.infer<typeof animeSearchSortSchema>
export type AnimeGenre = z.infer<typeof animeGenreSchema>

export interface AnimeDate {
  year: number | null
  month: number | null
  day: number | null
}

export interface AnimeTitles {
  display: string
  english: string | null
  romaji: string | null
  native: string | null
}

export interface AnimeSummary {
  publicId: CatalogPublicId
  slug: string
  titles: AnimeTitles
  coverImageUrl: string | null
  bannerImageUrl: string | null
  format: AnimeFormat | null
  season: AnimeSeason | null
  seasonYear: number | null
  episodes: number | null
  genres: string[]
  popularity: number
  averageScore: number | null
  trending: number | null
  startDate: AnimeDate | null
  nextAiringAt: number | null
}

const catalogPublicIdSchema = z.string().transform((value, context) => {
  try {
    return parseCatalogPublicId(value)
  } catch {
    context.addIssue({ code: 'custom', message: 'CATALOG_PUBLIC_ID_INVALID' })
    return z.NEVER
  }
})

const animeDateSchema: z.ZodType<AnimeDate> = z.object({
  year: z.number().int().nullable(),
  month: z.number().int().min(1).max(12).nullable(),
  day: z.number().int().min(1).max(31).nullable(),
}).strict()

const animeTitlesSchema: z.ZodType<AnimeTitles> = z.object({
  display: z.string().trim().min(1),
  english: z.string().trim().min(1).nullable(),
  romaji: z.string().trim().min(1).nullable(),
  native: z.string().trim().min(1).nullable(),
}).strict()

export const animeSummarySchema: z.ZodType<AnimeSummary> = z.object({
  publicId: catalogPublicIdSchema,
  slug: z.string().trim().min(1),
  titles: animeTitlesSchema,
  coverImageUrl: z.url().nullable(),
  bannerImageUrl: z.url().nullable(),
  format: animeFormatSchema.nullable(),
  season: animeSeasonSchema.nullable(),
  seasonYear: z.number().int().nullable(),
  episodes: z.number().int().nonnegative().nullable(),
  genres: z.array(z.string().trim().min(1)),
  popularity: z.number().int().nonnegative(),
  averageScore: z.number().int().min(0).max(100).nullable(),
  trending: z.number().int().nonnegative().nullable(),
  startDate: animeDateSchema.nullable(),
  nextAiringAt: z.number().int().nonnegative().nullable(),
}).strict()

export interface DiscoverSection {
  key: DiscoverSectionKey
  items: AnimeSummary[]
  refreshedAt: number
  expiresAt: number
}

export type DiscoverSectionState =
  | { status: 'ready'; section: DiscoverSection }
  | {
    status: 'error'
    key: DiscoverSectionKey
    code: 'UPSTREAM' | 'RATE_LIMITED' | 'CACHE_REFRESH'
    retryAfterSeconds: number | null
  }

export interface DiscoverPageData {
  sections: Record<DiscoverSectionKey, DiscoverSectionState>
}

export interface AnimeSearchInput {
  query: string | null
  genre: AnimeGenre | null
  format: AnimeFormat | null
  season: AnimeSeason | null
  year: number | null
  sort: AnimeSearchSort
  page: number
}

export interface AnimeSearchPage {
  items: AnimeSummary[]
  currentPage: number
  hasNextPage: boolean
  perPage: 20
}

export interface DiscoverSectionConfig {
  ttlMs: number
  itemLimit: number
}

export const DISCOVER_SECTION_CONFIG: Record<DiscoverSectionKey, DiscoverSectionConfig> = {
  trending: { ttlMs: 3 * 60 * 60 * 1000, itemLimit: 12 },
  seasonal: { ttlMs: 24 * 60 * 60 * 1000, itemLimit: 12 },
  recommendations: { ttlMs: 24 * 60 * 60 * 1000, itemLimit: 16 },
  upcoming: { ttlMs: 6 * 60 * 60 * 1000, itemLimit: 10 },
}

const trimmedGenreSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(animeGenreSchema)
  .nullable()

export const animeSearchInputSchema: z.ZodType<AnimeSearchInput> = z
  .object({
    query: z
      .string()
      .transform((value) => value.trim())
      .pipe(z.string().min(2).max(100))
      .nullable(),
    genre: trimmedGenreSchema,
    format: animeFormatSchema.nullable(),
    season: animeSeasonSchema.nullable(),
    year: z.number().int().positive().nullable(),
    sort: animeSearchSortSchema,
    page: z.number().int().positive(),
  })
  .strict()
  .refine((value) => Boolean(value.query || value.genre || value.format || value.season || value.year), {
    error: 'Choose a search term or filter.',
  })

/** Creates a URL-safe display slug from an anime title. */
export const slugifyAnimeTitle = (title: string): string => {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[\u0027\u2019]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')

  if (slug.length === 0) {
    throw new TypeError('Anime title cannot produce a slug.')
  }

  return slug
}

/** Returns calendar season for a UTC timestamp. */
export const getAnimeSeason = (timestampMs: number): AnimeSeason => {
  const date = new Date(timestampMs)
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('Timestamp must be valid.')
  }

  const quarter = Math.floor(date.getUTCMonth() / 3)
  return ['WINTER', 'SPRING', 'SUMMER', 'FALL'][quarter] as AnimeSeason
}
