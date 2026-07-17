import { Outlet, createFileRoute } from '@tanstack/react-router'

import {
  catalogPersonQueryOptions,
  parseCatalogPersonRouteId,
} from '#/features/catalog-person/ui/catalog-person-route'

export const Route = createFileRoute('/_public/characters/$id')({
  params: { parse: (params) => ({ id: String(parseCatalogPersonRouteId(params.id)) }) },
  loader: async ({ context, params }) => await context.queryClient.ensureQueryData(
    catalogPersonQueryOptions('character', parseCatalogPersonRouteId(params.id)),
  ),
  pendingComponent: () => <main aria-busy="true" className="mx-auto max-w-7xl px-4 py-16 text-center text-muted-foreground">Loading character…</main>,
  component: CharacterParentRoute,
})

function CharacterParentRoute() {
  return <Outlet />
}
