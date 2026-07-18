import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'

import { CatalogPersonPage } from '#/features/catalog-person/ui/catalog-person-page'
import {
  ensureCatalogPersonChildData,
  getCatalogPersonRedirectHref,
  parseCatalogPersonRouteSearch,
} from '#/features/catalog-person/ui/catalog-person-route'

const rawTab = (search: string): string | undefined => new URLSearchParams(search).get('tab') ?? undefined
const validateSearch = (search: Record<string, unknown>): { tab?: 'anime' | 'voice-actors' } => {
  const tab = parseCatalogPersonRouteSearch('character', search.tab).tab
  return tab === 'overview' ? {} : { tab }
}

export const Route = createFileRoute('/_public/characters/$publicId/')({
  validateSearch,
  loader: async ({ params, location, context }) => {
    const state = await ensureCatalogPersonChildData(context.queryClient, 'character', params.publicId)
    const href = getCatalogPersonRedirectHref(state, 'character', params.publicId, null, rawTab(location.searchStr))
    if (href) throw redirect({ href, replace: true })
    return null
  },
  component: CharacterMissingSlugRoute,
})

function CharacterMissingSlugRoute() {
  const params = Route.useParams()
  const search = Route.useSearch()
  const state = Route.parentRoute.useLoaderData()
  const router = useRouter()
  const publicId = state.status === 'ready' ? state.entry.detail.publicId : params.publicId
  return <CatalogPersonPage publicId={publicId} kind="character" onRetry={() => void router.invalidate()} onTabChange={() => undefined} state={state} tab={search.tab ?? 'overview'} />
}
