import { queryOptions, type QueryClient } from '@tanstack/react-query'

import { getCatalogRouteIdentity } from '../server/catalog-identity.functions'
import type { CatalogRouteIdentity } from '../server/catalog-identity.server'
import type { CatalogEntityKind } from '../shared/catalog-identity-contracts'

const ROUTE_IDENTITY_STALE_TIME_MS = 15 * 60 * 1000

/** Keeps successful catalog data warm while making explicit failures retryable. */
export const getCatalogStateStaleTime = (
  status: string | undefined,
  successMilliseconds: number,
): number => status === 'error' || status === 'unavailable'
  ? 0
  : successMilliseconds

/** Builds one cached, provider-neutral route identity lookup. */
const catalogRouteIdentityQueryOptions = (
  kind: CatalogEntityKind,
  rawId: string,
) => queryOptions({
  queryKey: ['catalog-route-identity', kind, rawId],
  queryFn: async (): Promise<CatalogRouteIdentity> => await getCatalogRouteIdentity({
    data: { kind, rawId },
  }),
  staleTime: (query) => getCatalogStateStaleTime(
    query.state.data?.status,
    ROUTE_IDENTITY_STALE_TIME_MS,
  ),
})

export type CatalogRouteIdentityClient = Pick<QueryClient, 'fetchQuery'>

/** Resolves one route identity before any provider-backed metadata query. */
export const ensureCatalogRouteIdentity = async (
  queryClient: CatalogRouteIdentityClient,
  kind: CatalogEntityKind,
  rawId: string,
): Promise<CatalogRouteIdentity> => await queryClient.fetchQuery(
  catalogRouteIdentityQueryOptions(kind, rawId),
)
