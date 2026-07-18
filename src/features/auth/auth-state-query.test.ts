// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

import { PublicAuthStateProvider, usePublicAuthState } from '../shell/public-auth-context'

const Status = () => {
  const state = usePublicAuthState()
  return createElement('p', null, state.status)
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('reuses one hydrated auth query across nested public and Profile boundaries', async () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ status: 'signedOut' }),
  }) as Response)
  vi.stubGlobal('fetch', fetchMock)

  render(createElement(
    PublicAuthStateProvider,
    null,
    createElement(
      PublicAuthStateProvider,
      null,
      createElement(Status),
    ),
  ))

  await screen.findByText('ready')
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
})
