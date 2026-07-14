import { z } from 'zod'

export const EXTERNAL_MEDIA_URL_MAX_LENGTH = 2_048 as const

export const videoProviderSchema = z.enum(['youtube', 'vimeo', 'external'])

export type VideoProvider = z.infer<typeof videoProviderSchema>

/** Parses an external media URL under shared security limits. */
export const parseExternalMediaUrl = (value: string): URL => {
  if (value.length > EXTERNAL_MEDIA_URL_MAX_LENGTH) {
    throw new RangeError(`Media URL must not exceed ${EXTERNAL_MEDIA_URL_MAX_LENGTH} characters.`)
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new TypeError('Media URL must be a valid HTTPS URL.')
  }

  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') {
    throw new TypeError('Media URL must use HTTPS without credentials.')
  }
  return url
}

/** Detects supported video hosts without fetching remote metadata. */
export const getVideoProvider = (value: string): VideoProvider => {
  const hostname = parseExternalMediaUrl(value).hostname.toLowerCase()
  if (hostname === 'youtu.be' || hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) return 'youtube'
  if (hostname === 'vimeo.com' || hostname.endsWith('.vimeo.com')) return 'vimeo'
  return 'external'
}

/** Builds linked-video copy from validated explicit or host metadata. */
export const getLinkedVideoLabel = (value: string, provider: VideoProvider, label: string | null): string => {
  const explicitLabel = label?.trim()
  if (explicitLabel) return explicitLabel
  const parsedUrl = parseExternalMediaUrl(value)
  return `Open ${provider === 'external' ? parsedUrl.hostname.toLowerCase() : provider} video`
}

export const externalMediaUrlSchema = z.string().superRefine((value, context) => {
  try {
    parseExternalMediaUrl(value)
  } catch (error) {
    context.addIssue({ code: 'custom', message: error instanceof Error ? error.message : 'Invalid media URL.' })
  }
})

const nullableMediaCopySchema = z.string().trim().nullable()

const postImageMediaSchema = z.object({
  description: nullableMediaCopySchema,
  type: z.literal('image'),
  url: externalMediaUrlSchema,
}).strict()

const postVideoMediaSchema = z.object({
  label: nullableMediaCopySchema,
  provider: videoProviderSchema,
  type: z.literal('video'),
  url: externalMediaUrlSchema,
}).strict().superRefine((media, context) => {
  if (externalMediaUrlSchema.safeParse(media.url).success && media.provider !== getVideoProvider(media.url)) {
    context.addIssue({ code: 'custom', message: 'Video provider must match its URL.', path: ['provider'] })
  }
})

export const postMediaSchema = z.discriminatedUnion('type', [
  postImageMediaSchema,
  postVideoMediaSchema,
])

export type PostMedia = z.infer<typeof postMediaSchema>
