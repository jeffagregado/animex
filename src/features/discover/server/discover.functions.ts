import { createServerFn } from '@tanstack/react-start'

import { animeSearchInputSchema, discoverSectionKeySchema } from '../shared/discover-contracts'
import { searchAnimeFromAniList, createAniListDependencies } from './anilist.server'
import {
  createDiscoverCacheDependencies,
  getDiscoverPageServer,
  refreshDiscoverSectionServer,
} from './discover-cache.server'

export const getDiscoverPage = createServerFn({ method: 'GET' })
  .handler(async () => await getDiscoverPageServer(createDiscoverCacheDependencies()))

export const refreshDiscoverSection = createServerFn({ method: 'POST' })
  .validator(discoverSectionKeySchema)
  .handler(async ({ data }) => await refreshDiscoverSectionServer(data, createDiscoverCacheDependencies()))

export const searchAnime = createServerFn({ method: 'GET' })
  .validator(animeSearchInputSchema)
  .handler(async ({ data }) => await searchAnimeFromAniList(data, createAniListDependencies()))
