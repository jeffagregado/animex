import {
  CatalogIdentityGatewayError,
  ensurePublicIds,
  resolvePublicIds,
  type CatalogIdentityGateway,
  type CatalogPublicIdentity,
} from '../../catalog-identity/server/catalog-identity.server'
import {
  animeSummarySchema,
  type AnimeSearchPage,
  type AnimeSummary,
  type DiscoverPageData,
  type DiscoverSection,
  type DiscoverSectionKey,
  type DiscoverSectionState,
} from '../shared/discover-contracts'
import {
  createAnimeProviderRefs,
  type AnimeSearchPageProvider,
  type AnimeSummaryProvider,
  type DiscoverPageDataProvider,
  type DiscoverSectionProvider,
} from './discover-provider-cache-contracts.server'

export type DiscoverIdentityDependencies = Pick<
  CatalogIdentityGateway,
  'ensurePublicIds' | 'resolvePublicIds'
>

/** Supplies production catalog identity operations. */
export const createDiscoverIdentityDependencies = (): DiscoverIdentityDependencies => ({
  ensurePublicIds,
  resolvePublicIds,
})

/** Replaces provider IDs with validated opaque public IDs. */
const attachPublicIds = (
  summaries: readonly AnimeSummaryProvider[],
  refs: ReturnType<typeof createAnimeProviderRefs>,
  identities: readonly CatalogPublicIdentity[],
): AnimeSummary[] => {
  const publicIds = new Map<number, string>()
  refs.forEach((ref, index) => {
    const identity = identities[index]
    if (!identity) throw new CatalogIdentityGatewayError('CATALOG_IDENTITY_MISSING')
    publicIds.set(ref.providerId, identity.publicId)
  })
  return summaries.map(({ anilistId, ...metadata }) => {
    const publicId = publicIds.get(anilistId)
    if (!publicId) throw new CatalogIdentityGatewayError('CATALOG_IDENTITY_MISSING')
    return animeSummarySchema.parse({ publicId, ...metadata })
  })
}

const resolveSummaries = async (
  summaries: readonly AnimeSummaryProvider[],
  operation: DiscoverIdentityDependencies['ensurePublicIds'],
): Promise<AnimeSummary[]> => {
  const refs = createAnimeProviderRefs(summaries)
  if (refs.length === 0) return []
  const identities = await operation(refs)
  return attachPublicIds(summaries, refs, identities)
}

/** Converts one verified provider cache page without identity writes. */
export const toPublicDiscoverPage = async (
  page: DiscoverPageDataProvider,
  dependencies: DiscoverIdentityDependencies,
): Promise<DiscoverPageData> => {
  const readySections = Object.values(page.sections)
    .filter((state) => state.status === 'ready')
    .map((state) => state.section)
  const providerItems = readySections.flatMap((section) => section.items)
  const publicItems = await resolveSummaries(providerItems, dependencies.resolvePublicIds)
  let itemIndex = 0
  const sections = {} as Record<DiscoverSectionKey, DiscoverSectionState>

  for (const [key, state] of Object.entries(page.sections)) {
    const sectionKey = key as DiscoverSectionKey
    if (state.status === 'error') {
      sections[sectionKey] = state
      continue
    }
    const items = publicItems.slice(itemIndex, itemIndex + state.section.items.length)
    itemIndex += state.section.items.length
    const section: DiscoverSection = { ...state.section, key: sectionKey, items }
    sections[sectionKey] = { status: 'ready', section }
  }
  return { sections }
}

/** Converts one live provider search response with one identity ensure. */
export const toPublicAnimeSearchPage = async (
  page: AnimeSearchPageProvider,
  dependencies: DiscoverIdentityDependencies,
): Promise<AnimeSearchPage> => ({
  ...page,
  items: await resolveSummaries(page.items, dependencies.ensurePublicIds),
})

/** Converts one verified provider cache section without identity writes. */
export const toPublicDiscoverSection = async (
  section: DiscoverSectionProvider,
  dependencies: DiscoverIdentityDependencies,
): Promise<DiscoverSection> => ({
  ...section,
  items: await resolveSummaries(section.items, dependencies.resolvePublicIds),
})
