// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CatalogPersonSearchPage as SearchPage } from '../shared/catalog-person-contracts'
import {
  CatalogPersonSearchPage,
  resolveCatalogPersonSearchQuery,
} from './catalog-person-search-page'

const server = vi.hoisted(() => ({ searchCatalogPeople: vi.fn() }))
vi.mock('../server/catalog-person.functions', () => ({ searchCatalogPeople: server.searchCatalogPeople }))

const row = (id: number, name: string) => ({
  kind: 'character' as const,
  id,
  name,
  nativeName: null,
  imageUrl: null,
  destination: `/characters/${id}/${name.toLowerCase()}`,
})
const page = (items: ReturnType<typeof row>[], currentPage: number, hasNextPage: boolean): SearchPage => ({
  items,
  currentPage,
  hasNextPage,
  perPage: 20,
})
const renderPage = (query: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(<QueryClientProvider client={client}><CatalogPersonSearchPage kind="character" onQuerySubmit={vi.fn()} query={query} /></QueryClientProvider>)
}

afterEach(() => {
  cleanup()
  server.searchCatalogPeople.mockReset()
  vi.unstubAllGlobals()
})

describe('CatalogPersonSearchPage', () => {
  it('preserves distinct missing, minimum, valid, and maximum query states', () => {
    expect(resolveCatalogPersonSearchQuery(undefined)).toEqual({
      canonicalSearch: {},
      error: null,
      query: '',
      shouldReplace: false,
      shouldRequest: false,
    })
    expect(resolveCatalogPersonSearchQuery(' x ')).toMatchObject({
      canonicalSearch: { q: 'x' },
      query: 'x',
      shouldReplace: true,
      shouldRequest: false,
    })
    expect(resolveCatalogPersonSearchQuery(' Ab ')).toMatchObject({
      canonicalSearch: { q: 'Ab' },
      query: 'Ab',
      shouldReplace: true,
      shouldRequest: true,
    })
    expect(resolveCatalogPersonSearchQuery('x'.repeat(100))).toMatchObject({
      query: 'x'.repeat(100),
      shouldRequest: true,
    })
    expect(resolveCatalogPersonSearchQuery('x'.repeat(101))).toMatchObject({
      canonicalSearch: { q: 'x'.repeat(101) },
      error: 'Search query must be 100 characters or fewer.',
      query: 'x'.repeat(101),
      shouldRequest: false,
    })
  })

  it('does not request for one or 101 characters', () => {
    renderPage('x')
    expect(screen.getByText(/Enter at least 2 characters/)).toBeTruthy()
    cleanup()
    renderPage('x'.repeat(101))
    expect(screen.getByRole('alert').textContent).toContain('100 characters or fewer')
    expect(server.searchCatalogPeople).not.toHaveBeenCalled()
  })

  it('requests ordered pages and globally deduplicates canonical IDs', async () => {
    server.searchCatalogPeople
      .mockResolvedValueOnce(page([row(2, 'Second'), row(1, 'First')], 1, true))
      .mockResolvedValueOnce(page([row(2, 'Duplicate'), row(3, 'Third')], 2, false))
    renderPage('Frieren')
    await screen.findByText('Second')
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    await screen.findByText('Third')
    expect(screen.getAllByRole('link').map((link) => within(link).getByRole('heading').textContent)).toEqual(['Second', 'First', 'Third'])
    expect(screen.queryByText('Duplicate')).toBeNull()
    expect(server.searchCatalogPeople.mock.calls.map(([input]) => input.data)).toEqual([
      { kind: 'character', query: 'Frieren', page: 1 },
      { kind: 'character', query: 'Frieren', page: 2 },
    ])
  })

  it('serializes observer and manual same-tick continuation', async () => {
    let intersect!: IntersectionObserverCallback
    let resolveNext!: (value: SearchPage) => void
    const deferred = new Promise<SearchPage>((resolve) => { resolveNext = resolve })
    class Observer {
      constructor(callback: IntersectionObserverCallback) { intersect = callback }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', Observer)
    server.searchCatalogPeople.mockResolvedValueOnce(page([row(1, 'First')], 1, true)).mockReturnValueOnce(deferred)
    renderPage('ab')
    await screen.findByText('First')
    act(() => {
      intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
      fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    })
    await waitFor(() => expect(server.searchCatalogPeople).toHaveBeenCalledTimes(2))
    resolveNext(page([row(2, 'Second')], 2, false))
    expect(await screen.findByText('Second')).toBeTruthy()
  })

  it('auto-continues empty and duplicate-only pages, then retains rows on retry', async () => {
    server.searchCatalogPeople
      .mockResolvedValueOnce(page([], 1, true))
      .mockResolvedValueOnce(page([row(1, 'First')], 2, true))
      .mockResolvedValueOnce(page([row(1, 'Duplicate')], 3, true))
      .mockRejectedValueOnce(new Error('Provider unavailable.'))
      .mockResolvedValueOnce(page([row(2, 'Second')], 4, false))
    renderPage('ab')
    await screen.findByText('First')
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Provider unavailable.')
    expect(screen.getByText('First')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Second')).toBeTruthy()
  })

  it('retries page two after an empty first page continuation fails', async () => {
    server.searchCatalogPeople
      .mockResolvedValueOnce(page([], 1, true))
      .mockRejectedValueOnce(new Error('Page unavailable.'))
      .mockResolvedValueOnce(page([row(1, 'First')], 2, false))
    renderPage('ab')
    expect((await screen.findByRole('alert')).textContent).toContain('Page unavailable.')
    expect(screen.queryByText('No characters found.')).toBeNull()
    expect(screen.queryByText('End of results.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('First')).toBeTruthy()
    expect(server.searchCatalogPeople.mock.calls.map(([input]) => input.data.page)).toEqual([
      1,
      2,
      2,
    ])
  })

  it('does not mix late results across A to B to A URL restoration', async () => {
    let resolveA!: (value: SearchPage) => void
    const deferredA = new Promise<SearchPage>((resolve) => { resolveA = resolve })
    server.searchCatalogPeople
      .mockReturnValueOnce(deferredA)
      .mockResolvedValueOnce(page([row(2, 'Beta')], 1, false))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const view = render(<QueryClientProvider client={client}><CatalogPersonSearchPage kind="character" onQuerySubmit={vi.fn()} query="Alpha" /></QueryClientProvider>)
    view.rerender(<QueryClientProvider client={client}><CatalogPersonSearchPage kind="character" onQuerySubmit={vi.fn()} query="Beta" /></QueryClientProvider>)
    expect(await screen.findByText('Beta')).toBeTruthy()
    await act(async () => {
      resolveA(page([row(1, 'Alpha')], 1, false))
      await deferredA
    })
    expect(screen.queryByText('Alpha')).toBeNull()
    view.rerender(<QueryClientProvider client={client}><CatalogPersonSearchPage kind="character" onQuerySubmit={vi.fn()} query="Alpha" /></QueryClientProvider>)
    expect(await screen.findByText('Alpha')).toBeTruthy()
    expect(screen.queryByText('Beta')).toBeNull()
  })
})
