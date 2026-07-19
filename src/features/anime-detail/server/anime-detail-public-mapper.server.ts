import {
  CatalogIdentityGatewayError,
  type CatalogProviderRef,
  type CatalogPublicIdentity,
} from '../../catalog-identity/server/catalog-identity.server'
import {
  animeCharacterPageSchema,
  animeDetailSchema,
  animeStaffPageSchema,
  type AnimeCharacter,
  type AnimeDetail,
  type AnimePeoplePage,
  type AnimeStaff,
} from '../shared/anime-detail-contracts'
import {
  type AnimeDetailProvider,
  type AnimeProviderCharacter,
  type AnimeProviderPeopleKind,
  type AnimeProviderPeoplePage,
  type AnimeProviderStaff,
} from './anime-detail-provider-cache-contracts.server'

export type AnimeDetailIdentityResolver = (
  refs: readonly CatalogProviderRef[],
) => Promise<CatalogPublicIdentity[]>

const refKey = (ref: CatalogProviderRef): string => `${ref.kind}:${ref.providerId}`

/** Keeps one ordered provider reference per catalog entity. */
const uniqueRefs = (refs: readonly CatalogProviderRef[]): CatalogProviderRef[] => {
  const keys = new Set<string>()
  return refs.filter((ref) => {
    const key = refKey(ref)
    if (keys.has(key)) return false
    keys.add(key)
    return true
  })
}

/** Resolves one bounded identity batch into a provider-reference lookup. */
const resolveLookup = async (
  refs: readonly CatalogProviderRef[],
  resolve: AnimeDetailIdentityResolver,
): Promise<Map<string, string>> => {
  const unique = uniqueRefs(refs)
  if (unique.length === 0) return new Map()
  const identities = await resolve(unique)
  const lookup = new Map<string, string>()
  unique.forEach((ref, index) => {
    const identity = identities[index]
    if (!identity || identity.kind !== ref.kind) {
      throw new CatalogIdentityGatewayError('CATALOG_IDENTITY_MISSING')
    }
    lookup.set(refKey(ref), identity.publicId)
  })
  return lookup
}

const publicId = (
  lookup: ReadonlyMap<string, string>,
  kind: CatalogProviderRef['kind'],
  providerId: number,
): string => {
  const value = lookup.get(`${kind}:${providerId}`)
  if (!value) throw new CatalogIdentityGatewayError('CATALOG_IDENTITY_MISSING')
  return value
}

/** Removes repeated public entities while preserving provider order. */
const dedupeByPublicId = <T extends { publicId: string }>(items: readonly T[]): T[] => {
  const ids = new Set<string>()
  return items.filter((item) => {
    if (ids.has(item.publicId)) return false
    ids.add(item.publicId)
    return true
  })
}

const peopleRefs = (
  page: AnimeProviderPeoplePage<AnimeProviderCharacter> | AnimeProviderPeoplePage<AnimeProviderStaff>,
  kind: AnimeProviderPeopleKind,
): CatalogProviderRef[] => kind === 'characters'
  ? (page as AnimeProviderPeoplePage<AnimeProviderCharacter>).items.flatMap((character) => [
      { provider: 'anilist', kind: 'character', providerId: character.anilistId } as const,
      ...(character.japaneseVoiceActor
        ? [{ provider: 'anilist', kind: 'staff', providerId: character.japaneseVoiceActor.anilistId } as const]
        : []),
    ])
  : (page as AnimeProviderPeoplePage<AnimeProviderStaff>).items.map((staff) => ({
      provider: 'anilist',
      kind: 'staff',
      providerId: staff.anilistId,
    }))

/** Converts one provider people page to strict browser-safe identities. */
export const mapAnimePeoplePage = async (
  page: AnimeProviderPeoplePage<AnimeProviderCharacter> | AnimeProviderPeoplePage<AnimeProviderStaff>,
  kind: AnimeProviderPeopleKind,
  resolve: AnimeDetailIdentityResolver,
): Promise<AnimePeoplePage<AnimeCharacter> | AnimePeoplePage<AnimeStaff>> => {
  const lookup = await resolveLookup(peopleRefs(page, kind), resolve)
  if (kind === 'characters') {
    const providerPage = page as AnimeProviderPeoplePage<AnimeProviderCharacter>
    return animeCharacterPageSchema.parse({
      ...providerPage,
      items: dedupeByPublicId(providerPage.items.map((character) => ({
        publicId: publicId(lookup, 'character', character.anilistId),
        name: character.name,
        role: character.role,
        imageUrl: character.imageUrl,
        japaneseVoiceActor: character.japaneseVoiceActor
          ? {
              publicId: publicId(lookup, 'staff', character.japaneseVoiceActor.anilistId),
              name: character.japaneseVoiceActor.name,
              imageUrl: character.japaneseVoiceActor.imageUrl,
              language: character.japaneseVoiceActor.language,
            }
          : null,
      }))),
    })
  }
  const providerPage = page as AnimeProviderPeoplePage<AnimeProviderStaff>
  return animeStaffPageSchema.parse({
    ...providerPage,
    items: dedupeByPublicId(providerPage.items.map((staff) => ({
      publicId: publicId(lookup, 'staff', staff.anilistId),
      name: staff.name,
      role: staff.role,
      imageUrl: staff.imageUrl,
    }))),
  })
}

/** Converts one provider detail and all nested identities to strict public metadata. */
export const mapAnimeDetail = async (
  detail: AnimeDetailProvider,
  resolve: AnimeDetailIdentityResolver,
): Promise<AnimeDetail> => {
  const refs: CatalogProviderRef[] = [
    { provider: 'anilist', kind: 'anime', providerId: detail.anilistId },
    ...detail.related.map((item) => ({ provider: 'anilist' as const, kind: 'anime' as const, providerId: item.anilistId })),
    ...detail.recommendations.map((item) => ({ provider: 'anilist' as const, kind: 'anime' as const, providerId: item.anilistId })),
    ...peopleRefs(detail.charactersPage, 'characters'),
    ...peopleRefs(detail.staffPage, 'staff'),
  ]
  const lookup = await resolveLookup(refs, resolve)
  const charactersPage = await mapAnimePeoplePage(
    detail.charactersPage,
    'characters',
    async (people) => people.map((ref) => ({
      publicId: publicId(lookup, ref.kind, ref.providerId),
      kind: ref.kind,
    })),
  )
  const staffPage = await mapAnimePeoplePage(
    detail.staffPage,
    'staff',
    async (people) => people.map((ref) => ({
      publicId: publicId(lookup, ref.kind, ref.providerId),
      kind: ref.kind,
    })),
  )
  const listItems = (items: AnimeDetailProvider['related']) => dedupeByPublicId(items.map((item) => ({
    publicId: publicId(lookup, 'anime', item.anilistId),
    slug: item.slug,
    title: item.title,
    coverImageUrl: item.coverImageUrl,
    format: item.format,
    seasonYear: item.seasonYear,
  })))
  const { anilistId: _anilistId, ...metadata } = detail
  return animeDetailSchema.parse({
    ...metadata,
    publicId: publicId(lookup, 'anime', detail.anilistId),
    related: listItems(detail.related),
    recommendations: listItems(detail.recommendations),
    charactersPage,
    staffPage,
  })
}
