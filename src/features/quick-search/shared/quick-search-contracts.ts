import { z } from 'zod'

import {
  parseCatalogPublicId,
  type CatalogPublicId,
} from '../../catalog-identity/shared/catalog-identity-contracts'
import {
  slugifyCatalogPerson,
} from '../../catalog-person/shared/catalog-person-contracts'

export const QUICK_SEARCH_MIN_LENGTH = 2 as const
export const QUICK_SEARCH_MAX_LENGTH = 100 as const
export const QUICK_SEARCH_DEBOUNCE_MS = 300 as const
export const QUICK_SEARCH_GROUP_LIMIT = 5 as const
export const SEARCH_RESULTS_PAGE_SIZE = 20 as const

export type QuickSearchGroup = 'anime' | 'characters' | 'staff' | 'users'

export type QuickSearchDestinationInput =
  | { kind: 'anime'; publicId: CatalogPublicId; slug: string }
  | { kind: 'character'; publicId: CatalogPublicId; label: string }
  | { kind: 'staff'; publicId: CatalogPublicId; label: string }
  | { kind: 'user'; username: string }
  | { kind: 'results'; group: QuickSearchGroup; query: string }

export interface QuickSearchRow {
  id: string
  publicId: CatalogPublicId
  label: string
  imageUrl: string | null
  metadata: string | null
  destination: string
}

export interface QuickSearchGroups {
  anime: QuickSearchRow[]
  characters: QuickSearchRow[]
  staff: QuickSearchRow[]
  users: QuickSearchRow[]
}

const querySchema = z.string()
  .transform((value) => value.trim())
  .pipe(z.string().min(QUICK_SEARCH_MIN_LENGTH).max(QUICK_SEARCH_MAX_LENGTH))
const pathSegmentSchema = z.string().trim().min(1)
const catalogPublicIdSchema = z.string().transform((value, context) => {
  try {
    return parseCatalogPublicId(value)
  } catch {
    context.addIssue({ code: 'custom', message: 'CATALOG_PUBLIC_ID_INVALID' })
    return z.NEVER
  }
})
const destinationInputSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('anime'),
    publicId: catalogPublicIdSchema,
    slug: pathSegmentSchema,
  }).strict(),
  z.object({
    kind: z.literal('character'),
    publicId: catalogPublicIdSchema,
    label: z.string().trim().min(1),
  }).strict(),
  z.object({
    kind: z.literal('staff'),
    publicId: catalogPublicIdSchema,
    label: z.string().trim().min(1),
  }).strict(),
  z.object({
    kind: z.literal('user'),
    username: pathSegmentSchema,
  }).strict(),
  z.object({
    kind: z.literal('results'),
    group: z.enum(['anime', 'characters', 'staff', 'users']),
    query: querySchema,
  }).strict(),
])

const quickSearchRowSchema: z.ZodType<QuickSearchRow> = z.object({
  id: catalogPublicIdSchema,
  publicId: catalogPublicIdSchema,
  label: z.string().trim().min(1),
  imageUrl: z.url({ protocol: /^https$/ }).nullable(),
  metadata: z.string().trim().min(1).nullable(),
  destination: z.string().startsWith('/'),
}).strict().refine((row) => row.id === row.publicId, {
  message: 'Quick Search row ID must equal its public ID.',
})

const quickSearchRowsSchema = z.array(quickSearchRowSchema).max(QUICK_SEARCH_GROUP_LIMIT)

export const quickSearchGroupsSchema: z.ZodType<QuickSearchGroups> = z.object({
  anime: quickSearchRowsSchema,
  characters: quickSearchRowsSchema,
  staff: quickSearchRowsSchema,
  users: quickSearchRowsSchema,
}).strict()

/** Normalizes one valid Quick Search query. */
export const normalizeSearchQuery = (value: unknown): string => {
  const result = querySchema.safeParse(value)
  if (!result.success) {
    throw new TypeError('QUICK_SEARCH_INVALID', { cause: result.error })
  }

  return result.data
}

/** Creates one destination without provider-specific fields. */
export const createQuickSearchDestination = (
  value: QuickSearchDestinationInput,
): string => {
  const result = destinationInputSchema.safeParse(value)
  if (!result.success) {
    throw new TypeError('QUICK_SEARCH_DESTINATION_INVALID', { cause: result.error })
  }

  const input = result.data
  if (input.kind === 'anime') {
    return `/anime/${input.publicId}/${encodeURIComponent(input.slug)}`
  }
  if (input.kind === 'character' || input.kind === 'staff') {
    const segment = input.kind === 'character' ? 'characters' : 'staff'
    return `/${segment}/${input.publicId}/${encodeURIComponent(slugifyCatalogPerson(input.label))}`
  }
  if (input.kind === 'user') {
    return `/users/${encodeURIComponent(input.username)}`
  }

  const paths: Record<QuickSearchGroup, string> = {
    anime: '/discover',
    characters: '/search/characters',
    staff: '/search/staff',
    users: '/search/users',
  }
  return `${paths[input.group]}?q=${encodeURIComponent(input.query)}`
}
