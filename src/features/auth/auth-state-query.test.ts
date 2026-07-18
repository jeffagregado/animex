// @vitest-environment jsdom

import {
  QueryClient,
  QueryClientProvider,
  dehydrate,
  hydrate,
} from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

import { PublicAuthStateProvider, usePublicAuthState } from '../shell/public-auth-context'
import { authStateQueryOptions } from './auth-state-query'

const authQuery = vi.hoisted(() => vi.fn())
vi.mock('./auth-state.functions', () => ({ getAuthState: authQuery }))

const Status = ({ label }: { label: string }) => {
  const state = usePublicAuthState()
  return createElement('p', null, `${label}: ${state.status}`)
}

afterEach(() => {
  cleanup()
  authQuery.mockReset()
  vi.unstubAllGlobals()
})

it('shares one provider auth request with every public Profile consumer', async () => {
  authQuery.mockResolvedValue({ status: 'signedOut' })

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(createElement(
    QueryClientProvider,
    { client },
    createElement(
      PublicAuthStateProvider,
      null,
      createElement(
        'section',
        { 'aria-label': 'Auth consumers' },
        createElement(Status, { label: 'Shell' }),
        createElement(Status, { label: 'Profile' }),
      ),
    ),
  ))

  const consumers = within(screen.getByRole('region', { name: 'Auth consumers' }))
  await consumers.findByText('Shell: ready')
  expect(consumers.getByText('Profile: ready')).toBeTruthy()
  expect(authQuery).toHaveBeenCalledTimes(1)
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
