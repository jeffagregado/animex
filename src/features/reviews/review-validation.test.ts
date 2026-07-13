import { describe, expect, it } from 'vitest'

import { createEmptyReviewDocument } from './review-document-adapter'
import { getReviewVisibleTextLength, validateReviewEditorFields } from './review-validation'

const textDocument = (text: string) => ({
  version: 1 as const,
  editorState: {
    root: {
      children: [{ children: [{ detail: 0 as const, format: 0, mode: 'normal' as const, style: '' as const, text, type: 'text' as const, version: 1 as const }], direction: null, format: '' as const, indent: 0 as const, textFormat: 0, textStyle: '' as const, type: 'paragraph' as const, version: 1 as const }],
      direction: null,
      format: '' as const,
      indent: 0 as const,
      type: 'root' as const,
      version: 1 as const,
    },
  },
})

describe('review editor validation', () => {
  it('allows incomplete drafts while publish requires rating, summary, and body text', () => {
    expect(validateReviewEditorFields({ body: createEmptyReviewDocument(), rating: null, summary: '' }, 'draft')).toEqual([])
    expect(validateReviewEditorFields({ body: createEmptyReviewDocument(), rating: null, summary: '' }, 'publish')).toEqual([
      'Published Review requires real body text.',
      'Published Review requires a Rating.',
      'Published Review requires a Summary.',
    ])
  })

  it('enforces one-decimal rating and shared visible-character counting', () => {
    expect(validateReviewEditorFields({ body: textDocument('Good'), rating: 50.12, summary: 'Summary' }, 'draft')).toContain('Rating must be between 0 and 100 with at most one decimal.')
    expect(getReviewVisibleTextLength(textDocument('Good'))).toBe(4)
  })
})
