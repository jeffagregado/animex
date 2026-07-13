import { createFileRoute, redirect } from '@tanstack/react-router'

import { createCanonicalAnimePath, normalizeAnimeDetailTab } from '#/features/anime-detail/shared/anime-detail-contracts'

export const Route = createFileRoute('/_public/anime/$anilistId/')({
  validateSearch: (search) => ({ tab: normalizeAnimeDetailTab(search.tab) }),
  loader: ({ params, location, context }) => {
    const state = context.queryClient.getQueryData(['anime-detail', Number(params.anilistId)]) as ReturnType<typeof Route.parentRoute.useLoaderData> | undefined
    if (state?.status === 'ready') {
      const tab = normalizeAnimeDetailTab(new URLSearchParams(location.searchStr).get('tab'))
      throw redirect({ href: createCanonicalAnimePath(state.entry.detail.anilistId, state.entry.detail.titles.display, tab), replace: true })
    }
    return null
  },
  component: () => null,
})
