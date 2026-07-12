import { z } from 'zod'

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
  anilistId: number
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

const animeDateSchema = z.object({
  year: z.number().int().nullable(),
  month: z.number().int().min(1).max(12).nullable(),
  day: z.number().int().min(1).max(31).nullable(),
})

const anilistLightweightMediaSchema = z.object({
  id: z.number().int().positive(),
  type: z.literal('ANIME'),
  isAdult: z.boolean(),
  title: z.object({
    english: z.string().nullable(),
    romaji: z.string().nullable(),
    native: z.string().nullable(),
  }),
  coverImage: z.object({ large: z.url().nullable() }).nullable(),
  bannerImage: z.url().nullable(),
  format: animeFormatSchema.nullable(),
  season: animeSeasonSchema.nullable(),
  seasonYear: z.number().int().nullable(),
  episodes: z.number().int().nonnegative().nullable(),
  genres: z.array(z.string()),
  popularity: z.number().int().nonnegative(),
  averageScore: z.number().int().min(0).max(100).nullable(),
  trending: z.number().int().nonnegative().nullable(),
  startDate: animeDateSchema.nullable(),
  nextAiringEpisode: z.object({ airingAt: z.number().int().nonnegative() }).nullable(),
})

const trimTitle = (value: string | null): string | null => {
  if (value === null) {
    return null
  }

  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : null
}

class AnimeMediaValidationError extends TypeError {
  readonly cause: z.ZodError

  constructor(message: string, cause: z.ZodError) {
    super(message)
    this.name = 'AnimeMediaValidationError'
    this.cause = cause
  }
}

/** Converts Zod failures into safe actionable normalization errors. */
const createMediaValidationError = (error: z.ZodError): TypeError => {
  const issue = error.issues[0]
  if (issue === undefined) {
    throw new AnimeMediaValidationError(
      'AniList media validation failed without a reported issue.',
      error,
    )
  }

  const path = issue.path.length > 0 ? issue.path.join('.') : 'root'
  return new AnimeMediaValidationError(
    `Invalid AniList media at ${path}: ${issue.message}`,
    error,
  )
}

/** Creates a URL-safe display slug from a real AniList title. */
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

/** Converts unknown AniList lightweight media into an app-safe summary. */
export const normalizeAnimeSummary = (value: unknown): AnimeSummary => {
  const parsedMedia = anilistLightweightMediaSchema.safeParse(value)
  if (!parsedMedia.success) {
    throw createMediaValidationError(parsedMedia.error)
  }
  if (parsedMedia.data.isAdult) {
    throw new TypeError('Adult media is not supported.')
  }

  const english = trimTitle(parsedMedia.data.title.english)
  const romaji = trimTitle(parsedMedia.data.title.romaji)
  const native = trimTitle(parsedMedia.data.title.native)
  const display = english ?? romaji ?? native
  if (display === null) {
    throw new TypeError('AniList media requires a title.')
  }

  const genres = [...new Set(parsedMedia.data.genres.map((genre) => genre.trim()).filter(Boolean))]

  return {
    anilistId: parsedMedia.data.id,
    slug: slugifyAnimeTitle(display),
    titles: { display, english, romaji, native },
    coverImageUrl: parsedMedia.data.coverImage?.large ?? null,
    bannerImageUrl: parsedMedia.data.bannerImage,
    format: parsedMedia.data.format,
    season: parsedMedia.data.season,
    seasonYear: parsedMedia.data.seasonYear,
    episodes: parsedMedia.data.episodes,
    genres,
    popularity: parsedMedia.data.popularity,
    averageScore: parsedMedia.data.averageScore,
    trending: parsedMedia.data.trending,
    startDate: parsedMedia.data.startDate,
    nextAiringAt: parsedMedia.data.nextAiringEpisode?.airingAt ?? null,
  }
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
