// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PostComposerDialog } from './post-composer-dialog'

vi.mock('./post-composer', () => ({
  PostComposer: () => <div>Composer</div>,
}))

afterEach(cleanup)

describe('PostComposerDialog', () => {
  it('themes its scrollable popup', () => {
    render(<PostComposerDialog edit={null} initialVisibility="public" onClose={vi.fn()} onSaved={vi.fn()} open />)

    expect(screen.getByRole('dialog').className).toContain('scrollbar-themed')
  })
})
