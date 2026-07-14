// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PublicAuthStateProvider } from '../shell/public-auth-context'
import { FeedCardDetailPage } from './feed-card-detail-page'

const mocks = vi.hoisted(() => ({ result: null as unknown, query: vi.fn(), mutation: vi.fn(() => vi.fn()) }))
vi.mock('convex/react', () => ({ useQuery: (...args: unknown[]) => { mocks.query(...args); return mocks.result }, useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }), useMutation: mocks.mutation }))

afterEach(() => { cleanup(); mocks.query.mockClear(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const renderDetail = (cardId: string) => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ status: 'signedOut' }) }) as Response))
  return render(<PublicAuthStateProvider><FeedCardDetailPage cardId={cardId} /></PublicAuthStateProvider>)
}

describe('FeedCardDetailPage', () => {
  it('passes malformed IDs as strings and renders truthful not-found state', async () => {
    mocks.result = null
    renderDetail('not-a-convex-id')
    await screen.findByRole('heading', { name: 'Activity not found' })
    expect(mocks.query.mock.calls[0]?.[1]).toEqual({ cardId: 'not-a-convex-id' })
  })

  it('contains strict parse failures in a retryable local state', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.result = { id: 'broken', kind: 'post' }
    renderDetail('broken')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Activity unavailable' })).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('does not mount owner mutation children without Convex auth', async () => {
    mocks.mutation.mockClear()
    mocks.result = { id: 'card', kind: 'post', postId: 'post', author: { id: 'owner', username: 'owner', displayName: 'Owner', avatarUrl: null }, text: 'Public', media: null, hasSpoiler: false, visibility: 'public', createdAt: 1, updatedAt: 1 }
    renderDetail('card')
    await screen.findByText('Public')
    expect(screen.queryByRole('button', { name: 'Owner actions' })).toBeNull()
    expect(mocks.mutation).not.toHaveBeenCalled()
  })
})
