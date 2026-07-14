// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Dialog, DialogContent } from './dialog'

afterEach(cleanup)

describe('DialogContent', () => {
  it('themes its scrollable popup', () => {
    render(<Dialog open><DialogContent title="Test dialog">Content</DialogContent></Dialog>)

    expect(screen.getByRole('dialog').className).toContain('scrollbar-themed')
  })
})
