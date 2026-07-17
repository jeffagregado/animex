import { useEffect, useState, type KeyboardEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useConvex } from 'convex/react'
import { makeFunctionReference } from 'convex/server'
import { z } from 'zod'

import {
  createQuickSearchDestination,
  QUICK_SEARCH_DEBOUNCE_MS,
  QUICK_SEARCH_MAX_LENGTH,
  QUICK_SEARCH_MIN_LENGTH,
  quickSearchGroupsSchema,
  type QuickSearchGroups,
  type QuickSearchRow,
} from '../shared/quick-search-contracts'
import { searchQuickCatalog } from '../server/quick-search.functions'

interface UserPreview {
  avatarUrl: string | null
  id: string
  name: string
  username: string
}

interface SearchData<T> {
  query: string
  value: T
}

export interface QuickSearchItem extends QuickSearchRow {
  group: keyof QuickSearchGroups
  optionId: string
}

export interface QuickSearchModel {
  activeIndex: number
  groups: QuickSearchGroups
  inputProps: {
    'aria-activedescendant': string | undefined
    'aria-controls': string
    'aria-label': string
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
    placeholder: string
    role: 'searchbox'
    value: string
  }
  items: QuickSearchItem[]
  normalizedQuery: string
  providerError: Error | null
  providerLoading: boolean
  queryReady: boolean
  retryProvider: () => void
  retryUsers: () => void
  select: (destination: string) => void
  status: string
  userError: Error | null
  userLoading: boolean
  usersEligible: boolean
}

interface UseQuickSearchInput {
  authScope: string | null
  onSelect: (destination: string) => void
  open: boolean
  resetVersion: number
  usersEnabled: boolean
}

const userSearchPreviewRef = makeFunctionReference<
  'query',
  { query: string },
  UserPreview[]
>('userSearch:searchPreview')

const userPreviewsSchema: z.ZodType<UserPreview[]> = z.array(z.object({
  avatarUrl: z.string().url().nullable(),
  id: z.string().min(1),
  name: z.string().trim().min(1),
  username: z.string().trim().min(1),
}).strict()).max(5)

const emptyGroups = (): QuickSearchGroups => ({
  anime: [],
  characters: [],
  staff: [],
  users: [],
})

/** Coordinates debounced provider and authenticated User preview searches. */
export function useQuickSearch(input: UseQuickSearchInput): QuickSearchModel {
  const convex = useConvex()
  const [rawQuery, setRawQuery] = useState('')
  const [requestQuery, setRequestQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const normalizedQuery = rawQuery.trim()
  const valid = normalizedQuery.length >= QUICK_SEARCH_MIN_LENGTH
    && normalizedQuery.length <= QUICK_SEARCH_MAX_LENGTH

  useEffect(() => {
    if (!input.open) return
    setActiveIndex(-1)
    setRequestQuery('')
    if (!valid) return
    const timer = window.setTimeout(() => {
      setRequestQuery(normalizedQuery)
    }, QUICK_SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [input.open, normalizedQuery, valid])

  useEffect(() => {
    setRawQuery('')
    setRequestQuery('')
    setActiveIndex(-1)
  }, [input.resetVersion])

  const provider = useQuery({
    queryKey: ['quick-search', 'provider', requestQuery],
    queryFn: async (): Promise<SearchData<Omit<QuickSearchGroups, 'users'>>> => {
      const result = await searchQuickCatalog({ data: { query: requestQuery } })
      const parsed = quickSearchGroupsSchema.parse({ ...result, users: [] })
      return {
        query: requestQuery,
        value: {
          anime: parsed.anime,
          characters: parsed.characters,
          staff: parsed.staff,
        },
      }
    },
    enabled: input.open && requestQuery.length > 0,
    staleTime: 60_000,
    retry: false,
  })
  const users = useQuery({
    queryKey: ['quick-search', 'users', input.authScope, requestQuery],
    queryFn: async (): Promise<SearchData<QuickSearchRow[]>> => {
      const rows = userPreviewsSchema.parse(
        await convex.query(userSearchPreviewRef, { query: requestQuery }),
      )
      return {
        query: requestQuery,
        value: rows.map((user) => ({
          id: user.id,
          label: user.name,
          imageUrl: user.avatarUrl,
          metadata: `@${user.username}`,
          destination: createQuickSearchDestination({
            kind: 'user',
            username: user.username,
          }),
        })),
      }
    },
    enabled: input.open && requestQuery.length > 0 && input.usersEnabled,
    retry: false,
  })
  const providerValue = provider.data?.query === normalizedQuery
    ? provider.data.value
    : null
  const userValue = input.usersEnabled
    && users.data?.query === normalizedQuery
    ? users.data.value
    : null
  const groups: QuickSearchGroups = providerValue === null
    ? { ...emptyGroups(), users: userValue ?? [] }
    : { ...providerValue, users: userValue ?? [] }
  const items = (Object.entries(groups) as [keyof QuickSearchGroups, QuickSearchRow[]][])
    .flatMap(([group, rows]) => rows.map((row) => ({
      ...row,
      group,
      optionId: `quick-search-${group}-${row.id}`,
    })))

  useEffect(() => {
    setActiveIndex(-1)
  }, [items.map((item) => item.optionId).join('|')])

  const queryReady = valid && requestQuery === normalizedQuery
  const allSuccess = queryReady
    && provider.isSuccess
    && (!input.usersEnabled || users.isSuccess)
  const status = normalizedQuery.length > QUICK_SEARCH_MAX_LENGTH
    ? `Search query must be at most ${QUICK_SEARCH_MAX_LENGTH} characters.`
    : normalizedQuery.length < QUICK_SEARCH_MIN_LENGTH
      ? `Type at least ${QUICK_SEARCH_MIN_LENGTH} characters to search.`
      : !queryReady || provider.isPending || (input.usersEnabled && users.isPending)
        ? 'Searching…'
        : allSuccess && items.length === 0
          ? `No results found for ${normalizedQuery}.`
          : `${items.length} results available.`
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (items.length === 0) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => {
        if (event.key === 'ArrowDown') return current < items.length - 1 ? current + 1 : 0
        return current > 0 ? current - 1 : items.length - 1
      })
    }
    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      const active = items[activeIndex]
      if (active) input.onSelect(active.destination)
    }
  }

  return {
    activeIndex,
    groups,
    inputProps: {
      'aria-activedescendant': activeIndex >= 0 ? items[activeIndex]?.optionId : undefined,
      'aria-controls': 'quick-search-results',
      'aria-label': 'Search AnimeX',
      onChange: (event) => setRawQuery(event.currentTarget.value),
      onKeyDown,
      placeholder: 'Search anime, characters, staff, and users',
      role: 'searchbox',
      value: rawQuery,
    },
    items,
    normalizedQuery,
    providerError: provider.error instanceof Error && queryReady ? provider.error : null,
    providerLoading: queryReady && provider.isPending,
    queryReady,
    retryProvider: () => { void provider.refetch() },
    retryUsers: () => { void users.refetch() },
    select: input.onSelect,
    status,
    userError: users.error instanceof Error && queryReady ? users.error : null,
    userLoading: queryReady && input.usersEnabled && users.isPending,
    usersEligible: input.usersEnabled,
  }
}
