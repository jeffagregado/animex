import { Outlet, createFileRoute } from '@tanstack/react-router'

import {
  ensureCatalogPersonChildData,
} from '#/features/catalog-person/ui/catalog-person-route'

export const Route = createFileRoute('/_public/staff/$publicId')({
  loader: async ({ context, params }) => await ensureCatalogPersonChildData(
    context.queryClient,
    'staff',
    params.publicId,
  ),
  pendingComponent: () => <main aria-busy="true" className="mx-auto max-w-7xl px-4 py-16 text-center text-muted-foreground">Loading staff…</main>,
  component: StaffParentRoute,
})

function StaffParentRoute() {
  return <Outlet />
}
