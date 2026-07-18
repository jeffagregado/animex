import { z } from 'zod'

import { feedPageSchema, reviewListItemSchema } from '../../social/shared/social-contracts'

export const PROFILE_BIO_MAX_LENGTH = 300 as const
export const PROFILE_NAME_MAX_LENGTH = 50 as const
export const PROFILE_CONTENT_PAGE_SIZE = 20 as const
export const PROFILE_FAVORITES_PREVIEW_SIZE = 10 as const
export const PROFILE_MEDIA_SOURCE_MAX_BYTES = 10 * 1024 * 1024
export const PROFILE_MEDIA_OUTPUT_MAX_BYTES = 2 * 1024 * 1024
export const PROFILE_MEDIA_PENDING_TTL_MS = 60 * 60 * 1000

const profileVisibilitySchema = z.enum(['public', 'private'])
export const profileTabSchema = z.enum(['activity', 'reviews', 'favorites'])
const profileMediaKindSchema = z.enum(['avatar', 'banner'])

export type ProfileVisibility = z.infer<typeof profileVisibilitySchema>
export type ProfileTab = z.infer<typeof profileTabSchema>
export type ProfileMediaKind = z.infer<typeof profileMediaKindSchema>

const nullableHttpsUrlSchema = z.url({ protocol: /^https$/ }).nullable()
export const profileHeaderSchema = z.object({
  avatarUrl: nullableHttpsUrlSchema,
  bannerUrl: nullableHttpsUrlSchema,
  bio: z.string().max(PROFILE_BIO_MAX_LENGTH),
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).max(PROFILE_NAME_MAX_LENGTH),
  profileVisibility: profileVisibilitySchema,
  username: z.string().trim().min(1),
}).strict()
const profileFavoriteAnimeSchema = z.object({
  anilistId: z.number().int().positive(),
  coverImageUrl: nullableHttpsUrlSchema,
  slug: z.string().trim().min(1),
  title: z.string().trim().min(1),
}).strict()
const fullProfileSchema = profileHeaderSchema.extend({
  favorites: z.array(profileFavoriteAnimeSchema).max(PROFILE_FAVORITES_PREVIEW_SIZE),
  progress: z.object({
    completed: z.number().int().nonnegative(),
    dropped: z.number().int().nonnegative(),
    planned: z.number().int().nonnegative(),
    watching: z.number().int().nonnegative(),
  }).strict(),
}).strict()
export const profileResultSchema = z.discriminatedUnion('access', [
  z.object({
    access: z.literal('header'),
    owner: z.boolean(),
    profile: profileHeaderSchema,
  }).strict(),
  z.object({
    access: z.literal('full'),
    owner: z.boolean(),
    profile: fullProfileSchema,
  }).strict(),
])
const cursorPageFields = {
  cursor: z.string().nullable(),
  hasMore: z.boolean(),
}
export const profileFavoriteSchema = z.object({
  anime: profileFavoriteAnimeSchema,
  favoriteAt: z.number().finite().nonnegative(),
}).strict()
export const profileActivityPageSchema = feedPageSchema
export const profileReviewPageSchema = z.object({
  ...cursorPageFields,
  items: z.array(reviewListItemSchema).max(PROFILE_CONTENT_PAGE_SIZE),
}).strict()
export const profileFavoritePageSchema = z.object({
  ...cursorPageFields,
  items: z.array(profileFavoriteSchema).max(PROFILE_CONTENT_PAGE_SIZE),
}).strict()
export const profileContentPageSchema = z.union([
  profileActivityPageSchema,
  profileReviewPageSchema,
  profileFavoritePageSchema,
])

export type ProfileHeaderData = z.infer<typeof profileHeaderSchema>
export type ProfileResult = z.infer<typeof profileResultSchema>
export type ProfileActivityPage = z.infer<typeof profileActivityPageSchema>
export type ProfileReviewPage = z.infer<typeof profileReviewPageSchema>
export type ProfileFavoritePage = z.infer<typeof profileFavoritePageSchema>
export type ProfileFavorite = z.infer<typeof profileFavoriteSchema>
export type ProfileContentPage =
  | ProfileActivityPage
  | ProfileReviewPage
  | ProfileFavoritePage

export function parseProfileContentPage(
  tab: 'activity',
  value: unknown,
): ProfileActivityPage
export function parseProfileContentPage(
  tab: 'reviews',
  value: unknown,
): ProfileReviewPage
export function parseProfileContentPage(
  tab: 'favorites',
  value: unknown,
): ProfileFavoritePage
export function parseProfileContentPage(
  tab: ProfileTab,
  value: unknown,
): ProfileContentPage
/** Parses one Profile content page against its requested lane. */
export function parseProfileContentPage(
  tab: ProfileTab,
  value: unknown,
): ProfileContentPage {
  if (tab === 'activity') return profileActivityPageSchema.parse(value)
  if (tab === 'reviews') return profileReviewPageSchema.parse(value)
  return profileFavoritePageSchema.parse(value)
}

export const profileEditInputSchema = z.object({
  name: z.string().trim().min(1).max(PROFILE_NAME_MAX_LENGTH),
  bio: z.string().trim().max(PROFILE_BIO_MAX_LENGTH).nullable(),
  profileVisibility: profileVisibilitySchema,
}).strict()

export interface NormalizedProfileEdit {
  name: string
  bio: string | null
  profileVisibility: ProfileVisibility
}

const profileMediaSourceSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size: z.number().int().positive().max(PROFILE_MEDIA_SOURCE_MAX_BYTES),
}).strict()

export type ProfileMediaSource = z.infer<typeof profileMediaSourceSchema>

/** Parses Profile tab URL state. */
export const parseProfileTab = (value: unknown): ProfileTab => {
  if (value === undefined) return 'activity'

  const result = profileTabSchema.safeParse(value)
  if (!result.success) {
    throw new TypeError('PROFILE_TAB_INVALID', { cause: result.error })
  }

  return result.data
}

/** Normalizes owner-editable Profile fields. */
export const normalizeProfileEdit = (value: unknown): NormalizedProfileEdit => {
  const result = profileEditInputSchema.safeParse(value)
  if (!result.success) {
    throw new TypeError('PROFILE_EDIT_INVALID', { cause: result.error })
  }

  return {
    name: result.data.name,
    bio: result.data.bio === null || result.data.bio.length === 0
      ? null
      : result.data.bio,
    profileVisibility: result.data.profileVisibility,
  }
}

/** Validates source metadata before client-side cropping. */
export const parseProfileMediaSource = (value: unknown): ProfileMediaSource => {
  const result = profileMediaSourceSchema.safeParse(value)
  if (!result.success) {
    throw new TypeError('PROFILE_MEDIA_INVALID', { cause: result.error })
  }

  return result.data
}
