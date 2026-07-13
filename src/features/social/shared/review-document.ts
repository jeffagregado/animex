import { z } from 'zod'

export const REVIEW_DOCUMENT_MAX_VISIBLE_TEXT = 2_500 as const
export const REVIEW_SUMMARY_LIMIT = 280 as const
export const REVIEW_DOCUMENT_MAX_MEDIA = 4 as const
export const REVIEW_DOCUMENT_MAX_DEPTH = 8 as const
export const REVIEW_DOCUMENT_MAX_NODES = 400 as const
export const REVIEW_DOCUMENT_MAX_BYTES = 64 * 1024
export const REVIEW_DOCUMENT_MAX_URL_LENGTH = 2_048 as const

type TextNode = {
  detail: 0
  format: number
  mode: 'normal'
  style: ''
  text: string
  type: 'text'
  version: 1
}

type LineBreakNode = { type: 'linebreak'; version: 1 }

type ElementFields = {
  children: ReviewNode[]
  direction: 'ltr' | 'rtl' | null
  format: ''
  indent: 0
  version: 1
}

type ParagraphNode = ElementFields & {
  textFormat: number
  textStyle: ''
  type: 'paragraph'
}

type HeadingNode = ElementFields & { tag: 'h2' | 'h3'; type: 'heading' }
type QuoteNode = ElementFields & { type: 'quote' }
type ListNode = ElementFields & { listType: 'number' | 'bullet'; start: number; tag: 'ol' | 'ul'; type: 'list' }
type ListItemNode = ElementFields & { checked?: never; type: 'listitem'; value: number }
type SpoilerNode = ElementFields & { type: 'spoiler' }
type ImageNode = { alt: string; type: 'review-image'; url: string; version: 1 }
type VideoNode = { label?: string; provider: VideoProvider; type: 'review-video'; url: string; version: 1 }
type ReviewNode = TextNode | LineBreakNode | ParagraphNode | HeadingNode | QuoteNode | ListNode | ListItemNode | SpoilerNode | ImageNode | VideoNode

export type VideoProvider = 'youtube' | 'vimeo' | 'external'

export interface ReviewDocumentV1 {
  version: 1
  editorState: {
    root: ElementFields & { type: 'root' }
  }
}

export interface ReviewStats {
  count: number
  average: number | null
  bands: [number, number, number, number, number, number, number, number, number, number]
}

const textFormatSchema = z.number().int().min(0).max(15)
const directionSchema = z.enum(['ltr', 'rtl']).nullable()
const elementFormatSchema = z.literal('')
const indentSchema = z.literal(0)

const textNodeSchema: z.ZodType<TextNode> = z.object({
  detail: z.literal(0),
  format: textFormatSchema,
  mode: z.literal('normal'),
  style: z.literal(''),
  text: z.string(),
  type: z.literal('text'),
  version: z.literal(1),
}).strict()

const lineBreakNodeSchema: z.ZodType<LineBreakNode> = z.object({
  type: z.literal('linebreak'),
  version: z.literal(1),
}).strict()

/** Validates HTTPS media links without credentials. */
const parseSafeHttpsUrl = (value: string): URL => {
  if (value.length > REVIEW_DOCUMENT_MAX_URL_LENGTH) {
    throw new RangeError(`Media URL must not exceed ${REVIEW_DOCUMENT_MAX_URL_LENGTH} characters.`)
  }

  let url: URL
  try {
    url = new URL(value)
  } catch (error) {
    throw new TypeError('Media URL must be a valid HTTPS URL.', { cause: error })
  }

  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') {
    throw new TypeError('Media URL must use HTTPS without credentials.')
  }
  return url
}

/** Derives supported video provider from normalized hostname. */
export const getVideoProvider = (value: string): VideoProvider => {
  const hostname = parseSafeHttpsUrl(value).hostname.toLowerCase()
  if (hostname === 'youtu.be' || hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) return 'youtube'
  if (hostname === 'vimeo.com' || hostname.endsWith('.vimeo.com')) return 'vimeo'
  return 'external'
}

const safeHttpsUrlSchema = z.string().superRefine((value, context) => {
  try {
    parseSafeHttpsUrl(value)
  } catch (error) {
    context.addIssue({ code: 'custom', message: error instanceof Error ? error.message : 'Invalid media URL.' })
  }
})

const imageNodeSchema: z.ZodType<ImageNode> = z.object({
  alt: z.string().trim().min(1),
  type: z.literal('review-image'),
  url: safeHttpsUrlSchema,
  version: z.literal(1),
}).strict()

