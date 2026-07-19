import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'

import { CatalogPersonPage } from '#/features/catalog-person/ui/catalog-person-page'
import {
  ensureCatalogPersonChildData,
  getCatalogPersonRedirectHref,
  getCatalogPersonTabNavigation,
  parseCatalogPersonRouteSearch,
} from '#/features/catalog-person/ui/catalog-person-route'

const rawTab = (search: string): string | undefined => new URLSearchParams(search).get('tab') ?? undefined
const validateSearch = (search: Record<string, unknown>): { tab?: 'anime' } => (
  parseCatalogPersonRouteSearch('staff', search.tab).tab === 'anime' ? { tab: 'anime' } : {}
)

export const Route = createFileRoute('/_public/staff/$publicId/$slug')({
  validateSearch,
  loader: async ({ params, location, context }) => {
    const state = await ensureCatalogPersonChildData(context.queryClient, 'staff', params.publicId)
    const href = getCatalogPersonRedirectHref(state, 'staff', params.publicId, params.slug, rawTab(location.searchStr))
    if (href) throw redirect({ href, replace: true })
    return null
  },
  component: StaffDetailRoute,
})

function StaffDetailRoute() {
  const params = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const state = Route.parentRoute.useLoaderData()
  const router = useRouter()
  const publicId = state.status === 'ready' ? state.entry.detail.publicId : params.publicId
  return <CatalogPersonPage publicId={publicId} kind="staff" onRetry={() => void router.invalidate()} onTabChange={(tab) => void navigate(getCatalogPersonTabNavigation('staff', tab))} state={state} tab={search.tab ?? 'overview'} />
}
