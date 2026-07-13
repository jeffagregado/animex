import { z } from 'zod'

import {
  animeFormatSchema,
  animeSeasonSchema,
  slugifyAnimeTitle,
  type AnimeDate,
  type AnimeFormat,
  type AnimeSeason,
  type AnimeTitles,
} from '../../discover/shared/discover-contracts'

export const ANIME_RELATED_LIMIT = 5 as const
export const ANIME_RECOMMENDATIONS_LIMIT = 5 as const
export const ANIME_PEOPLE_PER_PAGE = 24 as const
export const ANIME_REWATCHES_PER_PAGE = 20 as const
export const ANIME_EXTERNAL_LINKS_LIMIT = 8 as const
export const ANIME_DETAIL_CACHE_TTL_MS = 24 * 60 * 60 * 1000

export const animeDetailTabSchema = z.enum(['overview', 'reviews', 'characters', 'staff'])
export const animePeopleKindSchema = z.enum(['characters', 'staff'])
export const animeStatusSchema = z.enum(['watching', 'planned', 'dropped', 'completed', 'rewatched'])
export const animeScoreSchema = z.number().min(0).max(10).multipleOf(0.1).nullable()

export type AnimeDetailTab = z.infer<typeof animeDetailTabSchema>
export type AnimePeopleKind = z.infer<typeof animePeopleKindSchema>
export type AnimeStatus = z.infer<typeof animeStatusSchema>
export type AnimeScore = z.infer<typeof animeScoreSchema>

const positiveSafeIntegerSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)

/** Validates canonical AniList identity. */
export const parseAnilistId = (value: unknown): number => {
  const result = positiveSafeIntegerSchema.safeParse(value)
  if (!result.success) {
    throw new RangeError('AniList ID must be a positive safe integer.', { cause: result.error })
  }
  return result.data
}

/** Validates one-based pagination input. */
export const parseAnimePage = (value: unknown): number => {
  const result = positiveSafeIntegerSchema.safeParse(value)
  if (!result.success) {
    throw new RangeError('Page must be a positive safe integer.', { cause: result.error })
  }
  return result.data
}

/** Converts untrusted URL search state to one supported tab. */
export const normalizeAnimeDetailTab = (value: unknown): AnimeDetailTab => {
  const result = animeDetailTabSchema.safeParse(value)
  return result.success ? result.data : 'overview'
}

/** Builds canonical detail URL from validated identity and real title. */
export const createCanonicalAnimePath = (
  anilistId: number,
  title: string,
  tab: AnimeDetailTab,
): string => {
  const id = parseAnilistId(anilistId)
  const slug = encodeURIComponent(slugifyAnimeTitle(title))
  const path = `/anime/${id}/${slug}`
  return tab === 'overview' ? path : `${path}?tab=${tab}`
}

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

const nullableHttpsUrlSchema = z.url({ protocol: /^https$/ }).nullable()
const animeMediaStatusSchema = z.enum([
  'FINISHED',
  'RELEASING',
  'NOT_YET_RELEASED',
  'CANCELLED',
  'HIATUS',
])

export type AnimeMediaStatus = z.infer<typeof animeMediaStatusSchema>

export interface AnimeDetailListItem {
  anilistId: number
  slug: string
  title: string
  coverImageUrl: string | null
  format: AnimeFormat | null
  seasonYear: number | null
}

const animeDetailListItemSchema: z.ZodType<AnimeDetailListItem> = z.object({
  anilistId: positiveSafeIntegerSchema,
  slug: z.string().min(1),
  title: z.string().trim().min(1),
  coverImageUrl: nullableHttpsUrlSchema,
  format: animeFormatSchema.nullable(),
  seasonYear: z.number().int().positive().nullable(),
}).strict()

export interface AnimeStudio {
  name: string
  siteUrl: string | null
}

const animeStudioSchema: z.ZodType<AnimeStudio> = z.object({
  name: z.string().trim().min(1),
  siteUrl: nullableHttpsUrlSchema,
}).strict()

export interface AnimeTrailer {
  youtubeId: string
  thumbnailUrl: string | null
}

const animeTrailerSchema: z.ZodType<AnimeTrailer> = z.object({
  youtubeId: z.string().trim().min(1),
  thumbnailUrl: nullableHttpsUrlSchema,
}).strict()

export interface AnimeExternalLink {
  site: string
  url: string
}

const animeExternalLinkSchema: z.ZodType<AnimeExternalLink> = z.object({
  site: z.string().trim().min(1),
  url: z.url({ protocol: /^https$/ }),
}).strict()

export interface AnimeVoiceActor {
  anilistId: number
  name: string
  imageUrl: string | null
  language: 'Japanese'
}

export interface AnimeCharacter {
  anilistId: number
  name: string
  role: 'MAIN' | 'SUPPORTING' | 'BACKGROUND'
  imageUrl: string | null
  japaneseVoiceActor: AnimeVoiceActor | null
}

