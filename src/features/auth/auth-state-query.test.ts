// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

import { PublicAuthStateProvider, usePublicAuthState } from '../shell/public-auth-context'

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
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
})
