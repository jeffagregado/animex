import { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'
import { z } from 'zod'

import {
  catalogEntityKindSchema,
  classifyCatalogRouteId,
  type CatalogEntityKind,
  type CatalogPublicId,
  parseCatalogPublicId,
} from '../shared/catalog-identity-contracts'

const BATCH_MAX = 100

export type CatalogProviderRef = {
  provider: 'anilist'
  kind: CatalogEntityKind
  providerId: number
}

export type CatalogPublicIdentity = {
  publicId: CatalogPublicId
  kind: CatalogEntityKind
}

export type CatalogRouteIdentity =
  | {
    status: 'resolved'
    source: 'public' | 'legacy'
    publicId: CatalogPublicId
    kind: CatalogEntityKind
  }
  | {
    status: 'not-found' | 'unavailable'
    source: 'public' | 'legacy'
    publicId: null
    kind: CatalogEntityKind
  }

type CatalogIdentityGatewayErrorCode =
  | 'CATALOG_IDENTITY_INVALID'
  | 'CATALOG_IDENTITY_MISSING'
  | 'CATALOG_IDENTITY_UNAVAILABLE'

export class CatalogIdentityGatewayError extends Error {
  readonly code: CatalogIdentityGatewayErrorCode

  constructor(code: CatalogIdentityGatewayErrorCode) {
    super(code)
    this.name = 'CatalogIdentityGatewayError'
    this.code = code
  }
}

export interface CatalogIdentityClient {
  ensureProviderRefs: (
    refs: CatalogProviderRef[],
    token: string,
  ) => Promise<CatalogPublicIdentity[]>
  resolveProviderRefs: (
    refs: CatalogProviderRef[],
    token: string,
  ) => Promise<CatalogPublicIdentity[]>
  resolveProviderByPublicId: (
    input: { publicId: CatalogPublicId; kind: CatalogEntityKind },
    token: string,
  ) => Promise<CatalogProviderRef>
}

export interface CatalogIdentityDependencies {
  client: CatalogIdentityClient
  token: string
}

export interface CatalogIdentityGateway {
  ensurePublicIds: (refs: readonly CatalogProviderRef[]) => Promise<CatalogPublicIdentity[]>
  resolvePublicIds: (refs: readonly CatalogProviderRef[]) => Promise<CatalogPublicIdentity[]>
  resolveProviderByPublicId: (
    input: { publicId: CatalogPublicId; kind: CatalogEntityKind },
  ) => Promise<CatalogProviderRef>
  resolveRouteIdentity: (
    input: { rawId: string; kind: CatalogEntityKind },
  ) => Promise<CatalogRouteIdentity>
}

const providerRefSchema = z.object({
  provider: z.literal('anilist'),
  kind: catalogEntityKindSchema,
  providerId: z.number().int().positive().safe(),
}).strict()

const providerRefBatchSchema = z.array(providerRefSchema)
  .min(1)
  .max(BATCH_MAX)
  .superRefine((refs, ctx) => {
    const keys = new Set<string>()
    for (const ref of refs) {
      const key = `${ref.provider}:${ref.kind}:${ref.providerId}`
      if (keys.has(key)) {
        ctx.addIssue({ code: 'custom', message: 'Provider references must be unique.' })
      }
      keys.add(key)
    }
  })

const ensureRefs = makeFunctionReference<
  'mutation',
  { token: string; refs: CatalogProviderRef[] },
  CatalogPublicIdentity[]
>('catalogIdentity:ensureProviderRefs')

const resolveRefs = makeFunctionReference<
  'query',
  { token: string; refs: CatalogProviderRef[] },
  CatalogPublicIdentity[]
>('catalogIdentity:resolveProviderRefs')

const resolveProvider = makeFunctionReference<
  'query',
  { token: string; publicId: string; kind: CatalogEntityKind },
  CatalogProviderRef
>('catalogIdentity:resolveProviderByPublicId')

/** Reads required server-only configuration without exposing its value. */
const requireServerEnv = (name: 'VITE_CONVEX_URL' | 'DISCOVER_CACHE_WRITE_TOKEN'): string => {
  const value = process.env[name]
  if (!value) throw new CatalogIdentityGatewayError('CATALOG_IDENTITY_UNAVAILABLE')
  return value
}

/** Creates token-gated Convex identity operations. */
const createConvexIdentityClient = (url: string): CatalogIdentityClient => {
  const convex = new ConvexHttpClient(url)
  return {
    ensureProviderRefs: async (refs, token) => await convex.mutation(
      ensureRefs,
      { refs, token },
    ),
    resolveProviderRefs: async (refs, token) => await convex.query(
      resolveRefs,
      { refs, token },
    ),
    resolveProviderByPublicId: async (input, token) => await convex.query(
      resolveProvider,
      { ...input, token },
    ),
  }
}

/** Extracts only a machine-readable Convex domain code. */
const readErrorCode = (error: unknown): string | null => {
  if (error instanceof CatalogIdentityGatewayError) return error.code
  if (
    typeof error === 'object'
    && error !== null
    && 'data' in error
    && typeof error.data === 'object'
    && error.data !== null
    && 'code' in error.data
    && typeof error.data.code === 'string'
  ) {
    return error.data.code
  }
  return null
}

/** Converts all remote failures to stable server-safe gateway errors. */
const toGatewayError = (error: unknown): CatalogIdentityGatewayError => {
  const code = readErrorCode(error)
  if (
    code === 'CATALOG_PROVIDER_REF_MISSING'
    || code === 'CATALOG_PUBLIC_ID_MISSING'
    || code === 'CATALOG_ENTITY_KIND_CONFLICT'
    || code === 'CATALOG_IDENTITY_MISSING'
  ) {
    return new CatalogIdentityGatewayError('CATALOG_IDENTITY_MISSING')
  }
  if (code === 'CATALOG_IDENTITY_INVALID') {
    return new CatalogIdentityGatewayError('CATALOG_IDENTITY_INVALID')
  }
  return new CatalogIdentityGatewayError('CATALOG_IDENTITY_UNAVAILABLE')
}

/** Validates a bounded unique provider batch before crossing the server boundary. */
const parseRefs = (refs: readonly CatalogProviderRef[]): CatalogProviderRef[] => {
  const result = providerRefBatchSchema.safeParse(refs)
  if (!result.success) throw new CatalogIdentityGatewayError('CATALOG_IDENTITY_INVALID')
  return result.data
}

/** Rejects missing, reordered, or malformed identity results. */
const parseIdentities = (
  refs: readonly CatalogProviderRef[],
  identities: readonly CatalogPublicIdentity[],
): CatalogPublicIdentity[] => {
  if (identities.length !== refs.length) {
    throw new CatalogIdentityGatewayError('CATALOG_IDENTITY_UNAVAILABLE')
  }
  return identities.map((identity, index) => {
    const expected = refs[index]
    if (!expected || identity.kind !== expected.kind) {
      throw new CatalogIdentityGatewayError('CATALOG_IDENTITY_UNAVAILABLE')
    }
    let publicId: CatalogPublicId
    try {
      publicId = parseCatalogPublicId(identity.publicId)
    } catch {
      throw new CatalogIdentityGatewayError('CATALOG_IDENTITY_UNAVAILABLE')
    }
    if (publicId !== identity.publicId) {
      throw new CatalogIdentityGatewayError('CATALOG_IDENTITY_UNAVAILABLE')
    }
    return { publicId, kind: expected.kind }
  })
}

/** Builds identity operations from explicit server dependencies. */
export const createCatalogIdentityGateway = (
  dependencies: CatalogIdentityDependencies,
): CatalogIdentityGateway => {
  const resolveBatch = async (
    refs: readonly CatalogProviderRef[],
    operation: 'ensure' | 'resolve',
  ): Promise<CatalogPublicIdentity[]> => {
    const parsedRefs = parseRefs(refs)
    try {
      const identities = operation === 'ensure'
        ? await dependencies.client.ensureProviderRefs(parsedRefs, dependencies.token)
        : await dependencies.client.resolveProviderRefs(parsedRefs, dependencies.token)
      return parseIdentities(parsedRefs, identities)
    } catch (error) {
      throw toGatewayError(error)
    }
  }

  const reverse = async (
    input: { publicId: CatalogPublicId; kind: CatalogEntityKind },
  ): Promise<CatalogProviderRef> => {
    let publicId: CatalogPublicId
    try {
      publicId = parseCatalogPublicId(input.publicId)
      catalogEntityKindSchema.parse(input.kind)
    } catch {
      throw new CatalogIdentityGatewayError('CATALOG_IDENTITY_INVALID')
    }
    try {
      const providerRef = await dependencies.client.resolveProviderByPublicId(
        { publicId, kind: input.kind },
        dependencies.token,
      )
      const parsed = providerRefSchema.parse(providerRef)
      if (parsed.kind !== input.kind) {
        throw new CatalogIdentityGatewayError('CATALOG_IDENTITY_UNAVAILABLE')
      }
      return parsed
    } catch (error) {
      throw toGatewayError(error)
    }
  }

  return {
    ensurePublicIds: async (refs) => await resolveBatch(refs, 'ensure'),
    resolvePublicIds: async (refs) => await resolveBatch(refs, 'resolve'),
    resolveProviderByPublicId: reverse,
    resolveRouteIdentity: async ({ rawId, kind }) => {
      let routeId
      try {
        routeId = classifyCatalogRouteId(rawId)
        catalogEntityKindSchema.parse(kind)
      } catch {
        return { status: 'not-found', source: 'public', publicId: null, kind }
      }
      try {
        if (routeId.source === 'public') {
          await reverse({ publicId: routeId.publicId, kind })
          return {
            status: 'resolved',
            source: 'public',
            publicId: routeId.publicId,
            kind,
          }
        }
        const [identity] = await resolveBatch([{
          provider: 'anilist',
          providerId: routeId.providerId,
          kind,
        }], 'resolve')
        if (!identity) throw new CatalogIdentityGatewayError('CATALOG_IDENTITY_UNAVAILABLE')
        return { status: 'resolved', source: 'legacy', ...identity }
      } catch (error) {
        const safeError = toGatewayError(error)
        return {
          status: safeError.code === 'CATALOG_IDENTITY_MISSING'
            ? 'not-found'
            : 'unavailable',
          source: routeId.source,
          publicId: null,
          kind,
        }
      }
    },
  }
}

/** Creates production gateway with current server-only configuration. */
const createProductionGateway = (): CatalogIdentityGateway => createCatalogIdentityGateway({
  client: createConvexIdentityClient(requireServerEnv('VITE_CONVEX_URL')),
  token: requireServerEnv('DISCOVER_CACHE_WRITE_TOKEN'),
})

/** Materializes public identities for one bounded provider batch. */
export const ensurePublicIds = async (
  refs: readonly CatalogProviderRef[],
): Promise<CatalogPublicIdentity[]> => await createProductionGateway().ensurePublicIds(refs)

/** Resolves existing public identities for one bounded provider batch. */
export const resolvePublicIds = async (
  refs: readonly CatalogProviderRef[],
): Promise<CatalogPublicIdentity[]> => await createProductionGateway().resolvePublicIds(refs)

/** Reverse-resolves one public ID for server metadata use. */
export const resolveProviderByPublicId = async (
  input: { publicId: CatalogPublicId; kind: CatalogEntityKind },
): Promise<CatalogProviderRef> => await createProductionGateway().resolveProviderByPublicId(input)

/** Resolves canonical or legacy route IDs to a browser-safe identity state. */
export const resolveRouteIdentity = async (
  input: { rawId: string; kind: CatalogEntityKind },
): Promise<CatalogRouteIdentity> => await createProductionGateway().resolveRouteIdentity(input)
