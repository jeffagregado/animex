// @vitest-environment jsdom

import { createRef } from 'react'

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { QuickSearchGroups, QuickSearchRow } from '../shared/quick-search-contracts'
import { QuickSearchInput, QuickSearchResults } from './quick-search-results'
import type { QuickSearchItem, QuickSearchModel } from './use-quick-search'

const row = (
  id: string,
  label: string,
  destination: string,
): QuickSearchRow => ({
  destination,
  id,
  imageUrl: null,
  label,
  metadata: null,
  publicId: id,
})

const createModel = (
  groups: QuickSearchGroups,
  activeIndex: number,
  overrides: Partial<QuickSearchModel>,
): QuickSearchModel => {
  const items = (Object.entries(groups) as [keyof QuickSearchGroups, QuickSearchRow[]][])
    .flatMap(([group, rows]) => rows.map((result) => ({
      ...result,
      group,
      optionId: `quick-search-${group}-${result.publicId}`,
    } satisfies QuickSearchItem)))
  return {
    activeIndex,
    groups,
    inputProps: {
      'aria-activedescendant': activeIndex >= 0 ? items[activeIndex]?.optionId : undefined,
      'aria-controls': 'quick-search-results',
      'aria-label': 'Search AnimeX',
      onChange: vi.fn(),
      onKeyDown: vi.fn(),
      placeholder: 'Search AnimeX',
      role: 'searchbox',
      value: 'result',
    },
    items,
    normalizedQuery: 'result',
    providerError: null,
    providerLoading: false,
    queryReady: true,
    retryProvider: vi.fn(),
    retryUsers: vi.fn(),
    select: vi.fn(),
    status: `${items.length} results available.`,
    userError: null,
    userLoading: false,
    usersEligible: false,
    ...overrides,
  }
}

const groups = (
  anime: QuickSearchRow[],
  staff: QuickSearchRow[],
): QuickSearchGroups => ({
  anime,
  characters: [],
  staff,
  users: [],
})

afterEach(cleanup)

describe('QuickSearchResults interactions', () => {
  it('scrolls a newly active option beyond the viewport to the nearest edge', () => {
    const model = createModel(
      groups(
        [row('anime_result', 'Anime result', '/anime/anime_result/a')],
        [row('staff_result', 'Staff result', '/staff/staff_result/staff')],
      ),
      -1,
      {},
    )
    const view = render(<QuickSearchResults model={model} />)
    const last = screen.getByRole('option', { name: /Staff result/ })
    const scrollIntoView = vi.fn()
    last.scrollIntoView = scrollIntoView
    Object.defineProperty(last, 'getBoundingClientRect', {
      value: () => ({ bottom: 900, top: 850 }),
    })

    view.rerender(<QuickSearchResults model={{ ...model, activeIndex: 1 }} />)

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
  })

  it('announces each failed lane while retaining partial success', () => {
    const model = createModel(
      groups([row('anime_result', 'Anime result', '/anime/anime_result/a')], []),
      -1,
      {
        providerError: new Error('Provider unavailable'),
        userError: new Error('Users unavailable'),
      },
    )
    render(<QuickSearchResults model={model} />)

    expect(screen.getAllByRole('alert').map((alert) => alert.textContent)).toEqual([
      'Catalog search failed.Retry',
      'User search failed.Retry',
    ])
    expect(screen.getByText('Anime result')).toBeTruthy()
  })

  it('uses native View all links and intercepts only ordinary primary clicks', () => {
    const select = vi.fn()
    const model = createModel(
      groups([row('anime_result', 'Anime result', '/anime/anime_result/a')], []),
      -1,
      { select },
    )
    render(<QuickSearchResults model={model} />)
    const link = screen.getByRole('link', { name: /View all Anime/ })

    expect(link.getAttribute('href')).toBe('/discover?q=result')
    expect(link.querySelector('svg')).not.toBeNull()
    link.addEventListener('click', (event) => event.preventDefault(), { once: true })
    fireEvent.click(link, { ctrlKey: true })
    expect(select).not.toHaveBeenCalled()
    expect(fireEvent.click(link)).toBe(false)
    expect(select).toHaveBeenCalledWith('/discover?q=result')
  })

  it('keeps input focus ownership while active options stay untabbable', () => {
    const model = createModel(
      groups([row('anime_result', 'Anime result', '/anime/anime_result/a')], []),
      0,
      {},
    )
    const inputRef = createRef<HTMLInputElement>()
    render(
      <>
        <QuickSearchInput inputRef={inputRef} model={model} />
        <QuickSearchResults model={model} />
      </>,
    )
    inputRef.current?.focus()

    expect(document.activeElement).toBe(inputRef.current)
    expect(screen.getByRole('option').getAttribute('tabindex')).toBe('-1')
  })
})
