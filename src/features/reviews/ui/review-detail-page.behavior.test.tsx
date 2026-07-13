// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ReviewDetailContent } from './review-detail-page'

const mocks = vi.hoisted(() => ({ query: vi.fn(), mutation: vi.fn(), auth: vi.fn(), publicAuth: vi.fn() }))

vi.mock('convex/react', () => ({ useQuery: mocks.query, useMutation: mocks.mutation, useConvexAuth: mocks.auth }))
vi.mock('#/features/shell/public-auth-context', () => ({ usePublicAuthState: mocks.publicAuth }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const fields = { direction: null, format: '', indent: 0, version: 1 }
const bodyJson = JSON.stringify({ version: 1, editorState: { root: { ...fields, type: 'root', children: [{ ...fields, children: [{ detail: 0, format: 0, mode: 'normal', style: '', text: 'Review body', type: 'text', version: 1 }], textFormat: 0, textStyle: '', type: 'paragraph' }] } } })
const item = (id: string, authorId: string) => ({ id, author: { id: authorId, username: `user-${id}`, displayName: `User ${id}`, avatarUrl: null }, anime: { anilistId: 1, slug: 'frieren', title: 'Frieren', coverImageUrl: null }, state: 'published', rating: 90, summary: `Summary ${id}`, summaryHasSpoiler: false, visibility: 'public', publishedAt: 1, updatedAt: 1 })
const detail = { ...item('current', 'author-1'), bodyJson }
const morePage = { items: [item('current', 'author-1'), item('other', 'author-2')], cursor: null, hasMore: false }

beforeEach(() => {
  mocks.auth.mockReturnValue({ isAuthenticated: true })
  mocks.publicAuth.mockReturnValue({ status: 'ready', authState: { status: 'complete', email: 'fan@example.com', profile: { id: 'author-1', username: 'fan', name: 'Fan', avatarUrl: null, visibility: 'public' } } })
  mocks.mutation.mockReturnValue(vi.fn())
  mocks.query.mockImplementation((_query, args: { reviewId?: string }) => args.reviewId ? detail : morePage)
})

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('ReviewDetailContent behavior', () => {
  it('renders owner actions and API-backed other reviews while excluding current', () => {
    render(<ReviewDetailContent reviewId="current" />)
    expect(screen.getByRole('region', { name: 'Owner actions' })).toBeTruthy()
    expect(screen.getByText('Review body')).toBeTruthy()
    expect(screen.getByRole('link', { name: /User other/ }).getAttribute('href')).toBe('/reviews/other')
    expect(screen.queryByRole('link', { name: /User current/ })).toBeNull()
  })

  it('renders explicit loading and not-found states', () => {
    mocks.query.mockReturnValue(undefined)
    const view = render(<ReviewDetailContent reviewId="missing" />)
    expect(screen.getByText('Loading Review…')).toBeTruthy()
    mocks.query.mockReturnValue(null)
    view.rerender(<ReviewDetailContent reviewId="missing" />)
    expect(screen.getByText('Review not found')).toBeTruthy()
  })
})
