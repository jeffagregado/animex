import { ConvexError, v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import { query, type QueryCtx } from './_generated/server'
import { requireProfile, toUsernameKey } from './users'

const profileVisibilityValidator = v.union(v.literal('public'), v.literal('private'))
const animeValidator = v.object({
  anilistId: v.number(),
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

const fail = (code: string, message: string): never => {
  throw new ConvexError({ code, message })
}

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

const toAnime = (anime: Doc<'animeSummaries'>) => ({
  anilistId: anime.anilistId,
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
    const anime = await ctx.db
      .query('animeSummaries')
      .withIndex('by_anilist_id', (q) => q.eq('anilistId', entry.anilistId))
      .unique()
    if (!anime) return fail('PROFILE_ANIME_MISSING', 'Favorite Anime summary is missing.')
    return toAnime(anime)
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
