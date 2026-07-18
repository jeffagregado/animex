import { queryOptions } from '@tanstack/react-query'

import {
  createCatalogPersonPath,
  parseCatalogPersonTab,
  slugifyCatalogPerson,
  type CatalogPersonKind,
  type CatalogPersonTab,
} from '../shared/catalog-person-contracts'
import {
  parseCatalogPublicId,
  type CatalogPublicId,
} from '../../catalog-identity/shared/catalog-identity-contracts'
import {
  ensureCatalogRouteIdentity,
  getCatalogStateStaleTime,
  type CatalogRouteIdentityClient,
} from '../../catalog-identity/ui/catalog-route'
import { getCatalogPerson } from '../server/catalog-person.functions'
import type { CatalogPersonState } from '../server/catalog-person-cache.server'

export type CatalogPersonPageState = CatalogPersonState | { status: 'loading' }
export type CatalogPersonRouteSearch = {
  tab: CatalogPersonTab
  replace: boolean
}

const STALE_TIME_MS = 15 * 60 * 1000

/** Parses one opaque public catalog route identity. */
export const parseCatalogPersonRouteId = (value: string): CatalogPublicId => parseCatalogPublicId(value)

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
const catalogPersonQueryOptions = (kind: CatalogPersonKind, publicId: CatalogPublicId) => queryOptions({
  queryKey: ['catalog-person', kind, publicId],
  queryFn: async (): Promise<CatalogPersonState> => await getCatalogPerson({ data: { kind, publicId } }),
  staleTime: (query) => getCatalogStateStaleTime(
    query.state.data?.status,
    STALE_TIME_MS,
  ),
})

type EnsureClient = CatalogRouteIdentityClient

/** Awaits parent-equivalent data when child loader starts from an empty cache. */
export const ensureCatalogPersonChildData = async (
  queryClient: EnsureClient,
  kind: CatalogPersonKind,
  idParam: string,
): Promise<CatalogPersonState> => {
  const identity = await ensureCatalogRouteIdentity(queryClient, kind, idParam)
  if (identity.status === 'resolved') {
    return await queryClient.fetchQuery(
      catalogPersonQueryOptions(kind, identity.publicId),
    )
  }
  if (identity.status === 'not-found') return { status: 'not-found' }
  return {
    status: 'error',
    code: 'CATALOG_IDENTITY_MISSING',
    message: 'Catalog identity is temporarily unavailable.',
    retryAfterSeconds: null,
  }
}

/** Returns canonical replacement only after detail reaches ready state. */
export const getCatalogPersonRedirectHref = (
  state: CatalogPersonState,
  kind: CatalogPersonKind,
  routeId: string,
  currentSlug: string | null,
  rawTab: unknown,
): string | null => {
  if (state.status !== 'ready') return null
  const search = parseCatalogPersonRouteSearch(kind, rawTab)
  const detail = state.entry.detail
  if (detail.kind !== kind) return null
  const slug = slugifyCatalogPerson(detail.name)
  if (routeId === detail.publicId && currentSlug === slug && !search.replace) return null
  const path = createCatalogPersonPath(kind, detail.publicId, detail.name)
  return search.tab === 'overview' ? path : `${path}?tab=${search.tab}`
}
