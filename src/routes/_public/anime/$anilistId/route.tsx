import { Outlet, createFileRoute } from '@tanstack/react-router'
import { queryOptions } from '@tanstack/react-query'

import { getAnimeDetail } from '#/features/anime-detail/server/anime-detail.functions'
import { parseAnilistId, type PublicAnimeDetailState } from '#/features/anime-detail/shared/anime-detail-contracts'

export const ANIME_DETAIL_STALE_TIME_MS = 15 * 60 * 1000

/** Parses a route parameter without accepting partial or unsafe numbers. */
export const parseAnimeRouteId = (value: string): number => {
  if (!/^\d+$/.test(value)) throw new RangeError('AniList ID must be a positive safe integer.')
  return parseAnilistId(Number(value))
}

/** Defines the one hydrated browser query for public detail metadata. */
export const animeDetailQueryOptions = (anilistId: number) => queryOptions({
  queryKey: ['anime-detail', anilistId],
  queryFn: async (): Promise<PublicAnimeDetailState> => await getAnimeDetail({ data: { anilistId } }),
  staleTime: ANIME_DETAIL_STALE_TIME_MS,
})

export const Route = createFileRoute('/_public/anime/$anilistId')({
  params: { parse: (params) => ({ anilistId: String(parseAnimeRouteId(params.anilistId)) }) },
  loader: async ({ context, params }) => await context.queryClient.ensureQueryData(animeDetailQueryOptions(parseAnimeRouteId(params.anilistId))),
  component: AnimeDetailParentRoute,
})

function AnimeDetailParentRoute() {
  return <Outlet />
}
