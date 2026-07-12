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

  it('renders every filter select with themed native-arrow replacement styles', () => {
    render(<DiscoverSearchFilters searchState={searchState} onStateChange={vi.fn()} />)

    const filters = ['Genre', 'Format', 'Season', 'Year', 'Sort']
    for (const label of filters) {
      const select = screen.getByLabelText(label)
      expect(select.className).toContain('appearance-none')
      expect(select.className).toContain('hover:border-cyan-300')
      expect(select.className).toContain('focus-visible:ring-cyan-300/40')
    }
  })

  it('shows Clear filters only for active filters and resets them in one push without clearing the query', () => {
    const onStateChange = vi.fn()
    const activeSearchState: DiscoverUrlSearchState = {
      query: 'frieren',
      genre: 'Action',
      format: 'TV',
      season: 'WINTER',
      year: 2026,
      sort: 'trending',
    }

    const view = render(<DiscoverSearchFilters searchState={searchState} onStateChange={onStateChange} />)
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()

    view.rerender(<DiscoverSearchFilters searchState={activeSearchState} onStateChange={onStateChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))

    expect(onStateChange).toHaveBeenCalledTimes(1)
    expect(onStateChange).toHaveBeenCalledWith(
      { ...searchState, query: 'frieren' },
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
