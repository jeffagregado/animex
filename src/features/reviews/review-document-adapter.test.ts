import { describe, expect, it } from 'vitest'

import { parseReviewDocument } from '#/features/social/shared/review-document'
import {
  createEmptyReviewDocument,
  parseReviewBodyJson,
  parseReviewWireDetail,
  serializeReviewEditorState,
} from './review-document-adapter'

const paragraphState = {
  root: {
    children: [{
      children: [{ detail: 0, format: 0, mode: 'normal', style: '', text: 'Quiet journey', type: 'text', version: 1 }],
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
}

const removedSpoilerField = ['summary', 'HasSpoiler'].join('')

describe('review document wire adapter', () => {
  it('wraps Lexical state, validates it, and emits canonical body JSON', () => {
    const bodyJson = serializeReviewEditorState(paragraphState)
    expect(JSON.parse(bodyJson)).toEqual({ version: 1, editorState: paragraphState })
    expect(parseReviewBodyJson(bodyJson)).toEqual(parseReviewDocument(JSON.parse(bodyJson)))
  })

  it('rejects malformed body JSON instead of falling back', () => {
    expect(() => parseReviewBodyJson('{')).toThrow('Review body is not valid JSON.')
    expect(() => parseReviewBodyJson(JSON.stringify({ version: 1, editorState: { root: { children: [] } } }))).toThrow()
  })

  it('strictly adapts bodyJson Review detail at the feature boundary', () => {
    const bodyJson = serializeReviewEditorState(paragraphState)
    const detail = parseReviewWireDetail({ id: 'review-1', author: { id: 'author-1', username: 'fan', displayName: 'Fan', avatarUrl: null }, anime: { anilistId: 1, slug: 'frieren', title: 'Frieren', coverImageUrl: null }, state: 'published', rating: 90, summary: 'Summary', containsSpoiler: false, visibility: 'public', publishedAt: 1, updatedAt: 1, bodyJson })
    expect(detail.body).toEqual(parseReviewBodyJson(bodyJson))
    expect(() => parseReviewWireDetail({ ...detail, bodyJson, unexpected: true })).toThrow()
    expect(() => parseReviewWireDetail({ ...detail, containsSpoiler: undefined, [removedSpoilerField]: false, bodyJson })).toThrow()
  })

  it('creates exact canonical empty paragraph state for new drafts', () => {
    const empty = createEmptyReviewDocument()
    expect(empty.editorState.root.children).toHaveLength(1)
    expect(empty.editorState.root.children[0]).toMatchObject({ type: 'paragraph', children: [], format: '', indent: 0 })
    expect(parseReviewDocument(empty)).toEqual(empty)
  })
})