const videoNodeSchema: z.ZodType<VideoNode> = z.object({
  label: z.string().trim().min(1).optional(),
  provider: z.enum(['youtube', 'vimeo', 'external']),
  type: z.literal('review-video'),
  url: safeHttpsUrlSchema,
  version: z.literal(1),
}).strict().superRefine((node, context) => {
  if (safeHttpsUrlSchema.safeParse(node.url).success && node.provider !== getVideoProvider(node.url)) {
    context.addIssue({ code: 'custom', message: 'Video provider must match its URL.', path: ['provider'] })
  }
})

const elementFields = {
  direction: directionSchema,
  format: elementFormatSchema,
  indent: indentSchema,
  version: z.literal(1),
}

const inlineNodeSchema: z.ZodType<ReviewNode> = z.lazy(() => z.union([textNodeSchema, lineBreakNodeSchema]))
const listItemChildSchema: z.ZodType<ReviewNode> = z.lazy(() => z.union([textNodeSchema, lineBreakNodeSchema, listNodeSchema]))

const paragraphNodeSchema: z.ZodType<ParagraphNode> = z.object({
  children: z.array(inlineNodeSchema),
  ...elementFields,
  textFormat: textFormatSchema,
  textStyle: z.literal(''),
  type: z.literal('paragraph'),
}).strict()

const headingNodeSchema: z.ZodType<HeadingNode> = z.object({
  children: z.array(inlineNodeSchema),
  ...elementFields,
  tag: z.enum(['h2', 'h3']),
  type: z.literal('heading'),
}).strict()

const quoteNodeSchema: z.ZodType<QuoteNode> = z.object({
  children: z.array(inlineNodeSchema),
  ...elementFields,
  type: z.literal('quote'),
}).strict()

const listItemNodeSchema: z.ZodType<ListItemNode> = z.object({
  children: z.array(listItemChildSchema),
  ...elementFields,
  type: z.literal('listitem'),
  value: z.number().int().positive(),
}).strict()

const listNodeSchema: z.ZodType<ListNode> = z.object({
  children: z.array(listItemNodeSchema),
  ...elementFields,
  listType: z.enum(['number', 'bullet']),
  start: z.number().int().positive(),
  tag: z.enum(['ol', 'ul']),
  type: z.literal('list'),
}).strict().superRefine((node, context) => {
  const expectedTag = node.listType === 'number' ? 'ol' : 'ul'
  if (node.tag !== expectedTag) context.addIssue({ code: 'custom', message: 'List tag must match list type.', path: ['tag'] })
})

const blockNodeWithoutSpoilerSchema: z.ZodType<ReviewNode> = z.lazy(() => z.union([
  paragraphNodeSchema,
  headingNodeSchema,
  quoteNodeSchema,
  listNodeSchema,
  imageNodeSchema,
  videoNodeSchema,
]))

const spoilerNodeSchema: z.ZodType<SpoilerNode> = z.object({
  children: z.array(blockNodeWithoutSpoilerSchema).min(1),
  ...elementFields,
  type: z.literal('spoiler'),
}).strict()

const topLevelNodeSchema = z.union([
  paragraphNodeSchema,
  headingNodeSchema,
  quoteNodeSchema,
  listNodeSchema,
  spoilerNodeSchema,
  imageNodeSchema,
  videoNodeSchema,
])

const rootNodeSchema = z.object({
  children: z.array(topLevelNodeSchema),
  ...elementFields,
  type: z.literal('root'),
}).strict()

const baseReviewDocumentSchema: z.ZodType<ReviewDocumentV1> = z.object({
  editorState: z.object({ root: rootNodeSchema }).strict(),
  version: z.literal(1),
}).strict()

type DocumentMetrics = { depth: number; media: number; nodes: number; realText: string; visibleText: number }

/** Measures validated review structure without rendering HTML. */
const measureNode = (node: ReviewNode, depth: number): DocumentMetrics => {
  const base = { depth, media: 0, nodes: 1, realText: '', visibleText: 0 }
  if (node.type === 'text') return { ...base, realText: node.text, visibleText: node.text.length }
  if (node.type === 'review-image') return { ...base, media: 1, visibleText: node.alt.length }
  if (node.type === 'review-video') return { ...base, media: 1, visibleText: node.label?.length ?? 0 }
  if (node.type === 'linebreak') return base

  return node.children.reduce<DocumentMetrics>((metrics, child) => {
    const childMetrics = measureNode(child, depth + 1)
    return {
      depth: Math.max(metrics.depth, childMetrics.depth),
      media: metrics.media + childMetrics.media,
      nodes: metrics.nodes + childMetrics.nodes,
      realText: metrics.realText + childMetrics.realText,
      visibleText: metrics.visibleText + childMetrics.visibleText,
    }
  }, base)
}

