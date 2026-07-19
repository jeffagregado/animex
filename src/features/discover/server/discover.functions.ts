import { createServerFn } from '@tanstack/react-start'

import { animeSearchInputSchema, discoverSectionKeySchema } from '../shared/discover-contracts'
import { searchAnimeFromAniList, createAniListDependencies } from './anilist.server'
import {
  createDiscoverCacheDependencies,
  getDiscoverPageServer,
  refreshDiscoverSectionServer,
} from './discover-cache.server'
import {
  createDiscoverIdentityDependencies,
  toPublicAnimeSearchPage,
  toPublicDiscoverPage,
  toPublicDiscoverSection,
} from './discover-public-metadata.server'

export const getDiscoverPage = createServerFn({ method: 'GET' })
  .handler(async () => {
    const page = await getDiscoverPageServer(createDiscoverCacheDependencies())
    return await toPublicDiscoverPage(page, createDiscoverIdentityDependencies())
  })

export const refreshDiscoverSection = createServerFn({ method: 'POST' })
  .validator(discoverSectionKeySchema)
  .handler(async ({ data }) => {
    const state = await refreshDiscoverSectionServer(data, createDiscoverCacheDependencies())
    if (state.status === 'error') return state
    return {
      status: 'ready' as const,
      section: await toPublicDiscoverSection(
        state.section,
        createDiscoverIdentityDependencies(),
      ),
    }
  })

export const searchAnime = createServerFn({ method: 'GET' })
  .validator(animeSearchInputSchema)
  .handler(async ({ data }) => {
    const page = await searchAnimeFromAniList(data, createAniListDependencies())
    return await toPublicAnimeSearchPage(page, createDiscoverIdentityDependencies())
  })
