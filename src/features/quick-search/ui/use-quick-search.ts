import {
  useEffect,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import { useQuery } from '@tanstack/react-query'

import { searchUsersPreview } from '../../profile/server/user-search.functions'
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

interface SearchQueryState {
  normalizedQuery: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  rawQuery: string
  requestQuery: string
  valid: boolean
}

interface SearchResultState {
  groups: QuickSearchGroups
  items: QuickSearchItem[]
  queryReady: boolean
}

const emptyGroups = (): QuickSearchGroups => ({
  anime: [],
  characters: [],
  staff: [],
  users: [],
})

/** Debounces normalized input and resets it only after close completion. */
function useSearchQuery(
  open: boolean,
  resetVersion: number,
): SearchQueryState {
  const [rawQuery, setRawQuery] = useState('')
  const [requestQuery, setRequestQuery] = useState('')
  const normalizedQuery = rawQuery.trim()
  const valid = normalizedQuery.length >= QUICK_SEARCH_MIN_LENGTH
    && normalizedQuery.length <= QUICK_SEARCH_MAX_LENGTH

  useEffect(() => {
    if (!open) return
    setRequestQuery('')
    if (!valid) return
    const timer = window.setTimeout(() => {
      setRequestQuery(normalizedQuery)
    }, QUICK_SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [open, normalizedQuery, valid])

  useEffect(() => {
    setRawQuery('')
    setRequestQuery('')
  }, [resetVersion])

  return {
    normalizedQuery,
    onChange: (event) => setRawQuery(event.currentTarget.value),
    rawQuery,
    requestQuery,
    valid,
  }
}

/** Fetches catalog groups for the current debounced query. */
function useProviderSearch(open: boolean, requestQuery: string) {
  return useQuery({
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
    enabled: open && requestQuery.length > 0,
    staleTime: 60_000,
    retry: false,
  })
}

/** Fetches authenticated User previews for the current debounced query. */
function useUserSearch(
  authScope: string | null,
  open: boolean,
  requestQuery: string,
  usersEnabled: boolean,
) {
  return useQuery({
    queryKey: ['quick-search', 'users', authScope, requestQuery],
    queryFn: async (): Promise<SearchData<QuickSearchRow[]>> => {
      const rows = await searchUsersPreview({
        data: { query: requestQuery },
      })
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
    enabled: open && requestQuery.length > 0 && usersEnabled,
    retry: false,
  })
}

/** Flattens grouped rows into stable keyboard option identities. */
function createItems(groups: QuickSearchGroups): QuickSearchItem[] {
  return (Object.entries(groups) as [keyof QuickSearchGroups, QuickSearchRow[]][])
    .flatMap(([group, rows]) => rows.map((row) => ({
      ...row,
      group,
      optionId: `quick-search-${group}-${row.id}`,
    })))
}

/** Keeps stale responses hidden while retaining independent lane successes. */
function createResultState(
  normalizedQuery: string,
  requestQuery: string,
  providerValue: SearchData<Omit<QuickSearchGroups, 'users'>> | undefined,
  userValue: SearchData<QuickSearchRow[]> | undefined,
  usersEnabled: boolean,
  valid: boolean,
): SearchResultState {
  const catalog = providerValue?.query === normalizedQuery
    ? providerValue.value
    : null
  const users = usersEnabled && userValue?.query === normalizedQuery
    ? userValue.value
    : []
  const groups: QuickSearchGroups = catalog === null
    ? { ...emptyGroups(), users }
    : { ...catalog, users }

  return {
    groups,
    items: createItems(groups),
    queryReady: valid && requestQuery === normalizedQuery,
  }
}

/** Builds the live-region message for the current query state. */
function createStatus(
  normalizedQuery: string,
  queryReady: boolean,
  providerPending: boolean,
  usersPending: boolean,
  allSuccess: boolean,
  itemCount: number,
): string {
  if (normalizedQuery.length > QUICK_SEARCH_MAX_LENGTH) {
    return `Search query must be at most ${QUICK_SEARCH_MAX_LENGTH} characters.`
  }
  if (normalizedQuery.length < QUICK_SEARCH_MIN_LENGTH) {
    return `Type at least ${QUICK_SEARCH_MIN_LENGTH} characters to search.`
  }
  if (!queryReady || providerPending || usersPending) return 'Searching…'
  if (allSuccess && itemCount === 0) {
    return `No results found for ${normalizedQuery}.`
  }
  return `${itemCount} results available.`
}

/** Owns roving active-option state while input retains DOM focus. */
function useActiveItem(
  items: QuickSearchItem[],
  onSelect: (destination: string) => void,
  open: boolean,
  normalizedQuery: string,
  resetVersion: number,
  valid: boolean,
) {
  const [activeIndex, setActiveIndex] = useState(-1)
  const itemIdentity = items.map((item) => item.optionId).join('|')

  useEffect(() => {
    if (!open) return
    setActiveIndex(-1)
  }, [itemIdentity, normalizedQuery, open, resetVersion, valid])

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (items.length === 0) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => {
        if (event.key === 'ArrowDown') return current < items.length - 1 ? current + 1 : 0
        return current > 0 ? current - 1 : items.length - 1
      })
    }
    if (event.key !== 'Enter' || activeIndex < 0) return
    event.preventDefault()
    const active = items[activeIndex]
    if (active) onSelect(active.destination)
  }

  return { activeIndex, onKeyDown }
}

/** Coordinates debounced provider and authenticated User preview searches. */
export function useQuickSearch(input: UseQuickSearchInput): QuickSearchModel {
  const query = useSearchQuery(input.open, input.resetVersion)
  const provider = useProviderSearch(input.open, query.requestQuery)
  const users = useUserSearch(
    input.authScope,
    input.open,
    query.requestQuery,
    input.usersEnabled,
  )
  const result = createResultState(
    query.normalizedQuery,
    query.requestQuery,
    provider.data,
    users.data,
    input.usersEnabled,
    query.valid,
  )
  const keyboard = useActiveItem(
    result.items,
    input.onSelect,
    input.open,
    query.normalizedQuery,
    input.resetVersion,
    query.valid,
  )
  const usersPending = input.usersEnabled && users.isPending
  const allSuccess = result.queryReady
    && provider.isSuccess
    && (!input.usersEnabled || users.isSuccess)
  const status = createStatus(
    query.normalizedQuery,
    result.queryReady,
    provider.isPending,
    usersPending,
    allSuccess,
    result.items.length,
  )

  return {
    activeIndex: keyboard.activeIndex,
    groups: result.groups,
    inputProps: {
      'aria-activedescendant': keyboard.activeIndex >= 0
        ? result.items[keyboard.activeIndex]?.optionId
        : undefined,
      'aria-controls': 'quick-search-results',
      'aria-label': 'Search AnimeX',
      onChange: query.onChange,
      onKeyDown: keyboard.onKeyDown,
      placeholder: 'Search anime, characters, staff, and users',
      role: 'searchbox',
      value: query.rawQuery,
    },
    items: result.items,
    normalizedQuery: query.normalizedQuery,
    providerError: provider.error instanceof Error && result.queryReady ? provider.error : null,
    providerLoading: result.queryReady && provider.isPending,
    queryReady: result.queryReady,
    retryProvider: () => { void provider.refetch() },
    retryUsers: () => { void users.refetch() },
    select: input.onSelect,
    status,
    userError: users.error instanceof Error && result.queryReady ? users.error : null,
    userLoading: result.queryReady && usersPending,
    usersEligible: input.usersEnabled,
  }
}