export interface AnimeStaff {
  anilistId: number
  name: string
  role: string
  imageUrl: string | null
}

export interface AnimePeoplePage<T> {
  items: T[]
  currentPage: number
  hasNextPage: boolean
  perPage: 24
}

export const animeVoiceActorSchema: z.ZodType<AnimeVoiceActor> = z.object({
  anilistId: positiveSafeIntegerSchema,
  name: z.string().trim().min(1),
  imageUrl: nullableHttpsUrlSchema,
  language: z.literal('Japanese'),
}).strict()

export const animeCharacterSchema: z.ZodType<AnimeCharacter> = z.object({
  anilistId: positiveSafeIntegerSchema,
  name: z.string().trim().min(1),
  role: z.enum(['MAIN', 'SUPPORTING', 'BACKGROUND']),
  imageUrl: nullableHttpsUrlSchema,
  japaneseVoiceActor: animeVoiceActorSchema.nullable(),
}).strict()

export const animeStaffSchema: z.ZodType<AnimeStaff> = z.object({
  anilistId: positiveSafeIntegerSchema,
  name: z.string().trim().min(1),
  role: z.string().trim().min(1),
  imageUrl: nullableHttpsUrlSchema,
}).strict()

const createAnimePeoplePageSchema = <T>(itemSchema: z.ZodType<T>): z.ZodType<AnimePeoplePage<T>> => z.object({
  items: z.array(itemSchema).max(ANIME_PEOPLE_PER_PAGE),
  currentPage: positiveSafeIntegerSchema,
  hasNextPage: z.boolean(),
  perPage: z.literal(ANIME_PEOPLE_PER_PAGE),
}).strict()

export const animeCharacterPageSchema = createAnimePeoplePageSchema(animeCharacterSchema)
export const animeStaffPageSchema = createAnimePeoplePageSchema(animeStaffSchema)
const initialAnimeCharacterPageSchema = animeCharacterPageSchema.refine(
  (page) => page.currentPage === 1,
  { error: 'Initial Characters page must be page 1.', path: ['currentPage'] },
)
const initialAnimeStaffPageSchema = animeStaffPageSchema.refine(
  (page) => page.currentPage === 1,
  { error: 'Initial Staff page must be page 1.', path: ['currentPage'] },
)

export interface AnimeDetail {
  anilistId: number
  slug: string
  titles: AnimeTitles
  coverImageUrl: string | null
  bannerImageUrl: string | null
  synopsis: string | null
  format: AnimeFormat | null
  status: AnimeMediaStatus | null
  source: string | null
  season: AnimeSeason | null
  seasonYear: number | null
  episodes: number | null
  durationMinutes: number | null
  startDate: AnimeDate | null
  endDate: AnimeDate | null
  genres: string[]
  mainStudio: AnimeStudio | null
  related: AnimeDetailListItem[]
  recommendations: AnimeDetailListItem[]
  trailer: AnimeTrailer | null
  externalLinks: AnimeExternalLink[]
  charactersPage: AnimePeoplePage<AnimeCharacter>
  staffPage: AnimePeoplePage<AnimeStaff>
}

export const animeDetailSchema: z.ZodType<AnimeDetail> = z.object({
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
  mainStudio: animeStudioSchema.nullable(),
  related: z.array(animeDetailListItemSchema).max(ANIME_RELATED_LIMIT),
  recommendations: z.array(animeDetailListItemSchema).max(ANIME_RECOMMENDATIONS_LIMIT),
  trailer: animeTrailerSchema.nullable(),
  externalLinks: z.array(animeExternalLinkSchema).max(ANIME_EXTERNAL_LINKS_LIMIT),
  charactersPage: initialAnimeCharacterPageSchema,
  staffPage: initialAnimeStaffPageSchema,
}).strict()

export interface AnimeDetailCacheEntry {
  detail: AnimeDetail
  refreshedAt: number
  expiresAt: number
}

const timestampSchema = z.number().finite().nonnegative()
export const animeDetailCacheEntrySchema: z.ZodType<AnimeDetailCacheEntry> = z.object({
  detail: animeDetailSchema,
  refreshedAt: timestampSchema,
  expiresAt: timestampSchema,
}).strict().refine(
  (entry) => entry.expiresAt === entry.refreshedAt + ANIME_DETAIL_CACHE_TTL_MS,
  { error: 'Anime detail cache expiry must equal refresh time plus 24 hours.', path: ['expiresAt'] },
)

export type AnimeDetailErrorCode = 'UPSTREAM' | 'RATE_LIMITED'
export type AnimePaginationErrorCode = 'UPSTREAM' | 'RATE_LIMITED'

export type PublicAnimeDetailState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'ready'; entry: AnimeDetailCacheEntry }
  | { status: 'not-found'; code: 'NOT_FOUND'; message: string }
  | { status: 'error'; code: AnimeDetailErrorCode; message: string; retryAfterSeconds: number | null }
  | { status: 'pagination-error'; code: AnimePaginationErrorCode; message: string; page: number; retryAfterSeconds: number | null }