/** Measures one validated document including its root node. */
const measureDocument = (documentValue: ReviewDocumentV1): DocumentMetrics => documentValue.editorState.root.children.reduce<DocumentMetrics>(
  (metrics, node) => {
    const childMetrics = measureNode(node, 2)
    return {
      depth: Math.max(metrics.depth, childMetrics.depth),
      media: metrics.media + childMetrics.media,
      nodes: metrics.nodes + childMetrics.nodes,
      realText: metrics.realText + childMetrics.realText,
      visibleText: metrics.visibleText + childMetrics.visibleText,
    }
  },
  { depth: 1, media: 0, nodes: 1, realText: '', visibleText: 0 },
)

export const reviewDocumentSchema: z.ZodType<ReviewDocumentV1> = baseReviewDocumentSchema.superRefine((documentValue, context) => {
  const metrics = measureDocument(documentValue)
  if (metrics.depth > REVIEW_DOCUMENT_MAX_DEPTH) context.addIssue({ code: 'custom', message: `Review body must not exceed depth ${REVIEW_DOCUMENT_MAX_DEPTH}.` })
  if (metrics.nodes > REVIEW_DOCUMENT_MAX_NODES) context.addIssue({ code: 'custom', message: `Review body must not exceed ${REVIEW_DOCUMENT_MAX_NODES} nodes.` })
  if (metrics.media > REVIEW_DOCUMENT_MAX_MEDIA) context.addIssue({ code: 'custom', message: `Review body must not exceed ${REVIEW_DOCUMENT_MAX_MEDIA} media nodes.` })
  if (metrics.visibleText > REVIEW_DOCUMENT_MAX_VISIBLE_TEXT) context.addIssue({ code: 'custom', message: `Review body must not exceed ${REVIEW_DOCUMENT_MAX_VISIBLE_TEXT} visible characters.` })
  if (new TextEncoder().encode(JSON.stringify(documentValue)).byteLength > REVIEW_DOCUMENT_MAX_BYTES) context.addIssue({ code: 'custom', message: `Review body must not exceed ${REVIEW_DOCUMENT_MAX_BYTES} UTF-8 bytes.` })
})

/** Parses untrusted review JSON against structure and security bounds. */
export const parseReviewDocument = (value: unknown): ReviewDocumentV1 => reviewDocumentSchema.parse(value)

const parseReviewRating = (value: unknown): number | null => z.number().min(0).max(100).multipleOf(0.1).nullable().parse(value)
const parseReviewSummary = (value: unknown): string => z.string().trim().max(REVIEW_SUMMARY_LIMIT).parse(value)
const ignoredPublishTextSchema = /[\p{White_Space}\p{Default_Ignorable_Code_Point}\p{Cc}]/gu

/** Detects at least one visible, user-meaningful Unicode character. */
const hasRealText = (value: string): boolean => value.replace(ignoredPublishTextSchema, '').length > 0

/** Validates draft fields while allowing incomplete content. */
export const validateDraftReview = (body: unknown, rating: unknown, summary: unknown): { body: ReviewDocumentV1; rating: number | null; summary: string } => ({
  body: parseReviewDocument(body),
  rating: parseReviewRating(rating),
  summary: parseReviewSummary(summary),
})

/** Applies publish-only body, rating, and summary requirements. */
export const validatePublishedReview = (body: unknown, rating: unknown, summary: unknown): { body: ReviewDocumentV1; rating: number; summary: string; visibleTextLength: number } => {
  const draft = validateDraftReview(body, rating, summary)
  const metrics = measureDocument(draft.body)
  if (!hasRealText(metrics.realText)) throw new RangeError('Published Review requires real body text.')
  if (draft.rating === null) throw new RangeError('Published Review requires a Rating.')
  if (draft.summary.length === 0) throw new RangeError('Published Review requires a Summary.')
  return { ...draft, rating: draft.rating, visibleTextLength: metrics.visibleText }
}

/** Builds ten descending rating bands and one-decimal average. */
export const createReviewStats = (ratings: readonly number[]): ReviewStats => {
  const bands: ReviewStats['bands'] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  let total = 0
  for (const rating of ratings) {
    const parsedRating = parseReviewRating(rating)
    if (parsedRating === null) throw new TypeError('Published Review Rating cannot be null.')
    const bandIndex = parsedRating >= 90 ? 0 : 9 - Math.floor(parsedRating / 10)
    bands[bandIndex] += 1
    total += parsedRating
  }
  return { count: ratings.length, average: ratings.length === 0 ? null : Math.round((total / ratings.length) * 10) / 10, bands }
}
