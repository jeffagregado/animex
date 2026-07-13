import {
  parseReviewDocument,
  validateDraftReview,
  type ReviewDocumentV1,
} from '#/features/social/shared/review-document'

type ReviewNode = ReviewDocumentV1['editorState']['root']['children'][number]
type ReviewFields = { body: unknown; rating: unknown; summary: unknown }
export type ReviewSaveMode = 'draft' | 'publish'

/** Counts visible text, image alt, and video label using validated structure. */
export const getReviewVisibleTextLength = (value: unknown): number => {
  const body = parseReviewDocument(value)
  return body.editorState.root.children.reduce((sum, node) => sum + countNode(node), 0)
}

const countNode = (node: ReviewNode): number => {
  if (node.type === 'text') return node.text.length
  if (node.type === 'review-image') return node.alt.length
  if (node.type === 'review-video') return node.label?.length ?? 0
  if (node.type === 'linebreak') return 0
  return node.children.reduce((sum, child) => sum + countNode(child as ReviewNode), 0)
}

const getRealText = (node: ReviewNode): string => {
  if (node.type === 'text') return node.text
  if (node.type === 'review-image' || node.type === 'review-video' || node.type === 'linebreak') return ''
  return node.children.map((child) => getRealText(child as ReviewNode)).join('')
}

/** Returns ordered actionable validation messages for Draft or Publish. */
export const validateReviewEditorFields = (fields: ReviewFields, mode: ReviewSaveMode): string[] => {
  try {
    const draft = validateDraftReview(fields.body, fields.rating, fields.summary)
    if (mode === 'draft') return []

    const errors: string[] = []
    const realText = draft.body.editorState.root.children.map(getRealText).join('').replace(/[\p{White_Space}\p{Default_Ignorable_Code_Point}\p{Cc}]/gu, '')
    if (realText.length === 0) errors.push('Published Review requires real body text.')
    if (draft.rating === null) errors.push('Published Review requires a Rating.')
    if (draft.summary.length === 0) errors.push('Published Review requires a Summary.')
    return errors
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Review fields are invalid.'
    if (/rating|multiple/i.test(message)) return ['Rating must be between 0 and 100 with at most one decimal.']
    return [message]
  }
}
