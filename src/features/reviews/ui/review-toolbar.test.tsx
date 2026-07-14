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
import { $createParagraphNode, $createTextNode, $getRoot, $getSelection, $isElementNode, $isRangeSelection, $isTextNode, $setSelection, type LexicalEditor, type RangeSelection } from 'lexical'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { ReviewImageNode } from '../lexical/review-image-node'
import { SpoilerNode } from '../lexical/spoiler-node'
import { ReviewVideoNode } from '../lexical/review-video-node'
import { formatReviewText, insertReviewMedia, markSelectedBlocksAsSpoiler, ReviewToolbar } from './review-toolbar'

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

  it('inserts image and video nodes at collapsed caret positions', () => {
    let imageSelection: RangeSelection | null = null
    editor.update(() => { const text = $createTextNode('BeforeAfter'); $getRoot().clear().append($createParagraphNode().append(text)); text.select(6, 6); imageSelection = $getSelection()?.clone() as RangeSelection }, { discrete: true })
    insertReviewMedia(editor, 'image', 'https://images.example/frieren.jpg', 'Frieren sunset', imageSelection)

    let videoSelection: RangeSelection | null = null
    editor.update(() => { const last = $getRoot().getLastChild(); if (!$isElementNode(last)) throw new TypeError('Expected trailing block.'); last.selectEnd(); videoSelection = $getSelection()?.clone() as RangeSelection }, { discrete: true })
    insertReviewMedia(editor, 'video', 'https://youtu.be/dQw4w9WgXcQ', 'Trailer', videoSelection)
    const children = editor.getEditorState().toJSON().root.children
    expect(children.map((node) => node.type)).toEqual(['paragraph', 'review-image', 'paragraph', 'review-video', 'paragraph'])
    expect(children[0]).toMatchObject({ children: [expect.objectContaining({ text: 'Before' })] })
    expect(children[1]).toMatchObject({ type: 'review-image', alt: 'Frieren sunset' })
    expect(children[2]).toMatchObject({ children: [expect.objectContaining({ text: 'After' })] })
    expect(children[3]).toMatchObject({ type: 'review-video', provider: 'youtube', label: 'Trailer' })
    editor.getEditorState().read(() => { const selection = $getSelection(); expect($isRangeSelection(selection) && selection.isCollapsed()).toBe(true) })
  })

  it('replaces selected text and restores captured selection after focus loss', () => {
    let saved: RangeSelection | null = null
    editor.update(() => { const text = $createTextNode('Before remove After'); $getRoot().clear().append($createParagraphNode().append(text)); text.select(7, 13); saved = $getSelection()?.clone() as RangeSelection; $setSelection(null) }, { discrete: true })

    insertReviewMedia(editor, 'image', 'https://images.example/frieren.jpg', 'Frieren sunset', saved)

    expect(editor.getEditorState().toJSON().root.children.map((node) => node.type)).toEqual(['paragraph', 'review-image', 'paragraph'])
    expect(editor.getEditorState().read(() => $getRoot().getTextContent().replaceAll('\n', ''))).toBe('Before  After')
  })

  it('inserts media first when selection is missing or stale', () => {
    editor.update(() => { $getRoot().clear().append($createParagraphNode().append($createTextNode('Body'))); $setSelection(null) }, { discrete: true })

    insertReviewMedia(editor, 'image', 'https://images.example/frieren.jpg', 'Frieren sunset', null)
    expect(editor.getEditorState().toJSON().root.children[0]).toMatchObject({ type: 'review-image' })

    let stale: RangeSelection | null = null
    editor.update(() => { const body = $getRoot().getLastChild(); if (!$isElementNode(body)) throw new TypeError('Expected body.'); body.selectEnd(); stale = $getSelection()?.clone() as RangeSelection; $setSelection(null); body.replace($createParagraphNode().append($createTextNode('Fresh'))) }, { discrete: true })
    insertReviewMedia(editor, 'video', 'https://vimeo.com/123', '', stale)

    expect(editor.getEditorState().toJSON().root.children[0]).toMatchObject({ type: 'review-video' })
  })

  it('toggles spoiler wrappers without nesting', () => {
    selectText('Secret')
    markSelectedBlocksAsSpoiler(editor)
    expect(firstNode()).toMatchObject({ type: 'spoiler', children: [{ type: 'paragraph' }] })

    editor.update(() => { const spoiler = $getRoot().getFirstChild(); if (!$isElementNode(spoiler)) throw new TypeError('Expected spoiler.'); spoiler.selectStart() }, { discrete: true })
    markSelectedBlocksAsSpoiler(editor)
    expect(firstNode()).toMatchObject({ type: 'paragraph', children: [expect.objectContaining({ text: 'Secret' })] })
  })

  it('undoes and redoes media insertion as one history operation', async () => {
    let saved: RangeSelection | null = null
    editor.update(() => { const text = $createTextNode('Body'); $getRoot().clear().append($createParagraphNode().append(text)); text.selectEnd(); saved = $getSelection()?.clone() as RangeSelection }, { discrete: true, tag: 'history-push' })
    insertReviewMedia(editor, 'image', 'https://images.example/frieren.jpg', 'Frieren', saved)
    await waitFor(() => expect(editor.getEditorState().toJSON().root.children.some((node) => node.type === 'review-image')).toBe(true))

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(editor.getEditorState().toJSON().root.children.some((node) => node.type === 'review-image')).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    await waitFor(() => expect(editor.getEditorState().toJSON().root.children.some((node) => node.type === 'review-image')).toBe(true))
  })

  it('undoes and redoes spoiler toggle as one history operation', async () => {
    selectText('Secret')
    markSelectedBlocksAsSpoiler(editor)
    await waitFor(() => expect(firstNode()).toMatchObject({ type: 'spoiler' }))
    editor.update(() => { const spoiler = $getRoot().getFirstChild(); if (!$isElementNode(spoiler)) throw new TypeError('Expected spoiler.'); spoiler.selectStart() }, { discrete: true })
    markSelectedBlocksAsSpoiler(editor)
    await waitFor(() => expect(firstNode()).toMatchObject({ type: 'paragraph' }))

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(firstNode()).toMatchObject({ type: 'spoiler' }))
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    await waitFor(() => expect(firstNode()).toMatchObject({ type: 'paragraph' }))
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
