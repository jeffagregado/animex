import { z } from 'zod'

import type { CatalogProviderRef } from '../../catalog-identity/server/catalog-identity.server'
import {
  animeDateSchema,
  animeTitlesSchema,
  type AnimeDate,
  type AnimeTitles,
} from '../shared/anime-metadata-contracts'

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
const positiveSafeIntegerSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)

export const DISCOVER_PROVIDER_SECTION_KEYS = [
  'trending',
  'seasonal',
  'recommendations',
  'upcoming',
] as const
const discoverProviderSectionKeySchema = z.enum(DISCOVER_PROVIDER_SECTION_KEYS)

export type AnimeProviderFormat = z.infer<typeof animeProviderFormatSchema>
export type AnimeProviderSeason = z.infer<typeof animeProviderSeasonSchema>
export type DiscoverSectionKeyProvider = z.infer<typeof discoverProviderSectionKeySchema>

export type AnimeProviderDate = AnimeDate
export type AnimeProviderTitles = AnimeTitles

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

export interface AnimeSearchPageProvider {
  items: AnimeSummaryProvider[]
  currentPage: number
  hasNextPage: boolean
  perPage: 20
}

export interface DiscoverSectionProvider {
  key: DiscoverSectionKeyProvider
  items: AnimeSummaryProvider[]
  refreshedAt: number
  expiresAt: number
}

export type DiscoverSectionStateProvider =
  | { status: 'ready'; section: DiscoverSectionProvider }
  | {
    status: 'error'
    key: DiscoverSectionKeyProvider
    code: 'UPSTREAM' | 'RATE_LIMITED' | 'CACHE_REFRESH'
    retryAfterSeconds: number | null
  }

export interface DiscoverPageDataProvider {
  sections: Record<DiscoverSectionKeyProvider, DiscoverSectionStateProvider>
}

export type DiscoverCacheReadProvider =
  | {
    key: DiscoverSectionKeyProvider
    status: 'fresh'
    section: DiscoverSectionProvider
  }
  | {
    key: DiscoverSectionKeyProvider
    status: 'missing' | 'expired'
    section: null
  }

export interface DiscoverSectionConfigProvider {
  ttlMs: number
  itemLimit: number
}

export const DISCOVER_PROVIDER_SECTION_CONFIG: Record<
  DiscoverSectionKeyProvider,
  DiscoverSectionConfigProvider
> = {
  trending: { ttlMs: 3 * 60 * 60 * 1000, itemLimit: 12 },
  seasonal: { ttlMs: 24 * 60 * 60 * 1000, itemLimit: 12 },
  recommendations: { ttlMs: 24 * 60 * 60 * 1000, itemLimit: 16 },
  upcoming: { ttlMs: 6 * 60 * 60 * 1000, itemLimit: 10 },
}

export const animeSummaryProviderSchema: z.ZodType<AnimeSummaryProvider> = z.object({
  anilistId: positiveSafeIntegerSchema,
  slug: z.string().trim().min(1),
  titles: animeTitlesSchema,
  coverImageUrl: z.url().nullable(),
  bannerImageUrl: z.url().nullable(),
  format: animeProviderFormatSchema.nullable(),
  season: animeProviderSeasonSchema.nullable(),
  seasonYear: z.number().int().nullable(),
  episodes: z.number().int().nonnegative().nullable(),
  genres: z.array(z.string().trim().min(1)),
  popularity: z.number().int().nonnegative(),
  averageScore: z.number().int().min(0).max(100).nullable(),
  trending: z.number().int().nonnegative().nullable(),
  startDate: animeDateSchema.nullable(),
  nextAiringAt: z.number().int().nonnegative().nullable(),
}).strict()

/** Builds one unique bounded anime provider-reference batch. */
export const createAnimeProviderRefs = (
  summaries: readonly AnimeSummaryProvider[],
): CatalogProviderRef[] => {
  const ids = new Set<number>()
  const refs: CatalogProviderRef[] = []
  for (const summary of summaries) {
    if (ids.has(summary.anilistId)) continue
    ids.add(summary.anilistId)
    refs.push({ provider: 'anilist', kind: 'anime', providerId: summary.anilistId })
  }
  return refs
}
