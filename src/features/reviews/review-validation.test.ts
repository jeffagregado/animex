import { describe, expect, it } from 'vitest'

import { createEmptyReviewDocument } from './review-document-adapter'
import { getReviewVisibleTextLength, isCompleteReviewRating, parseReviewRating, validateReviewEditorFields } from './review-validation'

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

  it.each([
    ['0', 0], ['9', 9], ['9.5', 9.5], ['100', 100], ['100.0', 100],
  ])('parses complete valid rating text %s', (value, expected) => {
    expect(isCompleteReviewRating(value)).toBe(true)
    expect(parseReviewRating(value)).toBe(expected)
  })

  it.each(['9.', '.5', '50.12', '-1', '100.1', 'abc'])('rejects incomplete or invalid rating text %s', (value) => {
    expect(isCompleteReviewRating(value)).toBe(false)
    expect(() => parseReviewRating(value)).toThrow('Rating must be between 0 and 100 with at most one decimal.')
  })

  it('maps empty rating text to null for Draft validation and rejects Publish', () => {
    expect(parseReviewRating('')).toBeNull()
    expect(validateReviewEditorFields({ body: textDocument('Good'), rating: '', summary: 'Summary' }, 'draft')).toEqual([])
    expect(validateReviewEditorFields({ body: textDocument('Good'), rating: '', summary: 'Summary' }, 'publish')).toEqual(['Published Review requires a Rating.'])
  })
})
