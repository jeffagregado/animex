// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ReviewSummary } from './review-summary'

afterEach(cleanup)

describe('ReviewSummary', () => {
  it('always renders detail summaries without a reveal control', () => {
    render(<ReviewSummary summary="Fern learns the truth." variant="detail" />)
    expect(screen.getByText('Fern learns the truth.')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders non-spoiler summaries immediately', () => {
    render(<ReviewSummary summary="A patient journey." variant="detail" />)
    const summary = screen.getByText('A patient journey.')
    expect(summary.className).toContain('text-lg')
    expect(summary.className).toContain('italic')
  })

  it('renders compact list summaries with two-line clamping', () => {
    render(<ReviewSummary summary="A compact journey." variant="list" />)

    const summary = screen.getByText('A compact journey.')
    expect(summary.className).toContain('line-clamp-2')
    expect(summary.className).toContain('text-sm')
    expect(summary.className).not.toContain('italic')
  })

  it('renders nothing for an empty summary', () => {
    const { container } = render(<ReviewSummary summary="" variant="detail" />)
    expect(container.childElementCount).toBe(0)
  })
})
