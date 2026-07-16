// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PostComposerDialog } from './post-composer-dialog'

let capturedInitial: unknown

vi.mock('./post-composer', () => ({
  PostComposer: ({ initial }: { initial: unknown }) => {
    capturedInitial = initial
    return <div>Composer</div>
  },
}))

afterEach(() => {
  cleanup()
  capturedInitial = undefined
})

describe('PostComposerDialog', () => {
  it('themes its scrollable popup', () => {
    render(<PostComposerDialog edit={null} initialVisibility="public" onClose={vi.fn()} onSaved={vi.fn()} open />)

    expect(screen.getByRole('dialog').className).toContain('scrollbar-themed')
  })

  it('does not preserve a Followers account default for new content', () => {
    render(<PostComposerDialog edit={null} initialVisibility="followers" onClose={vi.fn()} onSaved={vi.fn()} open />)

    expect(capturedInitial).toMatchObject({
      visibility: 'followers',
      preserveOriginalVisibility: false,
    })
  })

  it('preserves stored Followers visibility while editing', () => {
    render(<PostComposerDialog
      edit={{
        id: 'card',
        kind: 'post',
        postId: 'post',
        author: { id: 'owner', username: 'owner', displayName: 'Owner', avatarUrl: null },
        text: 'Legacy',
        media: null,
        hasSpoiler: false,
        visibility: 'followers',
        createdAt: 1,
        updatedAt: 1,
      }}
      initialVisibility="public"
      onClose={vi.fn()}
      onSaved={vi.fn()}
      open
    />)

    expect(capturedInitial).toMatchObject({
      visibility: 'followers',
      preserveOriginalVisibility: true,
    })
  })
})
