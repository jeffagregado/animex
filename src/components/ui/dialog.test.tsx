// @vitest-environment jsdom

import { createRef } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Dialog, DialogContent } from './dialog'

afterEach(cleanup)

describe('DialogContent', () => {
  it('themes its scrollable popup', () => {
    render(<Dialog open><DialogContent title="Test dialog">Content</DialogContent></Dialog>)

    expect(screen.getByRole('dialog').className).toContain('scrollbar-themed')
  })

  it('supports descriptive styling and explicit focus targets', async () => {
    const input = createRef<HTMLInputElement>()
    const trigger = document.createElement('button')
    const completed = vi.fn()
    render(
      <Dialog open onOpenChangeComplete={completed}>
        <DialogContent
          className="wide-dialog"
          description="Search every catalog group."
          descriptionClassName="sr-only"
          finalFocus={() => trigger}
          initialFocus={() => input.current}
          title="Quick Search"
          titleClassName="sr-only"
        >
          <input ref={input} />
        </DialogContent>
      </Dialog>,
    )

    expect(screen.getByRole('dialog').className).toContain('wide-dialog')
    expect(screen.getByRole('heading', { name: 'Quick Search' }).className).toContain('sr-only')
    expect(screen.getByText('Search every catalog group.').className).toContain('sr-only')
    await vi.waitFor(() => expect(document.activeElement).toBe(input.current))
  })
})
