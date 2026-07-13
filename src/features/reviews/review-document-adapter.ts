import { parseReviewDocument, type ReviewDocumentV1 } from '#/features/social/shared/review-document'
import { reviewDetailSchema, type ReviewDetail } from '#/features/social/shared/social-contracts'

type SerializedEditorState = ReviewDocumentV1['editorState']

/** Builds canonical empty Lexical state because empty roots cannot be reapplied safely. */
export const createEmptyReviewDocument = (): ReviewDocumentV1 => parseReviewDocument({
  version: 1,
  editorState: {
    root: {
      children: [{
        children: [],
        direction: null,
        format: '',
        indent: 0,
        textFormat: 0,
        textStyle: '',
        type: 'paragraph',
        version: 1,
      }],
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  },
})

/** Validates editor JSON before serializing exact Convex body wire shape. */
export const serializeReviewEditorState = (editorState: unknown): string => JSON.stringify(parseReviewDocument({ version: 1, editorState }))

/** Parses untrusted Convex bodyJson without fallback content. */
export const parseReviewBodyJson = (bodyJson: string): ReviewDocumentV1 => {
  let value: unknown
  try {
    value = JSON.parse(bodyJson)
  } catch {
    throw new TypeError('Review body is not valid JSON.')
  }
  return parseReviewDocument(value)
}

/** Converts strict Convex bodyJson DTO into validated shared Review detail. */
export const parseReviewWireDetail = (value: unknown): ReviewDetail => {
  if (typeof value !== 'object' || value === null || !('bodyJson' in value) || typeof value.bodyJson !== 'string') {
    throw new TypeError('Review detail requires bodyJson.')
  }
  const { bodyJson, ...fields } = value
  return reviewDetailSchema.parse({ ...fields, body: parseReviewBodyJson(bodyJson) })
}

/** Returns Lexical payload only when a validated document has root content. */
export const getReviewInitialEditorState = (document: ReviewDocumentV1): SerializedEditorState | null => document.editorState.root.children.length === 0 ? null : document.editorState
