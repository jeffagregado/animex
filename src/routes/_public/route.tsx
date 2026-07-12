import { Outlet, createFileRoute } from '@tanstack/react-router'

import { PublicShell } from '#/features/shell/public-shell'

export const Route = createFileRoute('/_public')({
  component: PublicRouteLayout,
})

function PublicRouteLayout() {
  return <PublicShell><Outlet /></PublicShell>
}
