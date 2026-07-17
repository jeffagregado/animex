import { z } from 'zod'

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