const messageSchema = z.string().trim().min(1)
export const publicAnimeDetailStateSchema: z.ZodType<PublicAnimeDetailState> = z.discriminatedUnion('status', [
  z.object({ status: z.literal('loading') }).strict(),
  z.object({ status: z.literal('empty') }).strict(),
  z.object({ status: z.literal('ready'), entry: animeDetailCacheEntrySchema }).strict(),
  z.object({ status: z.literal('not-found'), code: z.literal('NOT_FOUND'), message: messageSchema }).strict(),
  z.object({ status: z.literal('error'), code: z.enum(['UPSTREAM', 'RATE_LIMITED']), message: messageSchema, retryAfterSeconds: z.number().int().nonnegative().nullable() }).strict(),
  z.object({ status: z.literal('pagination-error'), code: z.enum(['UPSTREAM', 'RATE_LIMITED']), message: messageSchema, page: positiveSafeIntegerSchema, retryAfterSeconds: z.number().int().nonnegative().nullable() }).strict(),
])

export interface UserAnimeEntry {
  anilistId: number
  status: AnimeStatus | null
  score: AnimeScore
  isFavorite: boolean
  favoriteChangedAt: number | null
  rewatchCount: number
  createdAt: number
  updatedAt: number
}

export const animeMilestoneKindSchema = z.enum(['completed', 'rewatched'])
export type AnimeMilestoneKind = z.infer<typeof animeMilestoneKindSchema>

export interface AnimeMilestone {
  anilistId: number
  kind: AnimeMilestoneKind
  settledAt: number
}

export interface AnimeRewatchEntry {
  id: string
  anilistId: number
  completedAt: number
}

export interface AnimeRewatchPage {
  items: AnimeRewatchEntry[]
  currentPage: number
  hasNextPage: boolean
  perPage: 20
}

export const userAnimeEntrySchema: z.ZodType<UserAnimeEntry> = z.object({
  anilistId: positiveSafeIntegerSchema,
  status: animeStatusSchema.nullable(),
  score: animeScoreSchema,
  isFavorite: z.boolean(),
  favoriteChangedAt: timestampSchema.nullable(),
  rewatchCount: z.number().int().nonnegative(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}).strict()

export const animeMilestoneSchema: z.ZodType<AnimeMilestone> = z.object({
  anilistId: positiveSafeIntegerSchema,
  kind: animeMilestoneKindSchema,
  settledAt: timestampSchema,
}).strict()

export const animeRewatchEntrySchema: z.ZodType<AnimeRewatchEntry> = z.object({
  id: z.string().trim().min(1),
  anilistId: positiveSafeIntegerSchema,
  completedAt: timestampSchema,
}).strict()

export const animeRewatchPageSchema: z.ZodType<AnimeRewatchPage> = z.object({
  items: z.array(animeRewatchEntrySchema).max(ANIME_REWATCHES_PER_PAGE),
  currentPage: positiveSafeIntegerSchema,
  hasNextPage: z.boolean(),
  perPage: z.literal(ANIME_REWATCHES_PER_PAGE),
}).strict()

export interface SetAnimeStatusInput { anilistId: number; status: AnimeStatus }
export interface SetAnimeScoreInput { anilistId: number; score: AnimeScore }
export interface SetAnimeFavoriteInput { anilistId: number; isFavorite: boolean }
export interface RecordAnimeRewatchInput { anilistId: number }
export interface RemoveLatestAnimeRewatchInput { anilistId: number }

export const setAnimeStatusInputSchema: z.ZodType<SetAnimeStatusInput> = z.object({
  anilistId: positiveSafeIntegerSchema,
  status: animeStatusSchema,
}).strict()

export const setAnimeScoreInputSchema: z.ZodType<SetAnimeScoreInput> = z.object({
  anilistId: positiveSafeIntegerSchema,
  score: animeScoreSchema,
}).strict()

export const setAnimeFavoriteInputSchema: z.ZodType<SetAnimeFavoriteInput> = z.object({
  anilistId: positiveSafeIntegerSchema,
  isFavorite: z.boolean(),
}).strict()

export const recordAnimeRewatchInputSchema: z.ZodType<RecordAnimeRewatchInput> = z.object({
  anilistId: positiveSafeIntegerSchema,
}).strict()

export const removeLatestAnimeRewatchInputSchema: z.ZodType<RemoveLatestAnimeRewatchInput> = z.object({
  anilistId: positiveSafeIntegerSchema,
}).strict()

export type UserAnimeMutationResult =
  | { status: 'saved'; entry: UserAnimeEntry }
  | { status: 'removed'; anilistId: number }

export const userAnimeMutationResultSchema: z.ZodType<UserAnimeMutationResult> = z.discriminatedUnion('status', [
  z.object({ status: z.literal('saved'), entry: userAnimeEntrySchema }).strict(),
  z.object({ status: z.literal('removed'), anilistId: positiveSafeIntegerSchema }).strict(),
])
