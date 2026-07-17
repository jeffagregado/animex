import { z } from 'zod'

import { animeFormatSchema, animeSeasonSchema } from '../../discover/shared/discover-contracts'

const httpsUrl = z.url({ protocol: /^https$/ })
const nameSchema = z.object({ full: z.string(), native: z.string().nullable() }).strict()
const imageSchema = z.object({ large: httpsUrl.nullable() }).strict().nullable()
const dateSchema = z.object({
  year: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
  month: z.number().int().min(1).max(12).nullable(),
  day: z.number().int().min(1).max(31).nullable(),
}).strict().nullable()

export const characterDetailResponseSchema = z.object({
  data: z.object({
    Character: z.object({
      id: z.number().int().positive(),
      name: nameSchema,
      image: imageSchema,
      description: z.string().nullable(),
      age: z.string().nullable(),
      gender: z.string().nullable(),
      dateOfBirth: dateSchema,
      bloodType: z.string().nullable(),
    }).strict().nullable(),
  }).strict(),
}).strict()

export const staffDetailResponseSchema = z.object({
  data: z.object({
    Staff: z.object({
      id: z.number().int().positive(),
      name: nameSchema,
      image: imageSchema,
      description: z.string().nullable(),
      primaryOccupations: z.array(z.string()),
      languageV2: z.string().nullable(),
      homeTown: z.string().nullable(),
      yearsActive: z.array(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)).max(2).nullable(),
    }).strict().nullable(),
  }).strict(),
}).strict()

const mediaDateSchema = z.object({
  year: z.number().int().nullable(),
  month: z.number().int().min(1).max(12).nullable(),
  day: z.number().int().min(1).max(31).nullable(),
}).strict().nullable()

const mediaSchema = z.object({
  id: z.number().int().positive(),
  type: z.literal('ANIME'),
  isAdult: z.boolean(),
  title: z.object({
    english: z.string().nullable(),
    romaji: z.string().nullable(),
    native: z.string().nullable(),
  }).strict(),
  coverImage: z.object({ large: httpsUrl.nullable() }).strict().nullable(),
  bannerImage: httpsUrl.nullable(),
  format: animeFormatSchema.nullable(),
  season: animeSeasonSchema.nullable(),
  seasonYear: z.number().int().nullable(),
  episodes: z.number().int().nonnegative().nullable(),
  genres: z.array(z.string()),
  popularity: z.number().int().nonnegative(),
  averageScore: z.number().int().min(0).max(100).nullable(),
  trending: z.number().int().nonnegative().nullable(),
  startDate: mediaDateSchema,
  nextAiringEpisode: z.object({ airingAt: z.number().int().nonnegative() }).strict().nullable(),
}).strict()

const pageInfoSchema = z.object({
  currentPage: z.number().int().positive(),
  hasNextPage: z.boolean(),
}).strict()

export const characterWorksResponseSchema = z.object({
  data: z.object({
    Character: z.object({
      id: z.number().int().positive(),
      media: z.object({
        pageInfo: pageInfoSchema,
        edges: z.array(z.object({ characterRole: z.string().nullable(), node: mediaSchema }).strict()),
      }).strict(),
    }).strict().nullable(),
  }).strict(),
}).strict()

export const staffWorksResponseSchema = z.object({
  data: z.object({
    Staff: z.object({
      id: z.number().int().positive(),
      staffMedia: z.object({
        pageInfo: pageInfoSchema,
        edges: z.array(z.object({ staffRole: z.string().nullable(), node: mediaSchema }).strict()),
      }).strict(),
    }).strict().nullable(),
  }).strict(),
}).strict()

const searchPersonSchema = z.object({
  id: z.number().int().positive(),
  name: nameSchema,
  image: imageSchema,
}).strict()

export const characterSearchResponseSchema = z.object({
  data: z.object({
    Page: z.object({
      pageInfo: pageInfoSchema,
      characters: z.array(searchPersonSchema),
    }).strict(),
  }).strict(),
}).strict()

export const staffSearchResponseSchema = z.object({
  data: z.object({
    Page: z.object({
      pageInfo: pageInfoSchema,
      staff: z.array(searchPersonSchema),
    }).strict(),
  }).strict(),
}).strict()
