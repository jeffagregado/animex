import {
  CatalogIdentityGatewayError,
  type CatalogProviderRef,
  type CatalogPublicIdentity,
} from '../../catalog-identity/server/catalog-identity.server'
import { slugifyAnimeTitle } from '../../discover/shared/discover-contracts'
import {
  catalogPersonDetailSchema,
  catalogPersonSearchPageSchema,
  catalogPersonWorkPageSchema,
  createCatalogPersonPath,
  type CatalogPersonDetail,
  type CatalogPersonSearchPage,
  type CatalogPersonWorkPage,
} from '../shared/catalog-person-contracts'
import {
  type CatalogPersonProviderDetail,
  type CatalogPersonProviderSearchPage,
  type CatalogPersonProviderWorkPage,
} from './catalog-person-provider-cache-contracts.server'

const DESCRIPTION_LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g

type BiographyLink = {
  end: number
  label: string
  ref: CatalogProviderRef
  start: number
}

export type CatalogPersonIdentityResolver = (
  refs: readonly CatalogProviderRef[],
) => Promise<CatalogPublicIdentity[]>

/** Builds one stable key for a provider reference. */
const refKey = (ref: CatalogProviderRef): string => (
  `${ref.provider}:${ref.kind}:${ref.providerId}`
)

/** Keeps first-seen provider references in response order. */
const uniqueRefs = (refs: readonly CatalogProviderRef[]): CatalogProviderRef[] => {
  const seen = new Set<string>()
  return refs.filter((ref) => {
    const key = refKey(ref)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Resolves a provider batch into a keyed public-ID map. */
const identityMap = async (
  refs: readonly CatalogProviderRef[],
  resolve: CatalogPersonIdentityResolver,
): Promise<Map<string, string>> => {
  const unique = uniqueRefs(refs)
  if (unique.length === 0) return new Map()
  const identities = await resolve(unique)
  if (identities.length !== unique.length) {
    throw new CatalogIdentityGatewayError('CATALOG_IDENTITY_MISSING')
  }
  return new Map(unique.map((ref, index) => {
    const identity = identities[index]
    if (!identity || identity.kind !== ref.kind) {
      throw new CatalogIdentityGatewayError('CATALOG_IDENTITY_MISSING')
    }
    return [refKey(ref), identity.publicId]
  }))
}

/** Reads one required public ID from a validated identity result. */
const requirePublicId = (
  identities: ReadonlyMap<string, string>,
  ref: CatalogProviderRef,
): string => {
  const publicId = identities.get(refKey(ref))
  if (!publicId) {
    throw new CatalogIdentityGatewayError('CATALOG_IDENTITY_MISSING')
  }
  return publicId
}

/** Parses one supported AniList entity target without exposing it. */
const biographyRef = (target: string): CatalogProviderRef | null => {
  let url: URL
  try {
    url = new URL(target)
  } catch (error) {
    if (error instanceof TypeError) return null
    throw error
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || host !== 'anilist.co') {
    return null
  }
  const segments = url.pathname.split('/').filter(Boolean)
  if (segments.length < 2 || segments.length > 3) return null
  const [entity, idText] = segments
  if (!idText || !/^[1-9]\d*$/.test(idText)) return null
  const providerId = Number(idText)
  if (!Number.isSafeInteger(providerId)) return null
  const kind = entity === 'anime'
    ? 'anime'
    : entity === 'character' || entity === 'staff'
      ? entity
      : null
  return kind ? { provider: 'anilist', kind, providerId } : null
}

/** Extracts supported provider links from normalized biography text. */
const biographyLinks = (description: string): BiographyLink[] => (
  [...description.matchAll(DESCRIPTION_LINK)].flatMap((match) => {
    const label = match[1]
    const target = match[2]
    const start = match.index
    const ref = target ? biographyRef(target) : null
    return label && ref
      ? [{ end: start + match[0].length, label, ref, start }]
      : []
  })
)

/** Builds a canonical internal target for one rewritten biography link. */
const biographyPath = (
  link: BiographyLink,
  identities: ReadonlyMap<string, string>,
): string => {
  const publicId = requirePublicId(identities, link.ref)
  if (link.ref.kind === 'anime') {
    return `/anime/${publicId}/${encodeURIComponent(slugifyAnimeTitle(link.label))}`
  }
  return createCatalogPersonPath(link.ref.kind, publicId, link.label)
}

/** Rewrites supported provider biography links before browser serialization. */
const rewriteDescription = (
  description: string | null,
  links: readonly BiographyLink[],
  identities: ReadonlyMap<string, string>,
): string | null => {
  if (description === null) return null
  if (links.length === 0) return description
  let cursor = 0
  let result = ''
  for (const link of links) {
    result += description.slice(cursor, link.start)
    result += `[${link.label}](${biographyPath(link, identities)})`
    cursor = link.end
  }
  return result + description.slice(cursor)
}

/** Converts cached provider detail to strict browser detail. */
export const mapCatalogPersonDetail = async (
  detail: CatalogPersonProviderDetail,
  resolve: CatalogPersonIdentityResolver,
): Promise<CatalogPersonDetail> => {
  const personRef: CatalogProviderRef = {
    provider: 'anilist',
    kind: detail.kind,
    providerId: detail.id,
  }
  const actorRefs = detail.kind === 'character'
    ? detail.voiceActors.map((actor) => ({
      provider: 'anilist' as const,
      kind: 'staff' as const,
      providerId: actor.id,
    }))
    : []
  const links = detail.description === null ? [] : biographyLinks(detail.description)
  const mapped = await identityMap(
    [personRef, ...actorRefs, ...links.map((link) => link.ref)],
    resolve,
  )
  const description = rewriteDescription(detail.description, links, mapped)
  if (detail.kind === 'staff') {
    const { id: _id, ...display } = detail
    return catalogPersonDetailSchema.parse({
      ...display,
      description,
      publicId: requirePublicId(mapped, personRef),
    })
  }
  const { id: _id, voiceActors, ...display } = detail
  return catalogPersonDetailSchema.parse({
    ...display,
    description,
    publicId: requirePublicId(mapped, personRef),
    voiceActors: voiceActors.map((actor, index) => {
      const ref = actorRefs[index]
      if (!ref) throw new CatalogIdentityGatewayError('CATALOG_IDENTITY_MISSING')
      const { id: _actorId, ...actorDisplay } = actor
      return {
        ...actorDisplay,
        publicId: requirePublicId(mapped, ref),
      }
    }),
  })
}

/** Converts one verified cached work page to strict browser rows. */
export const mapCatalogPersonWorkPage = async (
  page: CatalogPersonProviderWorkPage,
  resolve: CatalogPersonIdentityResolver,
): Promise<CatalogPersonWorkPage> => {
  const refs = page.items.map((item) => ({
    provider: 'anilist' as const,
    kind: 'anime' as const,
    providerId: item.anime.id,
  }))
  const mapped = await identityMap(refs, resolve)
  return catalogPersonWorkPageSchema.parse({
    ...page,
    items: page.items.map((item, index) => {
      const ref = refs[index]
      if (!ref) throw new CatalogIdentityGatewayError('CATALOG_IDENTITY_MISSING')
      const { id: _id, ...anime } = item.anime
      return {
        ...item,
        anime: { ...anime, publicId: requirePublicId(mapped, ref) },
      }
    }),
  })
}

/** Converts one live person search page to strict browser rows. */
export const mapCatalogPersonSearchPage = async (
  page: CatalogPersonProviderSearchPage,
  ensure: CatalogPersonIdentityResolver,
): Promise<CatalogPersonSearchPage> => {
  const refs = page.items.map((item) => ({
    provider: 'anilist' as const,
    kind: item.kind,
    providerId: item.id,
  }))
  const mapped = await identityMap(refs, ensure)
  return catalogPersonSearchPageSchema.parse({
    ...page,
    items: page.items.map((item, index) => {
      const ref = refs[index]
      if (!ref) throw new CatalogIdentityGatewayError('CATALOG_IDENTITY_MISSING')
      const publicId = requirePublicId(mapped, ref)
      const { id: _id, ...display } = item
      return {
        ...display,
        publicId,
        destination: createCatalogPersonPath(item.kind, publicId, item.name),
      }
    }),
  })
}
