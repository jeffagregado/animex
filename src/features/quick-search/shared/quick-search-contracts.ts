import { z } from 'zod'

import {
  createCatalogPersonPath,
  parseCatalogPersonId,
} from '../../catalog-person/shared/catalog-person-contracts'

export const QUICK_SEARCH_MIN_LENGTH = 2 as const
export const QUICK_SEARCH_MAX_LENGTH = 100 as const
export const QUICK_SEARCH_DEBOUNCE_MS = 300 as const
export const QUICK_SEARCH_GROUP_LIMIT = 5 as const
export const SEARCH_RESULTS_PAGE_SIZE = 20 as const

export type QuickSearchGroup = 'anime' | 'characters' | 'staff' | 'users'

export type QuickSearchDestinationInput =
  | { kind: 'anime'; id: number; slug: string }
  | { kind: 'character'; id: number; label: string }
  | { kind: 'staff'; id: number; label: string }
  | { kind: 'user'; username: string }
  | { kind: 'results'; group: QuickSearchGroup; query: string }

export interface QuickSearchRow {
  id: string
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

const positiveSafeIntegerSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const querySchema = z.string()
  .transform((value) => value.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(QUICK_SEARCH_MIN_LENGTH).max(QUICK_SEARCH_MAX_LENGTH))
const pathSegmentSchema = z.string().trim().min(1)
const destinationInputSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('anime'),
    id: positiveSafeIntegerSchema,
    slug: pathSegmentSchema,
  }).strict(),
  z.object({
    kind: z.literal('character'),
    id: positiveSafeIntegerSchema,
    label: z.string().trim().min(1),
  }).strict(),
  z.object({
    kind: z.literal('staff'),
    id: positiveSafeIntegerSchema,
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
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  imageUrl: z.url({ protocol: /^https$/ }).nullable(),
  metadata: z.string().trim().min(1).nullable(),
  destination: z.string().startsWith('/'),
}).strict()

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
    const id = parseCatalogPersonId(input.id)
    return `/anime/${id}/${encodeURIComponent(input.slug)}`
  }
  if (input.kind === 'character' || input.kind === 'staff') {
    return createCatalogPersonPath(input.kind, input.id, input.label)
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
