// @vitest-environment jsdom

import { useRef } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { QuickSearchProvider, useQuickSearchControls } from './quick-search-provider'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  provider: vi.fn(),
}))

vi.mock('../../shell/public-auth-context', () => ({
  usePublicAuthState: () => ({
    status: 'ready',
    authState: { status: 'signedOut' },
  }),
}))
vi.mock('convex/react', () => ({
  useConvex: () => ({ query: vi.fn() }),
  useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }),
}))
vi.mock('convex/server', () => ({
  makeFunctionReference: (name: string) => name,
}))
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
}))
vi.mock('../server/quick-search.functions', () => ({
  searchQuickCatalog: mocks.provider,
}))
vi.mock('./quick-search-drawer', () => ({
  QuickSearchDrawer: () => null,
}))
vi.mock('./quick-search-dialog', () => ({
  QuickSearchDialog: (props: {
    model: {
      groups: { anime: { destination: string; label: string }[] }
      inputProps: React.InputHTMLAttributes<HTMLInputElement>
      select: (destination: string) => void
    }
    onOpenChangeComplete: (open: boolean) => void
    open: boolean
  }) => (
    <div data-open={String(props.open)}>
      <input {...props.model.inputProps} />
      {props.model.groups.anime.map((row) => (
        <button key={row.destination} onClick={() => props.model.select(row.destination)} type="button">
          {row.label}
        </button>
      ))}
      <button onClick={() => props.onOpenChangeComplete(false)} type="button">
        Complete close
      </button>
    </div>
  ),
}))

function Trigger() {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const controls = useQuickSearchControls()
  return (
    <button
      onClick={() => {
        if (!triggerRef.current) throw new Error('Trigger unavailable.')
        controls.openSearch(triggerRef.current)
      }}
      ref={triggerRef}
      type="button"
    >
      Open search
    </button>
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
  mocks.navigate.mockReset()
  mocks.provider.mockReset().mockResolvedValue({
    anime: [{
      destination: '/anime/1/frieren',
      id: '1',
      imageUrl: null,
      label: 'Frieren',
      metadata: null,
    }],
    characters: [],
    staff: [],
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Quick Search close lifecycle', () => {
  it('retains successful results through select-close and resets at close completion', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    })
    render(
      <QueryClientProvider client={client}>
        <QuickSearchProvider><Trigger /></QuickSearchProvider>
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open search' }))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'frieren' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
      await Promise.resolve()
      await vi.advanceTimersByTimeAsync(0)
    })
    await act(async () => {
      await Promise.resolve()
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByRole('button', { name: 'Frieren' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Frieren' }))

    expect(screen.getByRole('button', { name: 'Frieren' })).toBeTruthy()
    expect(screen.getByText('Complete close').parentElement?.dataset.open).toBe('false')
    expect(mocks.navigate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Complete close' }))
    expect(screen.queryByRole('button', { name: 'Frieren' })).toBeNull()
    expect(mocks.navigate).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/anime/1/frieren' })
  })
})
