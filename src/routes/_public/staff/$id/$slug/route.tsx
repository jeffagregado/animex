import { useEffect } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'

import { CatalogPersonPage } from '#/features/catalog-person/ui/catalog-person-page'
import {
  ensureCatalogPersonChildData,
  getCatalogPersonRedirectHref,
  getCatalogPersonTabNavigation,
  parseCatalogPersonRouteId,
  parseCatalogPersonRouteSearch,
  useCatalogPersonRouteState,
} from '#/features/catalog-person/ui/catalog-person-route'

const rawTab = (search: string): string | undefined => new URLSearchParams(search).get('tab') ?? undefined
const validateSearch = (search: Record<string, unknown>): { tab?: 'anime' } => (
  parseCatalogPersonRouteSearch('staff', search.tab).tab === 'anime' ? { tab: 'anime' } : {}
)

export const Route = createFileRoute('/_public/staff/$id/$slug')({
  validateSearch,
  loader: async ({ params, location, context }) => {
    const id = parseCatalogPersonRouteId(params.id)
    const state = await ensureCatalogPersonChildData(context.queryClient, 'staff', params.id)
    const href = getCatalogPersonRedirectHref(state, 'staff', id, params.slug, rawTab(location.searchStr))
    if (href) throw redirect({ href, replace: true })
    return null
  },
  component: StaffDetailRoute,
})

function StaffDetailRoute() {
  const params = Route.useParams()
  const id = parseCatalogPersonRouteId(params.id)
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { state, retry } = useCatalogPersonRouteState('staff', id)
  useEffect(() => {
    if (state.status !== 'ready') return
    const href = getCatalogPersonRedirectHref(state, 'staff', id, params.slug, search.tab)
    if (href) void navigate({ href, replace: true })
  }, [id, navigate, params.slug, search.tab, state])
  return <CatalogPersonPage id={id} kind="staff" onRetry={() => void retry()} onTabChange={(tab) => void navigate(getCatalogPersonTabNavigation('staff', tab))} state={state} tab={search.tab ?? 'overview'} />
}
