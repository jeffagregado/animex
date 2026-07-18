// @vitest-environment jsdom

import { QueryClient, dehydrate, hydrate } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

import { PublicAuthStateProvider, usePublicAuthState } from '../shell/public-auth-context'
import { authStateQueryOptions } from './auth-state-query'

const Status = ({ label }: { label: string }) => {
  const state = usePublicAuthState()
  return createElement('p', null, `${label}: ${state.status}`)
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('shares one provider auth request with every public Profile consumer', async () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ status: 'signedOut' }),
  }) as Response)
  vi.stubGlobal('fetch', fetchMock)

  render(createElement(
    PublicAuthStateProvider,
    null,
    createElement(
      'section',
      { 'aria-label': 'Auth consumers' },
      createElement(Status, { label: 'Shell' }),
      createElement(Status, { label: 'Profile' }),
    ),
  ))

  const consumers = within(screen.getByRole('region', { name: 'Auth consumers' }))
  await consumers.findByText('Shell: ready')
  expect(consumers.getByText('Profile: ready')).toBeTruthy()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('reuses the server-prefetched auth query after dehydration and hydration', async () => {
  const query = vi.fn(async () => ({ status: 'signedOut' as const }))
  const server = new QueryClient()
  const options = { ...authStateQueryOptions(), queryFn: query }
  await server.ensureQueryData(options)

  const browser = new QueryClient()
  hydrate(browser, dehydrate(server))
  await browser.ensureQueryData(options)

  expect(query).toHaveBeenCalledTimes(1)
  expect(options.staleTime).toBeGreaterThan(0)
})
