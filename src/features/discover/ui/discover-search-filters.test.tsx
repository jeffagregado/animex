// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DiscoverSearchFilters } from './discover-search-filters'
import type { DiscoverUrlSearchState } from './discover-ui.types'

const searchState: DiscoverUrlSearchState = {
  query: null,
  genre: null,
  format: null,
  season: null,
  year: null,
  sort: 'relevance',
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('DiscoverSearchFilters', () => {
  it('debounces valid query changes and rejects one-character queries', () => {
    vi.useFakeTimers()
    const onStateChange = vi.fn()

    render(<DiscoverSearchFilters searchState={searchState} onStateChange={onStateChange} />)

    const input = screen.getByRole('searchbox', { name: 'Search anime' })
    fireEvent.change(input, { target: { value: 'a' } })
    vi.advanceTimersByTime(400)
    expect(onStateChange).not.toHaveBeenCalled()
    expect(screen.getByText('Enter 2 to 100 characters to search.')).toBeTruthy()

    fireEvent.change(input, { target: { value: 'frieren' } })
    vi.advanceTimersByTime(399)
    expect(onStateChange).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onStateChange).toHaveBeenCalledWith(
      { ...searchState, query: 'frieren' },
      'replace',
    )
  })

  it('uses push navigation for selected filters', () => {
    const onStateChange = vi.fn()

    render(<DiscoverSearchFilters searchState={searchState} onStateChange={onStateChange} />)

    fireEvent.change(screen.getByLabelText('Genre'), { target: { value: 'Action' } })

    expect(onStateChange).toHaveBeenCalledWith(
      { ...searchState, genre: 'Action' },
      'push',
    )
  })

  it('clears a prior canonical query when the draft becomes invalid', () => {
    const onStateChange = vi.fn()

    render(<DiscoverSearchFilters searchState={{ ...searchState, query: 'frieren' }} onStateChange={onStateChange} />)

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search anime' }), { target: { value: 'f' } })

    expect(onStateChange).toHaveBeenCalledWith({ ...searchState, query: null }, 'replace')
    expect(screen.getByText('Enter 2 to 100 characters to search.')).toBeTruthy()
  })

  it('clears a prior canonical query when the draft exceeds 100 characters', () => {
    const onStateChange = vi.fn()

    render(<DiscoverSearchFilters searchState={{ ...searchState, query: 'frieren' }} onStateChange={onStateChange} />)

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search anime' }), { target: { value: 'a'.repeat(101) } })

    expect(onStateChange).toHaveBeenCalledWith({ ...searchState, query: null }, 'replace')
    expect(screen.getByText('Enter 2 to 100 characters to search.')).toBeTruthy()
  })
})
