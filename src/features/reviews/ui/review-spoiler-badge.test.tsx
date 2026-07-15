// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ReviewSpoilerBadge } from './review-spoiler-badge'

afterEach(cleanup)

describe('ReviewSpoilerBadge', () => {
  it('renders non-interactive accessible destructive Spoiler text', () => {
    render(<ReviewSpoilerBadge />)
    const badge = screen.getByText('Spoiler')
    expect(badge.tagName).toBe('SPAN')
    expect(badge.className).toContain('bg-destructive')
    expect(screen.queryByRole('button')).toBeNull()
  })
})
