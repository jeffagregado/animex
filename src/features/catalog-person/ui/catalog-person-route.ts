import { queryOptions, useQuery } from '@tanstack/react-query'

import {
  createCatalogPersonPath,
  parseCatalogPersonId,
  parseCatalogPersonTab,
  slugifyCatalogPerson,
  type CatalogPersonKind,
  type CatalogPersonTab,
} from '../shared/catalog-person-contracts'
import { getCatalogPerson } from '../server/catalog-person.functions'
import type { CatalogPersonState } from '../server/catalog-person-cache.server'

export type CatalogPersonPageState = CatalogPersonState | { status: 'loading' }
export type CatalogPersonRouteSearch = {
  tab: CatalogPersonTab
  replace: boolean
}

const STALE_TIME_MS = 15 * 60 * 1000

/** Rejects leading zeroes, partial numbers, and unsafe identities. */
export const parseCatalogPersonRouteId = (value: string): number => {
  if (!/^[1-9]\d*$/.test(value)) throw new RangeError('CATALOG_PERSON_ID_INVALID')
  return parseCatalogPersonId(Number(value))
}

/** Normalizes raw search while retaining whether URL replacement is required. */
export const parseCatalogPersonRouteSearch = (
  kind: CatalogPersonKind,
  value: unknown,
): CatalogPersonRouteSearch => {
  if (kind === 'staff' && value === 'works') {
    return { tab: 'anime', replace: true }
  }
  try {
    const tab = parseCatalogPersonTab(kind, value)
    return { tab, replace: value === 'overview' }
  } catch {
    return { tab: 'overview', replace: true }
  }
}

/** Keeps user tab history scroll-stable. */
export function getCatalogPersonTabNavigation(
  kind: CatalogPersonKind,
  tab: CatalogPersonTab,
): { search: Record<string, string>; resetScroll: false } {
  const parsed = parseCatalogPersonTab(kind, tab)
  return { search: parsed === 'overview' ? {} : { tab: parsed }, resetScroll: false }
}

/** Builds detail query shared by parent loader and child rendering. */
export const catalogPersonQueryOptions = (kind: CatalogPersonKind, id: number) => queryOptions({
  queryKey: ['catalog-person', kind, id],
  queryFn: async (): Promise<CatalogPersonState> => await getCatalogPerson({ data: { kind, id } }),
  staleTime: STALE_TIME_MS,
})

type EnsureClient = {
  ensureQueryData: (options: ReturnType<typeof catalogPersonQueryOptions>) => Promise<CatalogPersonState>
}

/** Awaits parent-equivalent data when child loader starts from an empty cache. */
export const ensureCatalogPersonChildData = async (
  queryClient: EnsureClient,
  kind: CatalogPersonKind,
  idParam: string,
): Promise<CatalogPersonState> => await queryClient.ensureQueryData(
  catalogPersonQueryOptions(kind, parseCatalogPersonRouteId(idParam)),
)

/** Returns canonical replacement only after detail reaches ready state. */
export const getCatalogPersonRedirectHref = (
  state: CatalogPersonState,
  kind: CatalogPersonKind,
  id: number,
  currentSlug: string | null,
  rawTab: unknown,
): string | null => {
  if (state.status !== 'ready') return null
  const search = parseCatalogPersonRouteSearch(kind, rawTab)
  const detail = state.entry.detail
  if (detail.kind !== kind || detail.id !== id) return null
  const slug = slugifyCatalogPerson(detail.name)
  if (currentSlug === slug && !search.replace) return null
  const path = createCatalogPersonPath(kind, id, detail.name)
  return search.tab === 'overview' ? path : `${path}?tab=${search.tab}`
}

/** Exposes explicit loading/errors and a stable retry action to route views. */
export const useCatalogPersonRouteState = (kind: CatalogPersonKind, id: number) => {
  const query = useQuery(catalogPersonQueryOptions(kind, id))
  const state: CatalogPersonPageState = query.isPending
    ? { status: 'loading' }
    : query.isError
      ? { status: 'error', code: 'UPSTREAM', message: query.error.message, retryAfterSeconds: null }
      : query.data
  return { state, retry: query.refetch }
}
