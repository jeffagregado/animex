import { z } from 'zod'

export const ANIME_PROVIDER_PEOPLE_PER_PAGE = 24 as const

const positiveSafeIntegerSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const nullableHttpsUrlSchema = z.url({ protocol: /^https$/ }).nullable()
const animeFormatSchema = z.enum(['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA', 'MUSIC'])
const animeSeasonSchema = z.enum(['WINTER', 'SPRING', 'SUMMER', 'FALL'])
const animeMediaStatusSchema = z.enum([
  'FINISHED',
  'RELEASING',
  'NOT_YET_RELEASED',
  'CANCELLED',
  'HIATUS',
])

export type AnimeProviderFormat = z.infer<typeof animeFormatSchema>
export type AnimeProviderSeason = z.infer<typeof animeSeasonSchema>
export type AnimeProviderMediaStatus = z.infer<typeof animeMediaStatusSchema>
export type AnimeProviderPeopleKind = 'characters' | 'staff'

export interface AnimeProviderDate {
  year: number | null
  month: number | null
  day: number | null
}

export interface AnimeProviderTitles {
  display: string
  english: string | null
  romaji: string | null
  native: string | null
}

export interface AnimeProviderListItem {
  anilistId: number
  slug: string
  title: string
  coverImageUrl: string | null
  format: AnimeProviderFormat | null
  seasonYear: number | null
}

export interface AnimeProviderVoiceActor {
  anilistId: number
  name: string
  imageUrl: string | null
  language: 'Japanese'
}

export interface AnimeProviderCharacter {
  anilistId: number
  name: string
  role: 'MAIN' | 'SUPPORTING' | 'BACKGROUND'
  imageUrl: string | null
  japaneseVoiceActor: AnimeProviderVoiceActor | null
}

export interface AnimeProviderStaff {
  anilistId: number
  name: string
  role: string
  imageUrl: string | null
}

export interface AnimeProviderPeoplePage<T> {
  items: T[]
  currentPage: number
  hasNextPage: boolean
  perPage: 24
}

export interface AnimeDetailProvider {
  anilistId: number
  slug: string
  titles: AnimeProviderTitles
  coverImageUrl: string | null
  bannerImageUrl: string | null
  synopsis: string | null
  format: AnimeProviderFormat | null
  status: AnimeProviderMediaStatus | null
  source: string | null
  season: AnimeProviderSeason | null
  seasonYear: number | null
  episodes: number | null
  durationMinutes: number | null
  startDate: AnimeProviderDate | null
  endDate: AnimeProviderDate | null
  genres: string[]
  mainStudio: { name: string; siteUrl: string | null } | null
  related: AnimeProviderListItem[]
  recommendations: AnimeProviderListItem[]
  trailer: { youtubeId: string; thumbnailUrl: string | null } | null
  externalLinks: { site: string; url: string }[]
  charactersPage: AnimeProviderPeoplePage<AnimeProviderCharacter>
  staffPage: AnimeProviderPeoplePage<AnimeProviderStaff>
}

export interface AnimeSummaryProvider {
  anilistId: number
  slug: string
  titles: AnimeProviderTitles
  coverImageUrl: string | null
  bannerImageUrl: string | null
  format: AnimeProviderFormat | null
  season: AnimeProviderSeason | null
  seasonYear: number | null
  episodes: number | null
  genres: string[]
  popularity: number
  averageScore: number | null
  trending: number | null
  startDate: AnimeProviderDate | null
  nextAiringAt: number | null
}

export type AnimeDetailServerState =
  | { status: 'ready'; entry: { detail: AnimeDetailProvider; refreshedAt: number; expiresAt: number } }
  | { status: 'not-found'; code: 'NOT_FOUND'; message: string }
  | { status: 'error'; code: 'UPSTREAM' | 'RATE_LIMITED'; message: string; retryAfterSeconds: number | null }

/** Validates canonical numeric identity at provider/cache boundary. */
export const parseProviderAnilistId = (value: unknown): number => {
  const result = positiveSafeIntegerSchema.safeParse(value)
  if (!result.success) {
    throw new RangeError('AniList ID must be a positive safe integer.', { cause: result.error })
  }
  return result.data
}

/** Validates one-based provider pagination input. */
export const parseProviderAnimePage = (value: unknown): number => {
  const result = positiveSafeIntegerSchema.safeParse(value)
  if (!result.success) {
    throw new RangeError('Page must be a positive safe integer.', { cause: result.error })
  }
  return result.data
}

/** Creates stable cache slugs without browser-contract dependencies. */
export const slugifyProviderAnimeTitle = (title: string): string => {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[\u0027\u2019]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  if (slug.length === 0) throw new TypeError('Anime title cannot produce a slug.')
  return slug
}

