import { createEditor } from 'lexical'
import { describe, expect, it, vi } from 'vitest'

import { createEmptyReviewDocument } from '../review-document-adapter'
import { acceptReviewEditorChange } from './review-editor'

const stateWithText = (text: string) => ({ root: { children: [{ children: [{ detail: 0, format: 0, mode: 'normal', style: '', text, type: 'text', version: 1 }], direction: null, format: '', indent: 0, textFormat: 0, textStyle: '', type: 'paragraph', version: 1 }], direction: null, format: '', indent: 0, type: 'root', version: 1 } })

describe('ReviewEditor change acceptance', () => {
  it('rejects over-limit insertion, reports attempted count, and restores Preview-consistent state', () => {
    const editor = createEditor()
    const valid = createEmptyReviewDocument()
    const overLimit = editor.parseEditorState(JSON.stringify(stateWithText('x'.repeat(2_501))))
    editor.setEditorState(overLimit)
    const onChange = vi.fn()
    const onError = vi.fn()
    const onLimitExceeded = vi.fn()

    const next = acceptReviewEditorChange({ editor, state: overLimit, lastValid: valid, onChange, onError, onLimitExceeded })

    expect(next).toBe(valid)
    expect(onLimitExceeded).toHaveBeenCalledWith(2_501)
    expect(onChange).not.toHaveBeenCalled()
    expect(editor.getEditorState().toJSON()).toEqual(valid.editorState)
  })
})
