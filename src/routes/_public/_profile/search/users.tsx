import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import {
  resolveUserSearchQuery,
  UserSearchPage,
} from '#/features/profile/ui/user-search-page'

export const Route = createFileRoute('/_public/_profile/search/users')({
  validateSearch: (search: Record<string, unknown>): { q?: unknown } => (
    search.q === undefined ? {} : { q: search.q }
  ),
  component: UserSearchRoute,
})

function UserSearchRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const state = resolveUserSearchQuery(search.q)

  useEffect(() => {
    if (!state.shouldReplace) return
    void navigate({ search: state.canonicalSearch, replace: true, resetScroll: false })
  }, [navigate, state.canonicalSearch, state.shouldReplace])

  if (state.shouldReplace) return <main aria-label="Correcting user search" />
  return <UserSearchPage onQuerySubmit={(query) => void navigate({ search: query ? { q: query } : {}, resetScroll: false })} query={state.query} />
}
