import { ConvexError, v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import {
  requireProfile,
  toUsernameKey,
  upsertUserSearchDocument,
} from './users'
import { resolveProviderByCatalogPublicId } from './catalogIdentityModel'

const PROFILE_BIO_MAX_LENGTH = 300
const PROFILE_NAME_MAX_LENGTH = 50
const profileVisibilityValidator = v.union(v.literal('public'), v.literal('private'))
const animeValidator = v.object({
  publicId: v.id('catalogEntities'),
  slug: v.string(),
  title: v.string(),
  coverImageUrl: v.union(v.string(), v.null()),
})
const profileFields = {
  id: v.string(),
  username: v.string(),
  name: v.string(),
  bio: v.string(),
  avatarUrl: v.union(v.string(), v.null()),
  bannerUrl: v.union(v.string(), v.null()),
  profileVisibility: profileVisibilityValidator,
}
const headerProfileValidator = v.object(profileFields)
const fullProfileValidator = v.object({
  ...profileFields,
  progress: v.object({
    watching: v.number(),
    completed: v.number(),
    planned: v.number(),
    dropped: v.number(),
  }),
  favorites: v.array(animeValidator),
})
const profileResultValidator = v.union(
  v.object({
    access: v.literal('header'),
    owner: v.boolean(),
    profile: headerProfileValidator,
  }),
  v.object({
    access: v.literal('full'),
    owner: v.boolean(),
    profile: fullProfileValidator,
  }),
)

export type ProfileAccess = 'header' | 'full'
export type ProfileAccessResolution = {
  access: ProfileAccess
  owner: boolean
  targetId: Id<'users'>
  viewerId: Id<'users'>
  usernameKey: string
}

type EditableProfileField = 'name' | 'bio' | 'profileVisibility'
type ProfileEditFieldErrors = Partial<Record<EditableProfileField, string>>

interface ProfileEditInput {
  name: string
  bio: string
  profileVisibility: string
}

interface NormalizedProfileEdit {
  name: string
  bio: string | undefined
  profileVisibility: 'public' | 'private'
}

const fail = (code: string, message: string): never => {
  throw new ConvexError({ code, message })
}

/** Validates and normalizes owner-editable Profile fields. */
const normalizeProfileEdit = (input: ProfileEditInput): NormalizedProfileEdit => {
  const name = input.name.trim()
  const bio = input.bio.trim()
  const fieldErrors: ProfileEditFieldErrors = {}

  if (name.length === 0) {
    fieldErrors.name = 'Display name is required.'
  } else if (name.length > PROFILE_NAME_MAX_LENGTH) {
    fieldErrors.name = 'Display name must be 50 characters or fewer.'
  }
  if (bio.length > PROFILE_BIO_MAX_LENGTH) {
    fieldErrors.bio = 'Bio must be 300 characters or fewer.'
  }
  if (input.profileVisibility !== 'public' && input.profileVisibility !== 'private') {
    fieldErrors.profileVisibility = 'Choose Public or Private Profile Visibility.'
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw new ConvexError({
      code: 'PROFILE_EDIT_INVALID',
      message: 'Review the highlighted Profile fields.',
      fieldErrors,
    })
  }

  return {
    name,
    bio: bio.length === 0 ? undefined : bio,
    profileVisibility: input.profileVisibility as 'public' | 'private',
  }
}

/** Applies editable Profile fields and refreshes its search projection atomically. */
const updateProfile = async (
  ctx: MutationCtx,
  input: ProfileEditInput,
): Promise<null> => {
  const { profile } = await requireProfile(ctx)
  const next = normalizeProfileEdit(input)
  const patch: Partial<Pick<
    Doc<'users'>,
    'bio' | 'name' | 'profileVisibility' | 'updatedAt'
  >> = {
    updatedAt: Date.now(),
  }

  if (profile.name !== next.name) patch.name = next.name
  if (profile.bio !== next.bio) patch.bio = next.bio
  if (profile.profileVisibility !== next.profileVisibility) {
    patch.profileVisibility = next.profileVisibility
  }

  await ctx.db.patch('users', profile._id, patch)
  const persisted = await ctx.db.get('users', profile._id)
  if (!persisted) {
    return fail('PROFILE_WRITE_FAILED', 'Updated Profile could not be read for search indexing.')
  }
  await upsertUserSearchDocument(ctx, persisted)
  return null
}

export const update = mutation({
  args: {
    name: v.string(),
    bio: v.string(),
    profileVisibility: v.string(),
  },
  returns: v.null(),
  handler: updateProfile,
})

/** Resolves one normalized username and the authenticated viewer's access. */
export const resolveProfileAccess = async (
  ctx: QueryCtx,
  username: string,
): Promise<ProfileAccessResolution> => {
  const { profile: viewer } = await requireProfile(ctx)
  const usernameKey = toUsernameKey(username)
  const target = await ctx.db
    .query('users')
    .withIndex('by_username_key', (q) => q.eq('usernameKey', usernameKey))
    .unique()
  if (!target) return fail('PROFILE_NOT_FOUND', 'Profile not found.')
  if (target.profileVisibility !== 'public' && target.profileVisibility !== 'private') {
    return fail('PROFILE_VISIBILITY_CORRUPT', 'Profile Visibility is missing or invalid.')
  }
  const owner = viewer._id === target._id
  return {
    access: target.profileVisibility === 'private' && !owner ? 'header' : 'full',
    owner,
    targetId: target._id,
    viewerId: viewer._id,
    usernameKey,
  }
}

const toAnime = (anime: Doc<'animeSummaries'>, publicId: Id<'catalogEntities'>) => ({
  publicId,
  slug: anime.slug,
  title: anime.titles.display,
  coverImageUrl: anime.coverImageUrl,
})

const getProfileHeader = async (ctx: QueryCtx, profile: Doc<'users'>) => ({
  id: profile._id,
  username: profile.username,
  name: profile.name,
  bio: profile.bio ?? '',
  avatarUrl: profile.avatarStorageId ? await ctx.storage.getUrl(profile.avatarStorageId) : null,
  bannerUrl: profile.bannerStorageId ? await ctx.storage.getUrl(profile.bannerStorageId) : null,
  profileVisibility: profile.profileVisibility,
})

const getFavoritePreview = async (
  ctx: QueryCtx,
  userId: Id<'users'>,
) => {
  const entries = await ctx.db
    .query('userAnimeEntries')
    .withIndex('by_user_favorite_at', (q) => q.eq('userId', userId).gt('favoriteAt', null))
    .order('desc')
    .take(10)
  return await Promise.all(entries.map(async (entry) => {
    if (!entry.animeId) {
      return fail('CATALOG_PROVIDER_REF_MISSING', 'Favorite Anime entity is missing.')
    }
    const providerRef = await resolveProviderByCatalogPublicId(ctx, entry.animeId, 'anime')
    if (providerRef.providerId !== entry.anilistId) {
      return fail('CATALOG_PROVIDER_REF_CONFLICT', 'Favorite Anime entity conflicts with its provider reference.')
    }
    const anime = await ctx.db
      .query('animeSummaries')
      .withIndex('by_anilist_id', (q) => q.eq('anilistId', providerRef.providerId))
      .unique()
    if (!anime) return fail('PROFILE_ANIME_MISSING', 'Favorite Anime summary is missing.')
    return toAnime(anime, entry.animeId)
  }))
}

export const getByUsername = query({
  args: { username: v.string() },
  returns: profileResultValidator,
  handler: async (ctx, args) => {
    const access = await resolveProfileAccess(ctx, args.username)
    const profile = await ctx.db.get('users', access.targetId)
    if (!profile) return fail('PROFILE_NOT_FOUND', 'Profile not found.')
    const header = await getProfileHeader(ctx, profile)
    if (access.access === 'header') {
      return { access: 'header' as const, owner: access.owner, profile: header }
    }
    const [progress, favorites] = await Promise.all([
      ctx.db.query('userAnimeProgress').withIndex('by_user', (q) => q.eq('userId', access.targetId)).unique(),
      getFavoritePreview(ctx, access.targetId),
    ])
    return {
      access: 'full' as const,
      owner: access.owner,
      profile: {
        ...header,
        progress: progress
          ? {
              watching: progress.watching,
              completed: progress.completed,
              planned: progress.planned,
              dropped: progress.dropped,
            }
          : { watching: 0, completed: 0, planned: 0, dropped: 0 },
        favorites,
      },
    }
  },
})
