// @vitest-environment jsdom

import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { $createNodeSelection, $createParagraphNode, $createTextNode, $getRoot, $getSelection, $isRangeSelection, $setSelection, KEY_BACKSPACE_COMMAND, KEY_DELETE_COMMAND, REDO_COMMAND, UNDO_COMMAND, type LexicalEditor } from 'lexical'
import { afterEach, describe, expect, it } from 'vitest'

import { $createReviewImageNode, ReviewImageNode } from '../lexical/review-image-node'
import { $createReviewVideoNode, ReviewVideoNode } from '../lexical/review-video-node'
import { ReviewMediaEditingPlugin } from './review-media-editing-plugin'

let editor: LexicalEditor
function CaptureEditor() { [editor] = useLexicalComposerContext(); return null }
function Harness() { return <LexicalComposer initialConfig={{ namespace: 'media-editing-test', nodes: [ReviewImageNode, ReviewVideoNode], onError: (error) => { throw error } }}><RichTextPlugin contentEditable={<ContentEditable aria-label="Editor" />} ErrorBoundary={LexicalErrorBoundary} placeholder={null} /><ReviewMediaEditingPlugin /><HistoryPlugin /><CaptureEditor /></LexicalComposer> }
const types = () => editor.getEditorState().toJSON().root.children.map((node) => node.type)

afterEach(cleanup)

describe('ReviewMediaEditingPlugin', () => {
  it('click-selects media with cyan outline and Delete removes it', async () => {
    render(<Harness />)
    editor.update(() => { $getRoot().append($createReviewImageNode('https://images.example/frieren.jpg', 'Frieren')) }, { discrete: true })
    const image = await screen.findByAltText('Frieren')
    fireEvent.click(image)
    await waitFor(() => {
      const media = image.closest('[data-review-media]')
      expect(media?.className).toContain('ring-cyan-300')
      expect(media?.className).toContain('w-full')
      expect(media?.className).toContain('sm:max-w-[65%]')
      expect(image.className).toContain('aspect-4/5')
    })

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Editor' }), { key: 'Delete' })
    await waitFor(() => expect(types()).toEqual(['paragraph']))
  })

  it('click-selects video media with the same cyan outline', async () => {
    render(<Harness />)
    editor.update(() => { $getRoot().append($createReviewVideoNode('https://vimeo.com/123', 'vimeo', 'Trailer')) }, { discrete: true })
    const video = await screen.findByRole('link', { name: /Trailer/ })

    fireEvent.click(video)

    await waitFor(() => expect(video.closest('[data-review-media]')?.className).toContain('ring-cyan-300'))
  })

  it.each([
    ['Backspace', KEY_BACKSPACE_COMMAND],
    ['Delete', KEY_DELETE_COMMAND],
  ] as const)('%s removes selected media and leaves a range caret', async (_label, command) => {
    render(<Harness />)
    editor.update(() => { const media = $createReviewImageNode('https://images.example/frieren.jpg', 'Frieren'); $getRoot().clear().append($createParagraphNode().append($createTextNode('Before')), media, $createParagraphNode().append($createTextNode('After'))); const selection = $createNodeSelection(); selection.add(media.getKey()); $setSelection(selection) }, { discrete: true })

    editor.dispatchCommand(command, new KeyboardEvent('keydown'))

    await waitFor(() => expect(types()).toEqual(['paragraph', 'paragraph']))
    editor.getEditorState().read(() => expect($isRangeSelection($getSelection())).toBe(true))
  })

  it('removes media adjacent to caret with Backspace and Delete', async () => {
    render(<Harness />)
    editor.update(() => { const before = $createParagraphNode().append($createTextNode('Before')); const after = $createParagraphNode().append($createTextNode('After')); $getRoot().clear().append(before, $createReviewImageNode('https://images.example/frieren.jpg', 'Frieren'), after); after.selectStart() }, { discrete: true })
    editor.dispatchCommand(KEY_BACKSPACE_COMMAND, new KeyboardEvent('keydown'))
    await waitFor(() => expect(types()).toEqual(['paragraph', 'paragraph']))

    editor.update(() => { const before = $getRoot().getFirstChild(); if (before === null) throw new TypeError('Expected preceding block.'); before.insertAfter($createReviewImageNode('https://images.example/frieren.jpg', 'Frieren')); before.selectEnd() }, { discrete: true })
    editor.dispatchCommand(KEY_DELETE_COMMAND, new KeyboardEvent('keydown'))
    await waitFor(() => expect(types()).toEqual(['paragraph', 'paragraph']))
  })

  it('restores one media deletion with one Undo and Redo', async () => {
    render(<Harness />)
    editor.update(() => { const media = $createReviewImageNode('https://images.example/frieren.jpg', 'Frieren'); $getRoot().clear().append($createParagraphNode().append($createTextNode('Before')), media, $createParagraphNode().append($createTextNode('After'))); const selection = $createNodeSelection(); selection.add(media.getKey()); $setSelection(selection) }, { discrete: true, tag: 'history-push' })
    editor.dispatchCommand(KEY_DELETE_COMMAND, new KeyboardEvent('keydown'))
    await waitFor(() => expect(types()).toEqual(['paragraph', 'paragraph']))

    editor.dispatchCommand(UNDO_COMMAND, undefined)
    await waitFor(() => expect(types()).toEqual(['paragraph', 'review-image', 'paragraph']))
    editor.dispatchCommand(REDO_COMMAND, undefined)
    await waitFor(() => expect(types()).toEqual(['paragraph', 'paragraph']))
  })

  it('deletes and restores selected video with one-step history parity', async () => {
    render(<Harness />)
    editor.update(() => { const media = $createReviewVideoNode('https://vimeo.com/123', 'vimeo', 'Trailer'); $getRoot().clear().append($createParagraphNode().append($createTextNode('Before')), media, $createParagraphNode().append($createTextNode('After'))); const selection = $createNodeSelection(); selection.add(media.getKey()); $setSelection(selection) }, { discrete: true, tag: 'history-push' })
    editor.dispatchCommand(KEY_DELETE_COMMAND, new KeyboardEvent('keydown'))
    await waitFor(() => expect(types()).toEqual(['paragraph', 'paragraph']))

    editor.dispatchCommand(UNDO_COMMAND, undefined)
    await waitFor(() => expect(types()).toEqual(['paragraph', 'review-video', 'paragraph']))
    editor.dispatchCommand(REDO_COMMAND, undefined)
    await waitFor(() => expect(types()).toEqual(['paragraph', 'paragraph']))
  })
})
