import { Outlet, createFileRoute } from '@tanstack/react-router'
import { queryOptions } from '@tanstack/react-query'

import { getAnimeDetail } from '#/features/anime-detail/server/anime-detail.functions'
import type { PublicAnimeDetailState } from '#/features/anime-detail/shared/anime-detail-contracts'
import {
  ensureCatalogRouteIdentity,
  getCatalogStateStaleTime,
  type CatalogRouteIdentityClient,
} from '#/features/catalog-identity/ui/catalog-route'

const ANIME_DETAIL_STALE_TIME_MS = 15 * 60 * 1000

/** Defines the one hydrated browser query for public detail metadata. */
const animeDetailQueryOptions = (publicId: string) => queryOptions({
  queryKey: ['anime-detail', publicId],
  queryFn: async (): Promise<PublicAnimeDetailState> => await getAnimeDetail({
    data: { publicId },
  }),
  staleTime: (query) => getCatalogStateStaleTime(
    query.state.data?.status,
    ANIME_DETAIL_STALE_TIME_MS,
  ),
})

type AnimeDetailEnsureClient = CatalogRouteIdentityClient

/** Resolves canonical or legacy identity before loading public detail metadata. */
export const ensureAnimeDetailChildData = async (
  queryClient: AnimeDetailEnsureClient,
  routeId: string,
): Promise<PublicAnimeDetailState> => {
  const identity = await ensureCatalogRouteIdentity(queryClient, 'anime', routeId)
  if (identity.status === 'resolved') {
    return await queryClient.fetchQuery(
      animeDetailQueryOptions(identity.publicId),
    )
  }
  if (identity.status === 'not-found') {
    return { status: 'not-found', code: 'NOT_FOUND', message: 'Anime not found.' }
  }
  return {
    status: 'error',
    code: 'CATALOG_IDENTITY_MISSING',
    message: 'Anime identity is temporarily unavailable.',
    retryAfterSeconds: null,
  }
}

export const Route = createFileRoute('/_public/anime/$publicId')({
  loader: async ({ context, params }) => await ensureAnimeDetailChildData(
    context.queryClient,
    params.publicId,
  ),
  component: AnimeDetailParentRoute,
})

function AnimeDetailParentRoute() {
  return <Outlet />
}
