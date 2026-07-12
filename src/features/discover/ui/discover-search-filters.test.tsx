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

const chooseOption = (option: HTMLElement): void => {
  fireEvent.pointerDown(option, { pointerType: 'mouse' })
  fireEvent.click(option)
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
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

  it('opens genre choices in a themed popup and selects a normal value', () => {
    const onStateChange = vi.fn()

    render(<DiscoverSearchFilters searchState={searchState} onStateChange={onStateChange} />)

    const trigger = screen.getByRole('combobox', { name: 'Genre' })
    fireEvent.click(trigger)

    const popup = document.querySelector<HTMLElement>('[data-slot="select-content"]')
    const action = screen.getByRole('option', { name: 'Action' })
    expect(trigger.className).toContain('hover:border-cyan-300')
    expect(popup?.className).toContain('bg-card')
    expect(action.className).toContain('data-[highlighted]:bg-cyan-300/10')

    chooseOption(action)

    expect(onStateChange).toHaveBeenCalledWith(
      { ...searchState, genre: 'Action' },
      'push',
    )
  })

  it('does not lock body scroll when opening genre choices', () => {
    vi.useFakeTimers()
    vi.stubGlobal('CSS', { supports: () => false })
    const originalDocumentElementClientWidth = Object.getOwnPropertyDescriptor(document.documentElement, 'clientWidth')
    const originalBodyClientWidth = Object.getOwnPropertyDescriptor(document.body, 'clientWidth')
    const originalInnerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth')
    let unmount: (() => void) | null = null

    try {
      Object.defineProperties(document.documentElement, {
        clientWidth: { configurable: true, value: 1422 },
      })
      Object.defineProperties(document.body, {
        clientWidth: { configurable: true, value: 1422 },
      })
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1437 })

      const onStateChange = vi.fn()
      const view = render(<DiscoverSearchFilters searchState={searchState} onStateChange={onStateChange} />)
      unmount = view.unmount

      fireEvent.click(screen.getByRole('combobox', { name: 'Genre' }))
      vi.runAllTimers()

      expect(document.body.style.overflow).not.toBe('hidden')
    } finally {
      unmount?.()
      vi.runAllTimers()
      if (originalDocumentElementClientWidth === undefined) {
        Reflect.deleteProperty(document.documentElement, 'clientWidth')
      } else {
        Object.defineProperty(document.documentElement, 'clientWidth', originalDocumentElementClientWidth)
      }
      if (originalBodyClientWidth === undefined) {
        Reflect.deleteProperty(document.body, 'clientWidth')
      } else {
        Object.defineProperty(document.body, 'clientWidth', originalBodyClientWidth)
      }
      if (originalInnerWidth === undefined) {
        Reflect.deleteProperty(window, 'innerWidth')
      } else {
        Object.defineProperty(window, 'innerWidth', originalInnerWidth)
      }
    }
  })

  it('maps Any choices to null and renders a selected indicator', () => {
    const onStateChange = vi.fn()
    render(<DiscoverSearchFilters searchState={{ ...searchState, genre: 'Action' }} onStateChange={onStateChange} />)

    fireEvent.click(screen.getByRole('combobox', { name: 'Genre' }))

    expect(screen.getByRole('option', { name: 'Action' }).querySelector('[data-slot="select-item-indicator"]')).not.toBeNull()
    chooseOption(screen.getByRole('option', { name: 'Any' }))

    expect(onStateChange).toHaveBeenCalledWith(
      { ...searchState, genre: null },
      'push',
    )
  })

  it('converts year selection strings to numbers', () => {
    const onStateChange = vi.fn()
    const year = new Date().getFullYear() - 1
    render(<DiscoverSearchFilters searchState={searchState} onStateChange={onStateChange} />)

    fireEvent.click(screen.getByRole('combobox', { name: 'Year' }))
    chooseOption(screen.getByRole('option', { name: String(year) }))

    expect(onStateChange).toHaveBeenCalledWith(
      { ...searchState, year },
      'push',
    )
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
