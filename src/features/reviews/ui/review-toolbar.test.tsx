// @vitest-environment jsdom

import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { ListItemNode, ListNode } from '@lexical/list'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { $createParagraphNode, $createTextNode, $getRoot, $isElementNode, $isTextNode, type LexicalEditor } from 'lexical'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { ReviewImageNode } from '../lexical/review-image-node'
import { SpoilerNode } from '../lexical/spoiler-node'
import { ReviewVideoNode } from '../lexical/review-video-node'
import { formatReviewText, insertReviewMedia, ReviewToolbar } from './review-toolbar'

let editor: LexicalEditor

function CaptureEditor() { [editor] = useLexicalComposerContext(); return null }
function Harness() {
  return <LexicalComposer initialConfig={{ namespace: 'review-toolbar-test', nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, SpoilerNode, ReviewImageNode, ReviewVideoNode], onError: (error) => { throw error } }}><ReviewToolbar /><RichTextPlugin contentEditable={<ContentEditable />} ErrorBoundary={LexicalErrorBoundary} placeholder={null} /><ListPlugin /><HistoryPlugin /><CaptureEditor /></LexicalComposer>
}

const selectText = (value: string): void => editor.update(() => { const text = $createTextNode(value); const paragraph = $createParagraphNode().append(text); $getRoot().clear().append(paragraph); text.select(0, value.length) }, { discrete: true, tag: 'history-push' })
const firstNode = () => editor.getEditorState().toJSON().root.children[0]

beforeAll(() => { Range.prototype.getBoundingClientRect = () => ({ bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) }) })
beforeEach(() => { render(<Harness />) })
afterEach(cleanup)

describe('ReviewToolbar Lexical behavior', () => {
  it('applies H3, quote, ordered, and unordered block commands', async () => {
    selectText('Heading'); fireEvent.click(screen.getByRole('button', { name: 'H3' })); expect(firstNode()).toMatchObject({ type: 'heading', tag: 'h3' })
    selectText('Quote'); fireEvent.click(screen.getByRole('button', { name: 'Quote' })); expect(firstNode()).toMatchObject({ type: 'quote' })
    selectText('Bullets'); fireEvent.click(screen.getByRole('button', { name: 'Bulleted list' })); await waitFor(() => expect(firstNode()).toMatchObject({ type: 'list', listType: 'bullet', tag: 'ul' }))
    selectText('Numbers'); fireEvent.click(screen.getByRole('button', { name: 'Numbered list' })); await waitFor(() => expect(firstNode()).toMatchObject({ type: 'list', listType: 'number', tag: 'ol' }))
  })

  it('applies every approved inline text format to the selected text', async () => {
    selectText('Formatted')
    for (const format of ['bold', 'italic', 'underline', 'strikethrough'] as const) formatReviewText(editor, format)
    await waitFor(() => expect((firstNode() as unknown as { children: Array<{ format: number }> }).children[0].format).toBe(15))
  })

  it('inserts strict image and video nodes', () => {
    selectText('Media')
    insertReviewMedia(editor, 'image', 'https://images.example/frieren.jpg', 'Frieren sunset')
    insertReviewMedia(editor, 'video', 'https://youtu.be/dQw4w9WgXcQ', 'Trailer')
    expect(editor.getEditorState().toJSON().root.children).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'review-image', alt: 'Frieren sunset' }),
      expect.objectContaining({ type: 'review-video', provider: 'youtube', label: 'Trailer' }),
    ]))
  })

  it('undoes and redoes a history change through toolbar commands', async () => {
    selectText('Before')
    editor.update(() => { const block = $getRoot().getFirstChild(); if (!$isElementNode(block)) throw new TypeError('Expected history block.'); const text = block.getFirstChild(); if (!$isTextNode(text)) throw new TypeError('Expected history text.'); text.setTextContent('After') }, { discrete: true, tag: 'history-push' })
    await waitFor(() => expect(editor.getEditorState().read(() => $getRoot().getTextContent())).toBe('After'))
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(editor.getEditorState().read(() => $getRoot().getTextContent())).toBe('Before'))
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    await waitFor(() => expect(editor.getEditorState().read(() => $getRoot().getTextContent())).toBe('After'))
  })
})
