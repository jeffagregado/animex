import { z } from 'zod'

import {
  animeFormatSchema,
  type AnimeFormat,
} from '../../discover/shared/discover-contracts'
import {
  parseCatalogPublicId,
  type CatalogPublicId,
} from '../../catalog-identity/shared/catalog-identity-contracts'

export const CATALOG_PERSON_PAGE_SIZE = 20 as const
export const CATALOG_PERSON_CACHE_TTL_MS = 24 * 60 * 60 * 1000

export const catalogPersonKindSchema = z.enum(['character', 'staff'])
const catalogPersonTabSchema = z.enum(['overview', 'anime', 'voice-actors'])

export type CatalogPersonKind = z.infer<typeof catalogPersonKindSchema>
export type CatalogPersonTab = z.infer<typeof catalogPersonTabSchema>

const positiveSafeIntegerSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const nullableHttpsUrlSchema = z.url({ protocol: /^https$/ }).nullable()
const nullableTextSchema = z.string().trim().min(1).nullable()

export interface CatalogAnimeSummary {
  publicId: CatalogPublicId
  slug: string
  title: string
  coverImageUrl: string | null
  format: AnimeFormat | null
  seasonYear: number | null
}

export interface CatalogVoiceActor {
  publicId: CatalogPublicId
  name: string
  imageUrl: string | null
  language: string
}

export type CatalogPersonDetail =
  | {
    kind: 'character'
    publicId: CatalogPublicId
    name: string
    nativeName: string | null
    imageUrl: string | null
    description: string | null
    age: string | null
    gender: string | null
    birthday: string | null
    bloodType: string | null
    voiceActorScope: 'all-languages'
    voiceActors: CatalogVoiceActor[]
  }
  | {
    kind: 'staff'
    publicId: CatalogPublicId
    name: string
    nativeName: string | null
    imageUrl: string | null
    description: string | null
    occupations: string[]
    language: string | null
    hometown: string | null
    activeYears: string | null
  }

export interface CatalogPersonWork {
  anime: CatalogAnimeSummary
  role: string | null
}

export interface CatalogPersonWorkPage {
  items: CatalogPersonWork[]
  currentPage: number
  hasNextPage: boolean
  perPage: 20
}

export interface CatalogPersonSearchRow {
  kind: CatalogPersonKind
  publicId: CatalogPublicId
  name: string
  nativeName: string | null
  imageUrl: string | null
  destination: string
}

export interface CatalogPersonSearchPage {
  items: CatalogPersonSearchRow[]
  currentPage: number
  hasNextPage: boolean
  perPage: 20
}

const catalogAnimeSummarySchema: z.ZodType<CatalogAnimeSummary> = z.object({
  publicId: z.string().transform(parseCatalogPublicId),
  slug: z.string().trim().min(1),
  title: z.string().trim().min(1),
  coverImageUrl: nullableHttpsUrlSchema,
  format: animeFormatSchema.nullable(),
  seasonYear: z.number().int().positive().nullable(),
}).strict()

const catalogVoiceActorSchema: z.ZodType<CatalogVoiceActor> = z.object({
  publicId: z.string().transform(parseCatalogPublicId),
  name: z.string().trim().min(1),
  imageUrl: nullableHttpsUrlSchema,
  language: z.string().trim().min(1),
}).strict()

const characterDetailSchema = z.object({
  kind: z.literal('character'),
  publicId: z.string().transform(parseCatalogPublicId),
  name: z.string().trim().min(1),
  nativeName: nullableTextSchema,
  imageUrl: nullableHttpsUrlSchema,
  description: nullableTextSchema,
  age: nullableTextSchema,
  gender: nullableTextSchema,
  birthday: nullableTextSchema,
  bloodType: nullableTextSchema,
  voiceActorScope: z.literal('all-languages'),
  voiceActors: z.array(catalogVoiceActorSchema)
    .refine(
      (actors) => new Set(actors.map((actor) => actor.publicId)).size === actors.length,
      { error: 'Character voice actors must have unique IDs.' },
    ),
}).strict()

const staffDetailSchema = z.object({
  kind: z.literal('staff'),
  publicId: z.string().transform(parseCatalogPublicId),
  name: z.string().trim().min(1),
  nativeName: nullableTextSchema,
  imageUrl: nullableHttpsUrlSchema,
  description: nullableTextSchema,
  occupations: z.array(z.string().trim().min(1)),
  language: nullableTextSchema,
  hometown: nullableTextSchema,
  activeYears: nullableTextSchema,
}).strict()

export const catalogPersonDetailSchema: z.ZodType<CatalogPersonDetail> = z.discriminatedUnion(
  'kind',
  [characterDetailSchema, staffDetailSchema],
)

const catalogPersonWorkSchema: z.ZodType<CatalogPersonWork> = z.object({
  anime: catalogAnimeSummarySchema,
  role: nullableTextSchema,
}).strict()

export const catalogPersonWorkPageSchema: z.ZodType<CatalogPersonWorkPage> = z.object({
  items: z.array(catalogPersonWorkSchema).max(CATALOG_PERSON_PAGE_SIZE),
  currentPage: positiveSafeIntegerSchema,
  hasNextPage: z.boolean(),
  perPage: z.literal(CATALOG_PERSON_PAGE_SIZE),
}).strict()

const catalogPersonSearchRowSchema: z.ZodType<CatalogPersonSearchRow> = z.object({
  kind: catalogPersonKindSchema,
  publicId: z.string().transform(parseCatalogPublicId),
  name: z.string().trim().min(1),
  nativeName: nullableTextSchema,
  imageUrl: nullableHttpsUrlSchema,
  destination: z.string().startsWith('/'),
}).strict()

export const catalogPersonSearchPageSchema: z.ZodType<CatalogPersonSearchPage> = z.object({
  items: z.array(catalogPersonSearchRowSchema).max(CATALOG_PERSON_PAGE_SIZE),
  currentPage: positiveSafeIntegerSchema,
  hasNextPage: z.boolean(),
  perPage: z.literal(CATALOG_PERSON_PAGE_SIZE),
}).strict()

/** Creates a canonical display-only slug. */
export const slugifyCatalogPerson = (name: string): string => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[\u0027\u2019]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')

  if (slug.length === 0) {
    throw new TypeError('CATALOG_PERSON_SLUG_INVALID')
  }

  return slug
}

/** Creates a canonical Character or Staff path. */
export const createCatalogPersonPath = (
  kind: CatalogPersonKind,
  publicId: CatalogPublicId,
  name: string,
): string => {
  const parsedId = parseCatalogPublicId(publicId)
  const segment = kind === 'character' ? 'characters' : 'staff'
  return `/${segment}/${parsedId}/${encodeURIComponent(slugifyCatalogPerson(name))}`
}

/** Parses the shared canonical Character and Staff tabs. */
export const parseCatalogPersonTab = (
  kind: CatalogPersonKind,
  value: unknown,
): CatalogPersonTab => {
  if (value === undefined || value === 'overview') return 'overview'
  if ((kind === 'character' || kind === 'staff') && value === 'anime') return 'anime'
  if (kind === 'character' && value === 'voice-actors') return 'voice-actors'

  throw new TypeError('CATALOG_PERSON_TAB_INVALID')
}
