import { useEffect } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'

import { CatalogPersonPage } from '#/features/catalog-person/ui/catalog-person-page'
import {
  ensureCatalogPersonChildData,
  getCatalogPersonRedirectHref,
  parseCatalogPersonRouteId,
  parseCatalogPersonRouteSearch,
  useCatalogPersonRouteState,
} from '#/features/catalog-person/ui/catalog-person-route'

const rawTab = (search: string): string | undefined => new URLSearchParams(search).get('tab') ?? undefined
const validateSearch = (search: Record<string, unknown>): { tab?: 'anime' | 'voice-actors' } => {
  const tab = parseCatalogPersonRouteSearch('character', search.tab).tab
  return tab === 'overview' ? {} : { tab }
}

export const Route = createFileRoute('/_public/characters/$id/')({
  validateSearch,
  loader: async ({ params, location, context }) => {
    const id = parseCatalogPersonRouteId(params.id)
    const state = await ensureCatalogPersonChildData(context.queryClient, 'character', params.id)
    const href = getCatalogPersonRedirectHref(state, 'character', id, null, rawTab(location.searchStr))
    if (href) throw redirect({ href, replace: true })
    return null
  },
  component: CharacterMissingSlugRoute,
})

function CharacterMissingSlugRoute() {
  const id = parseCatalogPersonRouteId(Route.useParams().id)
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { state, retry } = useCatalogPersonRouteState('character', id)
  useEffect(() => {
    if (state.status !== 'ready') return
    const href = getCatalogPersonRedirectHref(state, 'character', id, null, search.tab)
    if (href) void navigate({ href, replace: true })
  }, [id, navigate, search.tab, state])
  return <CatalogPersonPage id={id} kind="character" onRetry={() => void retry()} onTabChange={() => undefined} state={state} tab={search.tab ?? 'overview'} />
}
