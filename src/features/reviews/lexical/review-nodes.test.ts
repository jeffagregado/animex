import { createEditor } from 'lexical'
import { describe, expect, it } from 'vitest'

import { parseReviewDocument } from '#/features/social/shared/review-document'
import { ReviewImageNode } from './review-image-node'
import { SpoilerNode } from './spoiler-node'
import { ReviewVideoNode } from './review-video-node'

const fields = { direction: null, format: '' as const, indent: 0 as const, version: 1 as const }
const document = parseReviewDocument({ version: 1, editorState: { root: { ...fields, type: 'root', children: [
  { ...fields, type: 'spoiler', children: [{ ...fields, textFormat: 0, textStyle: '', type: 'paragraph', children: [{ detail: 0, format: 0, mode: 'normal', style: '', text: 'Hidden', type: 'text', version: 1 }] }] },
  { alt: 'Frieren', type: 'review-image', url: 'https://images.example/frieren.jpg', version: 1 },
  { label: 'Trailer', provider: 'youtube', type: 'review-video', url: 'https://youtu.be/dQw4w9WgXcQ', version: 1 },
] } } })

describe('custom Review Lexical nodes', () => {
  it('round-trips exact locked JSON with canonical format and indent', () => {
    const editor = createEditor({ nodes: [SpoilerNode, ReviewImageNode, ReviewVideoNode] })
    const state = editor.parseEditorState(JSON.stringify(document.editorState))
    editor.setEditorState(state)
    expect(parseReviewDocument({ version: 1, editorState: editor.getEditorState().toJSON() })).toEqual(document)
  })

  it('registers only locked custom node types', () => {
    expect([SpoilerNode.getType(), ReviewImageNode.getType(), ReviewVideoNode.getType()]).toEqual(['spoiler', 'review-image', 'review-video'])
  })
})
