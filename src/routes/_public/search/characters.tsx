import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import {
  CatalogPersonSearchPage,
  resolveCatalogPersonSearchQuery,
} from '#/features/catalog-person/ui/catalog-person-search-page'

export const Route = createFileRoute('/_public/search/characters')({
  validateSearch: (search: Record<string, unknown>): { q?: unknown } => (
    search.q === undefined ? {} : { q: search.q }
  ),
  component: CharacterSearchRoute,
})

function CharacterSearchRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const state = resolveCatalogPersonSearchQuery(search.q)

  useEffect(() => {
    if (!state.shouldReplace) return
    void navigate({ search: state.canonicalSearch, replace: true, resetScroll: false })
  }, [navigate, state.canonicalSearch, state.shouldReplace])

  if (state.shouldReplace) return <main aria-label="Correcting character search" />
  return <CatalogPersonSearchPage kind="character" onQuerySubmit={(query) => void navigate({ search: query ? { q: query } : {}, resetScroll: false })} query={state.query} />
}
