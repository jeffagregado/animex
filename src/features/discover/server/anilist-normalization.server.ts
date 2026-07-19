import { z } from 'zod'

import { AniListRequestError } from '../../../lib/anilist-client.server'
import {
  type AnimeSearchPageProvider,
  type AnimeSummaryProvider,
} from './discover-provider-cache-contracts.server'

const animeProviderFormatSchema = z.enum([
  'TV',
  'TV_SHORT',
  'MOVIE',
  'SPECIAL',
  'OVA',
  'ONA',
  'MUSIC',
])
const animeProviderSeasonSchema = z.enum(['WINTER', 'SPRING', 'SUMMER', 'FALL'])
const animeProviderDateSchema = z.object({
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
  format: animeProviderFormatSchema.nullable(),
  season: animeProviderSeasonSchema.nullable(),
  seasonYear: z.number().int().nullable(),
  episodes: z.number().int().nonnegative().nullable(),
  genres: z.array(z.string()),
  popularity: z.number().int().nonnegative(),
  averageScore: z.number().int().min(0).max(100).nullable(),
  trending: z.number().int().nonnegative().nullable(),
  startDate: animeProviderDateSchema.nullable(),
  nextAiringEpisode: z.object({ airingAt: z.number().int().nonnegative() }).nullable(),
})

const mediaListSchema = z.object({
  data: z.object({ Page: z.object({ media: z.array(z.unknown()) }) }),
})

const recommendationListSchema = z.object({
  data: z.object({
    Page: z.object({
      recommendations: z.array(z.object({ mediaRecommendation: z.unknown() })),
    }),
  }),
})

const searchResponseSchema = z.object({
  data: z.object({
    Page: z.object({
      pageInfo: z.object({
        currentPage: z.number().int().positive(),
        hasNextPage: z.boolean(),
      }),
      media: z.array(z.unknown()),
    }),
  }),
})

const trimTitle = (value: string | null): string | null => {
  if (value === null) return null

  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : null
}

/** Creates a URL-safe provider/cache slug. */
const slugifyProviderAnimeTitle = (title: string): string => {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[\u0027\u2019]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')

  if (slug.length === 0) throw new TypeError('Anime title cannot produce a slug.')
  return slug
}

class AnimeMediaValidationError extends TypeError {
  readonly cause: z.ZodError

  constructor(message: string, cause: z.ZodError) {
    super(message)
    this.name = 'AnimeMediaValidationError'
    this.cause = cause
  }
}

/** Converts provider validation failures into actionable errors without payloads. */
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

const upstreamError = (): AniListRequestError => new AniListRequestError(
  'UPSTREAM',
  'AniList is temporarily unavailable.',
  null,
)

/** Converts one provider media object into the public anime summary contract. */
export const normalizeAnimeSummary = (value: unknown): AnimeSummaryProvider => {
  const parsedMedia = anilistLightweightMediaSchema.safeParse(value)
  if (!parsedMedia.success) throw createMediaValidationError(parsedMedia.error)
  if (parsedMedia.data.isAdult) throw new TypeError('Adult media is not supported.')

  const english = trimTitle(parsedMedia.data.title.english)
  const romaji = trimTitle(parsedMedia.data.title.romaji)
  const native = trimTitle(parsedMedia.data.title.native)
  const display = english ?? romaji ?? native
  if (display === null) throw new TypeError('AniList media requires a title.')

  const genres = [...new Set(parsedMedia.data.genres.map((genre) => genre.trim()).filter(Boolean))]

  return {
    anilistId: parsedMedia.data.id,
    slug: slugifyProviderAnimeTitle(display),
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

/** Normalizes one provider media object or raises a sanitized upstream error. */
const normalizeSingleMedia = (value: unknown): AnimeSummaryProvider => {
  try {
    return normalizeAnimeSummary(value)
  } catch {
    throw upstreamError()
  }
}

const normalizeMedia = (values: unknown[]): AnimeSummaryProvider[] => values.map(normalizeSingleMedia)

/** Validates and normalizes a non-recommendation provider response. */
export const normalizeAniListSectionResponse = (body: unknown): AnimeSummaryProvider[] => {
  const parsed = mediaListSchema.safeParse(body)
  if (!parsed.success) throw upstreamError()
  return normalizeMedia(parsed.data.data.Page.media)
}

/** Normalizes, deduplicates, and bounds provider recommendation media. */
export const normalizeAniListRecommendationResponse = (
  body: unknown,
  itemLimit: number,
): AnimeSummaryProvider[] => {
  const parsed = recommendationListSchema.safeParse(body)
  if (!parsed.success) throw upstreamError()

  const unique = new Map<number, AnimeSummaryProvider>()
  for (const recommendation of parsed.data.data.Page.recommendations) {
    const value = recommendation.mediaRecommendation
    if (typeof value !== 'object' || value === null) throw upstreamError()

    const media = value as { type?: unknown; isAdult?: unknown }
    if (media.type !== 'ANIME' || media.isAdult !== false) continue

    const summary = normalizeSingleMedia(value)
    if (!unique.has(summary.anilistId)) unique.set(summary.anilistId, summary)
  }

  const summaries = [...unique.values()].slice(0, itemLimit)
  if (summaries.length === 0) throw upstreamError()
  return summaries
}

/** Validates and normalizes provider search pagination. */
export const normalizeAniListSearchResponse = (body: unknown): AnimeSearchPageProvider => {
  const parsed = searchResponseSchema.safeParse(body)
  if (!parsed.success) throw upstreamError()

  return {
    items: normalizeMedia(parsed.data.data.Page.media),
    currentPage: parsed.data.data.Page.pageInfo.currentPage,
    hasNextPage: parsed.data.data.Page.pageInfo.hasNextPage,
    perPage: 20,
  }
}
