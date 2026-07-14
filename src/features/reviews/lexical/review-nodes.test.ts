import { createEditor } from 'lexical'
import { describe, expect, it } from 'vitest'

import { parseReviewDocument } from '#/features/social/shared/review-document'
import { $createReviewImageNode, ReviewImageNode } from './review-image-node'
import { $createSpoilerNode, SpoilerNode } from './spoiler-node'
import { ReviewVideoNode } from './review-video-node'
import { formatReviewBlock, markSelectedBlocksAsSpoiler } from '../ui/review-toolbar'
import { $createParagraphNode, $createRangeSelection, $createTextNode, $getRoot, $isElementNode, $setSelection } from 'lexical'
import { $createHeadingNode, $createQuoteNode, HeadingNode, QuoteNode } from '@lexical/rich-text'
import { $createListItemNode, $createListNode, ListItemNode, ListNode } from '@lexical/list'

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

  it('formats a selected block and wraps selected top-level blocks once', () => {
    const editor = createEditor({ nodes: [HeadingNode, QuoteNode, SpoilerNode, ReviewImageNode, ReviewVideoNode] })
    editor.update(() => {
      const paragraph = $createParagraphNode().append($createTextNode('Selected'))
      $getRoot().append(paragraph)
      paragraph.select()
    }, { discrete: true })

    formatReviewBlock(editor, 'h2')
    markSelectedBlocksAsSpoiler(editor)

    expect(editor.getEditorState().toJSON().root.children[0]).toMatchObject({
      type: 'spoiler',
      children: [{ type: 'heading', tag: 'h2' }],
    })
  })

  it('unwraps every touched spoiler while preserving mixed plain blocks', () => {
    const editor = createEditor({ nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, SpoilerNode, ReviewImageNode, ReviewVideoNode] })
    editor.update(() => {
      const first = $createSpoilerNode().append($createParagraphNode().append($createTextNode('First')))
      const plain = $createParagraphNode().append($createTextNode('Plain'))
      const second = $createSpoilerNode().append($createParagraphNode().append($createTextNode('Second')), $createReviewImageNode('https://images.example/frieren.jpg', 'Frieren'))
      $getRoot().append(first, plain, second)
      const firstText = first.getFirstDescendant()
      const secondBlock = second.getFirstChild()
      const last = $isElementNode(secondBlock) ? secondBlock.getFirstDescendant() : null
      if (firstText === null || last === null) throw new TypeError('Expected spoiler descendants.')
      const selection = $createRangeSelection()
      selection.anchor.set(firstText.getKey(), 0, 'text')
      selection.focus.set(last.getKey(), last.getTextContentSize(), 'text')
      $setSelection(selection)
    }, { discrete: true })

    markSelectedBlocksAsSpoiler(editor)

    expect(editor.getEditorState().toJSON().root.children.map((node) => node.type)).toEqual(['paragraph', 'paragraph', 'paragraph', 'review-image'])
    expect(editor.getEditorState().toJSON().root.children.some((node) => node.type === 'spoiler')).toBe(false)
  })

  it('preserves semantic blocks, inline formatting, and media while unwrapping', () => {
    const editor = createEditor({ nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, SpoilerNode, ReviewImageNode, ReviewVideoNode] })
    editor.update(() => {
      const heading = $createHeadingNode('h3').append($createTextNode('Heading').toggleFormat('bold'))
      const quote = $createQuoteNode().append($createTextNode('Quote').toggleFormat('italic'))
      const list = $createListNode('bullet').append($createListItemNode().append($createTextNode('Item')))
      const spoiler = $createSpoilerNode().append(heading, quote, list, $createReviewImageNode('https://images.example/frieren.jpg', 'Frieren'))
      $getRoot().append(spoiler)
      heading.selectStart()
    }, { discrete: true })

    markSelectedBlocksAsSpoiler(editor)

    const children = editor.getEditorState().toJSON().root.children
    expect(children.map((node) => node.type)).toEqual(['heading', 'quote', 'list', 'review-image'])
    expect(children[0]).toMatchObject({ tag: 'h3', children: [{ format: 1, text: 'Heading' }] })
    expect(children[1]).toMatchObject({ children: [{ format: 2, text: 'Quote' }] })
  })
})
