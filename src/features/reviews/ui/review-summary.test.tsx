// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ReviewSummary } from './review-summary'

afterEach(cleanup)

describe('ReviewSummary', () => {
  it('starts spoiler summaries covered and reveals on intent', () => {
    render(<ReviewSummary hasSpoiler summary="Fern learns the truth." variant="detail" />)
    expect(screen.queryByText('Fern learns the truth.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reveal summary spoiler' }))
    expect(screen.getByText('Fern learns the truth.')).toBeTruthy()
  })

  it('renders non-spoiler summaries immediately', () => {
    render(<ReviewSummary hasSpoiler={false} summary="A patient journey." variant="detail" />)
    const summary = screen.getByText('A patient journey.')
    expect(summary.className).toContain('text-lg')
    expect(summary.className).toContain('italic')
  })

  it('renders compact list summaries with two-line clamping', () => {
    render(<ReviewSummary hasSpoiler={false} summary="A compact journey." variant="list" />)

    const summary = screen.getByText('A compact journey.')
    expect(summary.className).toContain('line-clamp-2')
    expect(summary.className).toContain('text-sm')
    expect(summary.className).not.toContain('italic')
  })

  it('reveals list spoilers independently', () => {
    render(<><ReviewSummary hasSpoiler summary="First secret" variant="list" /><ReviewSummary hasSpoiler summary="Second secret" variant="list" /></>)

    const revealButtons = screen.getAllByRole('button', { name: 'Reveal summary spoiler' })
    fireEvent.click(revealButtons[0])

    expect(screen.getByText('First secret')).toBeTruthy()
    expect(screen.queryByText('Second secret')).toBeNull()
  })

  it('covers safely when spoiler status or summary content changes', () => {
    const view = render(<ReviewSummary hasSpoiler={false} summary="Same summary" variant="detail" />)
    expect(screen.getByText('Same summary')).toBeTruthy()
    view.rerender(<ReviewSummary hasSpoiler summary="Same summary" variant="detail" />)
    expect(screen.queryByText('Same summary')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reveal summary spoiler' }))
    expect(screen.getByText('Same summary')).toBeTruthy()
    view.rerender(<ReviewSummary hasSpoiler summary="Changed secret" variant="detail" />)
    expect(screen.queryByText('Changed secret')).toBeNull()
  })
})
