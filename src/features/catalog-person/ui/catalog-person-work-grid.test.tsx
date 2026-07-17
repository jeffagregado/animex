// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CatalogPersonWork, CatalogPersonWorkPage } from '../shared/catalog-person-contracts'
import { CatalogPersonWorkGrid } from './catalog-person-work-grid'

const server = vi.hoisted(() => ({ getCatalogPersonWorks: vi.fn() }))
vi.mock('../server/catalog-person.functions', () => ({ getCatalogPersonWorks: server.getCatalogPersonWorks }))

const work = (id: number, title: string, role: string | null = null): CatalogPersonWork => ({
  anime: { id, slug: title.toLowerCase().replaceAll(' ', '-'), title, coverImageUrl: null, format: 'TV', seasonYear: 2024 },
  role,
})
const page = (items: CatalogPersonWork[], currentPage: number, hasNextPage: boolean): CatalogPersonWorkPage => ({
  items,
  currentPage,
  hasNextPage,
  perPage: 20,
})
const ready = (value: CatalogPersonWorkPage) => ({ status: 'ready' as const, page: value })

const renderGrid = (kind: 'character' | 'staff' = 'character', personId = 7) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(<QueryClientProvider client={client}><CatalogPersonWorkGrid kind={kind} personId={personId} /></QueryClientProvider>)
}

afterEach(() => {
  cleanup()
  server.getCatalogPersonWorks.mockReset()
  vi.unstubAllGlobals()
})

describe('CatalogPersonWorkGrid', () => {
  it('shows initial loading and retryable explicit server errors', async () => {
    server.getCatalogPersonWorks.mockResolvedValueOnce({ status: 'error', code: 'UPSTREAM', message: 'Works unavailable.', retryAfterSeconds: null })
      .mockResolvedValueOnce(ready(page([work(1, 'Frieren')], 1, false)))
    renderGrid()
    expect(screen.getByText('Loading anime…').closest('[aria-busy="true"]')).toBeTruthy()
    expect((await screen.findByRole('alert')).textContent).toContain('Works unavailable.')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect((await screen.findByRole('link', { name: /Frieren/ })).getAttribute('href')).toBe('/anime/1/frieren')
  })

  it('preserves provider order and globally deduplicates first Anime identity', async () => {
    server.getCatalogPersonWorks
      .mockResolvedValueOnce(ready(page([work(2, 'Second', 'Supporting'), work(1, 'First')], 1, true)))
      .mockResolvedValueOnce(ready(page([work(2, 'Duplicate'), work(3, 'Third', 'Main')], 2, false)))
    renderGrid()
    await screen.findByText('Second')
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    await screen.findByText('Third')
    const cards = screen.getAllByRole('article')
    expect(cards.map((card) => within(card).getByRole('heading').textContent)).toEqual(['Second', 'First', 'Third'])
    expect(screen.queryByText('Duplicate')).toBeNull()
    expect(screen.getByText('End of anime.')).toBeTruthy()
  })

  it('continues empty and duplicate-only provider pages before terminal content', async () => {
    server.getCatalogPersonWorks
      .mockResolvedValueOnce(ready(page([], 1, true)))
      .mockResolvedValueOnce(ready(page([work(1, 'First')], 2, true)))
      .mockResolvedValueOnce(ready(page([work(1, 'Duplicate')], 3, true)))
      .mockResolvedValueOnce(ready(page([work(2, 'Second')], 4, false)))
    renderGrid()
    await screen.findByText('First')
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    await screen.findByText('Second')
    expect(screen.queryByText('No anime available.')).toBeNull()
    expect(server.getCatalogPersonWorks.mock.calls.map(([input]) => input.data.page)).toEqual([1, 2, 3, 4])
  })

  it('retains cards after next-page failure and retries same provider page', async () => {
    server.getCatalogPersonWorks
      .mockResolvedValueOnce(ready(page([work(1, 'First')], 1, true)))
      .mockRejectedValueOnce(new Error('Connection failed.'))
      .mockResolvedValueOnce(ready(page([work(2, 'Second')], 2, false)))
    renderGrid()
    await screen.findByText('First')
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Connection failed.')
    expect(screen.getByText('First')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Second')).toBeTruthy()
  })

  it('loads through a 240px observer while keeping manual Load more visible', async () => {
    let intersect!: IntersectionObserverCallback
    class Observer {
      constructor(callback: IntersectionObserverCallback) { intersect = callback }
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords(): IntersectionObserverEntry[] { return [] }
      root = null
      rootMargin = '240px'
      thresholds = [0]
    }
    vi.stubGlobal('IntersectionObserver', Observer)
    server.getCatalogPersonWorks
      .mockResolvedValueOnce(ready(page([work(1, 'First')], 1, true)))
      .mockResolvedValueOnce(ready(page([work(2, 'Second')], 2, false)))
    renderGrid('staff', 8)
    await screen.findByText('First')
    expect(screen.getByRole('button', { name: 'Load more' })).toBeTruthy()
    intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    expect(await screen.findByText('Second')).toBeTruthy()
    expect(server.getCatalogPersonWorks).toHaveBeenLastCalledWith({ data: { kind: 'staff', id: 8, page: 2 } })
  })

  it('serializes observer and manual triggers while the same next page is pending', async () => {
    let intersect!: IntersectionObserverCallback
    let resolvePage!: (value: ReturnType<typeof ready>) => void
    const deferredPage = new Promise<ReturnType<typeof ready>>((resolve) => { resolvePage = resolve })
    class Observer {
      constructor(callback: IntersectionObserverCallback) { intersect = callback }
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords(): IntersectionObserverEntry[] { return [] }
      root = null
      rootMargin = '240px'
      thresholds = [0]
    }
    vi.stubGlobal('IntersectionObserver', Observer)
    server.getCatalogPersonWorks
      .mockResolvedValueOnce(ready(page([work(1, 'First')], 1, true)))
      .mockReturnValueOnce(deferredPage)
    renderGrid()
    await screen.findByText('First')
    act(() => {
      intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
      intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
      fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    })
    await waitFor(() => {
      const pageTwoCalls = server.getCatalogPersonWorks.mock.calls.filter(([input]) => input.data.page === 2)
      expect(pageTwoCalls).toHaveLength(1)
    })
    await act(async () => {
      resolvePage(ready(page([work(2, 'Second')], 2, false)))
      await deferredPage
    })
    expect(await screen.findByText('Second')).toBeTruthy()
    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(server.getCatalogPersonWorks.mock.calls.filter(([input]) => input.data.page === 2)).toHaveLength(1)
  })

  it('shows final empty only after provider pagination is exhausted', async () => {
    server.getCatalogPersonWorks.mockResolvedValueOnce(ready(page([], 1, false)))
    renderGrid('staff')
    expect(await screen.findByText('No works available.')).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull())
  })
})
