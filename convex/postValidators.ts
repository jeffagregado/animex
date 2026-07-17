import { v } from 'convex/values'

/** Validates supported Post image and video attachments. */
export const postMediaValidator = v.union(
  v.object({
    type: v.literal('image'),
    url: v.string(),
    description: v.union(v.string(), v.null()),
  }),
  v.object({
    type: v.literal('video'),
    url: v.string(),
    provider: v.union(
      v.literal('youtube'),
      v.literal('vimeo'),
      v.literal('external'),
    ),
    label: v.union(v.string(), v.null()),
  }),
)
