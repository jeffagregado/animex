// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ReviewSummary } from './review-summary'

afterEach(cleanup)

describe('ReviewSummary', () => {
  it('starts spoiler summaries covered and reveals on intent', () => {
    render(<ReviewSummary hasSpoiler summary="Fern learns the truth." />)
    expect(screen.queryByText('Fern learns the truth.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reveal summary spoiler' }))
    expect(screen.getByText('Fern learns the truth.')).toBeTruthy()
  })

  it('renders non-spoiler summaries immediately', () => {
    render(<ReviewSummary hasSpoiler={false} summary="A patient journey." />)
    expect(screen.getByText('A patient journey.')).toBeTruthy()
  })

  it('covers safely when spoiler status or summary content changes', () => {
    const view = render(<ReviewSummary hasSpoiler={false} summary="Same summary" />)
    expect(screen.getByText('Same summary')).toBeTruthy()
    view.rerender(<ReviewSummary hasSpoiler summary="Same summary" />)
    expect(screen.queryByText('Same summary')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reveal summary spoiler' }))
    expect(screen.getByText('Same summary')).toBeTruthy()
    view.rerender(<ReviewSummary hasSpoiler summary="Changed secret" />)
    expect(screen.queryByText('Changed secret')).toBeNull()
  })
})
