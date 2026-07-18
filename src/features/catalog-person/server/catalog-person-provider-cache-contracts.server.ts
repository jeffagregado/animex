import { z } from 'zod'

export const CATALOG_PERSON_PROVIDER_PAGE_SIZE = 20 as const

export const catalogPersonProviderKindSchema = z.enum(['character', 'staff'])

const animeFormatSchema = z.enum([
  'TV',
  'TV_SHORT',
  'MOVIE',
  'SPECIAL',
  'OVA',
  'ONA',
  'MUSIC',
])
const positiveSafeIntegerSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const nullableHttpsUrlSchema = z.url({ protocol: /^https$/ }).nullable()
const nullableTextSchema = z.string().trim().min(1).nullable()
const catalogAnimeSummarySchema = z.object({
  id: positiveSafeIntegerSchema,
  slug: z.string().trim().min(1),
  title: z.string().trim().min(1),
  coverImageUrl: nullableHttpsUrlSchema,
  format: animeFormatSchema.nullable(),
  seasonYear: z.number().int().positive().nullable(),
}).strict()
const catalogVoiceActorSchema = z.object({
  id: positiveSafeIntegerSchema,
  name: z.string().trim().min(1),
  imageUrl: nullableHttpsUrlSchema,
  language: z.string().trim().min(1),
}).strict()
const characterDetailSchema = z.object({
  kind: z.literal('character'),
  id: positiveSafeIntegerSchema,
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
      (actors) => new Set(actors.map((actor) => actor.id)).size === actors.length,
      { error: 'Character voice actors must have unique IDs.' },
    ),
}).strict()
const staffDetailSchema = z.object({
  kind: z.literal('staff'),
  id: positiveSafeIntegerSchema,
  name: z.string().trim().min(1),
  nativeName: nullableTextSchema,
  imageUrl: nullableHttpsUrlSchema,
  description: nullableTextSchema,
  occupations: z.array(z.string().trim().min(1)),
  language: nullableTextSchema,
  hometown: nullableTextSchema,
  activeYears: nullableTextSchema,
}).strict()
const catalogPersonWorkSchema = z.object({
  anime: catalogAnimeSummarySchema,
  role: nullableTextSchema,
}).strict()

export const catalogPersonProviderDetailSchema = z.discriminatedUnion(
  'kind',
  [characterDetailSchema, staffDetailSchema],
)

export const catalogPersonProviderWorkPageSchema = z.object({
  items: z.array(catalogPersonWorkSchema).max(CATALOG_PERSON_PROVIDER_PAGE_SIZE),
  currentPage: positiveSafeIntegerSchema,
  hasNextPage: z.boolean(),
  perPage: z.literal(CATALOG_PERSON_PROVIDER_PAGE_SIZE),
}).strict()

export type CatalogPersonProviderKind = z.infer<typeof catalogPersonProviderKindSchema>
export type CatalogPersonProviderDetail = z.infer<typeof catalogPersonProviderDetailSchema>
export type CatalogPersonProviderWorkPage = z.infer<typeof catalogPersonProviderWorkPageSchema>
export type CatalogPersonProviderAnimeSummary = z.infer<typeof catalogAnimeSummarySchema>
export type CatalogPersonProviderVoiceActor = z.infer<typeof catalogVoiceActorSchema>

/** Parses strict numeric AniList person identity at the provider boundary. */
export const parseProviderCatalogPersonId = (value: unknown): number => {
  const result = positiveSafeIntegerSchema.safeParse(value)
  if (!result.success) {
    throw new RangeError('AniList person ID must be a positive safe integer.')
  }
  return result.data
}