export const animeProviderFormatSchema = animeFormatSchema

const animeDateSchema: z.ZodType<AnimeProviderDate> = z.object({
  year: z.number().int().nullable(),
  month: z.number().int().min(1).max(12).nullable(),
  day: z.number().int().min(1).max(31).nullable(),
}).strict()

const animeTitlesSchema: z.ZodType<AnimeProviderTitles> = z.object({
  display: z.string().trim().min(1),
  english: z.string().trim().min(1).nullable(),
  romaji: z.string().trim().min(1).nullable(),
  native: z.string().trim().min(1).nullable(),
}).strict()

const animeListItemSchema: z.ZodType<AnimeProviderListItem> = z.object({
  anilistId: positiveSafeIntegerSchema,
  slug: z.string().min(1),
  title: z.string().trim().min(1),
  coverImageUrl: nullableHttpsUrlSchema,
  format: animeFormatSchema.nullable(),
  seasonYear: z.number().int().positive().nullable(),
}).strict()

const animeVoiceActorSchema: z.ZodType<AnimeProviderVoiceActor> = z.object({
  anilistId: positiveSafeIntegerSchema,
  name: z.string().trim().min(1),
  imageUrl: nullableHttpsUrlSchema,
  language: z.literal('Japanese'),
}).strict()

const animeCharacterSchema: z.ZodType<AnimeProviderCharacter> = z.object({
  anilistId: positiveSafeIntegerSchema,
  name: z.string().trim().min(1),
  role: z.enum(['MAIN', 'SUPPORTING', 'BACKGROUND']),
  imageUrl: nullableHttpsUrlSchema,
  japaneseVoiceActor: animeVoiceActorSchema.nullable(),
}).strict()

const animeStaffSchema: z.ZodType<AnimeProviderStaff> = z.object({
  anilistId: positiveSafeIntegerSchema,
  name: z.string().trim().min(1),
  role: z.string().trim().min(1),
  imageUrl: nullableHttpsUrlSchema,
}).strict()

const createPeoplePageSchema = <T>(
  itemSchema: z.ZodType<T>,
): z.ZodType<AnimeProviderPeoplePage<T>> => z.object({
  items: z.array(itemSchema).max(ANIME_PROVIDER_PEOPLE_PER_PAGE),
  currentPage: positiveSafeIntegerSchema,
  hasNextPage: z.boolean(),
  perPage: z.literal(ANIME_PROVIDER_PEOPLE_PER_PAGE),
}).strict()

export const animeProviderCharacterPageSchema = createPeoplePageSchema(animeCharacterSchema)
export const animeProviderStaffPageSchema = createPeoplePageSchema(animeStaffSchema)
const initialCharacterPageSchema = animeProviderCharacterPageSchema.refine(
  (page) => page.currentPage === 1,
  { error: 'Initial Characters page must be page 1.', path: ['currentPage'] },
)
const initialStaffPageSchema = animeProviderStaffPageSchema.refine(
  (page) => page.currentPage === 1,
  { error: 'Initial Staff page must be page 1.', path: ['currentPage'] },
)

export const animeDetailProviderSchema = z.object({
  anilistId: positiveSafeIntegerSchema,
  slug: z.string().min(1),
  titles: animeTitlesSchema,
  coverImageUrl: nullableHttpsUrlSchema,
  bannerImageUrl: nullableHttpsUrlSchema,
  synopsis: z.string().trim().min(1).nullable(),
  format: animeFormatSchema.nullable(),
  status: animeMediaStatusSchema.nullable(),
  source: z.string().trim().min(1).nullable(),
  season: animeSeasonSchema.nullable(),
  seasonYear: z.number().int().positive().nullable(),
  episodes: z.number().int().nonnegative().nullable(),
  durationMinutes: z.number().int().positive().nullable(),
  startDate: animeDateSchema.nullable(),
  endDate: animeDateSchema.nullable(),
  genres: z.array(z.string().trim().min(1)),
  mainStudio: z.object({
    name: z.string().trim().min(1),
    siteUrl: nullableHttpsUrlSchema,
  }).strict().nullable(),
  related: z.array(animeListItemSchema).max(5),
  recommendations: z.array(animeListItemSchema).max(5),
  trailer: z.object({
    youtubeId: z.string().trim().min(1),
    thumbnailUrl: nullableHttpsUrlSchema,
  }).strict().nullable(),
  externalLinks: z.array(z.object({
    site: z.string().trim().min(1),
    url: z.url({ protocol: /^https$/ }),
  }).strict()).max(8),
  charactersPage: initialCharacterPageSchema,
  staffPage: initialStaffPageSchema,
}).strict() satisfies z.ZodType<AnimeDetailProvider>
