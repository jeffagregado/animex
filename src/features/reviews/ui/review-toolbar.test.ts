import { describe, expect, it } from 'vitest'

import { REVIEW_TOOLBAR_ACTIONS } from './review-toolbar'

describe('Review toolbar contract', () => {
  it('exposes every approved command and no unsupported editor feature', () => {
    expect(REVIEW_TOOLBAR_ACTIONS).toEqual([
      'H2', 'H3', 'Quote', 'Bulleted list', 'Numbered list',
      'Bold', 'Italic', 'Underline', 'Strikethrough',
      'Image', 'Video', 'Spoiler', 'Undo', 'Redo',
    ])
    expect(REVIEW_TOOLBAR_ACTIONS).not.toEqual(expect.arrayContaining(['H1', 'Table', 'Code', 'Embed', 'HTML']))
  })
})
