import { paginationOptsValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import {
  internalMutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from './_generated/server'
import { requireProfile, upsertUserSearchDocument } from './users'

const SEARCH_PAGE_SIZE = 20
const SEARCH_PREVIEW_SIZE = 5

const identityValidator = v.object({
  id: v.id('users'),
  username: v.string(),
  name: v.string(),
  avatarUrl: v.union(v.string(), v.null()),
})

const migrationResultValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  processedCount: v.number(),
  visibilityPatchedCount: v.number(),
  searchUpsertedCount: v.number(),
})

const verificationResultValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  processedCount: v.number(),
  missingVisibilityIds: v.array(v.id('users')),
  missingSearchIds: v.array(v.id('users')),
  duplicateSearchUserIds: v.array(v.id('users')),
  mismatchedSearchUserIds: v.array(v.id('users')),
})

const normalizeQuery = (query: string): string => {
  const normalized = query.trim().replace(/\s+/g, ' ').toLowerCase()
  if (normalized.length < 2 || normalized.length > 100) {
    throw new ConvexError({
      code: 'INVALID_SEARCH_QUERY',
      message: 'Search query must be 2-100 characters.',
    })
  }
  return normalized
}

const expectedSearchText = (user: Doc<'users'>): string => (
  `${user.name} ${user.username}`.trim().replace(/\s+/g, ' ').toLowerCase()
)

const hydrateIdentity = async (
  ctx: QueryCtx,
  userId: Id<'users'>,
) => {
  const user = await ctx.db.get('users', userId)
  if (!user) return null
  return {
    id: user._id,
    username: user.username,
    name: user.name,
    avatarUrl: user.avatarStorageId
      ? await ctx.storage.getUrl(user.avatarStorageId)
      : null,
  }
}

const hydrateDocuments = async (
  ctx: QueryCtx,
  documents: Doc<'userSearchDocuments'>[],
) => {
  const identities = await Promise.all(
    documents.map(async (document) => await hydrateIdentity(ctx, document.userId)),
  )
  return identities.filter((identity) => identity !== null)
}

export const searchPreview = query({
  args: { query: v.string() },
  returns: v.array(identityValidator),
  handler: async (ctx, args) => {
    await requireProfile(ctx)
    const queryText = normalizeQuery(args.query)
    const documents = await ctx.db
      .query('userSearchDocuments')
      .withSearchIndex('search_users', (q) => q.search('searchText', queryText))
      .take(SEARCH_PREVIEW_SIZE)
    return await hydrateDocuments(ctx, documents)
  },
})

export const search = query({
  args: {
    query: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(identityValidator),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireProfile(ctx)
    if (args.paginationOpts.numItems !== SEARCH_PAGE_SIZE) {
      throw new ConvexError({
        code: 'INVALID_PAGE_SIZE',
        message: `User search requires ${SEARCH_PAGE_SIZE} results per page.`,
      })
    }
    const queryText = normalizeQuery(args.query)
    const result = await ctx.db
      .query('userSearchDocuments')
      .withSearchIndex('search_users', (q) => q.search('searchText', queryText))
      .paginate(args.paginationOpts)
    return {
      page: await hydrateDocuments(ctx, result.page),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    }
  },
})

export const backfillProfiles = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: migrationResultValidator,
  handler: async (ctx, args) => {
    const result = await ctx.db.query('users').paginate(args.paginationOpts)
    let visibilityPatchedCount = 0
    for (const user of result.page) {
      let currentUser = user
      if (!user.profileVisibility) {
        await ctx.db.patch('users', user._id, { profileVisibility: 'public' })
        const persisted = await ctx.db.get('users', user._id)
        if (!persisted) {
          throw new ConvexError({
            code: 'PROFILE_MIGRATION_FAILED',
            message: 'Profile disappeared during search backfill.',
          })
        }
        currentUser = persisted
        visibilityPatchedCount += 1
      }
      await upsertUserSearchDocument(ctx, currentUser)
    }
    return {
      continueCursor: result.continueCursor,
      isDone: result.isDone,
      processedCount: result.page.length,
      visibilityPatchedCount,
      searchUpsertedCount: result.page.length,
    }
  },
})

const verifyProfile = async (
  ctx: MutationCtx,
  user: Doc<'users'>,
  result: {
    missingVisibilityIds: Id<'users'>[]
    missingSearchIds: Id<'users'>[]
    duplicateSearchUserIds: Id<'users'>[]
    mismatchedSearchUserIds: Id<'users'>[]
  },
): Promise<void> => {
  if (!user.profileVisibility) result.missingVisibilityIds.push(user._id)
  const rows = await ctx.db
    .query('userSearchDocuments')
    .withIndex('by_user', (q) => q.eq('userId', user._id))
    .take(2)
  if (rows.length === 0) {
    result.missingSearchIds.push(user._id)
    return
  }
  if (rows.length > 1) {
    result.duplicateSearchUserIds.push(user._id)
    return
  }
  if (rows[0]!.searchText !== expectedSearchText(user)) {
    result.mismatchedSearchUserIds.push(user._id)
  }
}

export const verifyProfiles = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: verificationResultValidator,
  handler: async (ctx, args) => {
    const page = await ctx.db.query('users').paginate(args.paginationOpts)
    const result = {
      missingVisibilityIds: [] as Id<'users'>[],
      missingSearchIds: [] as Id<'users'>[],
      duplicateSearchUserIds: [] as Id<'users'>[],
      mismatchedSearchUserIds: [] as Id<'users'>[],
    }
    for (const user of page.page) await verifyProfile(ctx, user, result)
    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      processedCount: page.page.length,
      ...result,
    }
  },
})
