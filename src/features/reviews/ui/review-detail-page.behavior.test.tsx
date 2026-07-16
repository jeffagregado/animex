// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ReviewDetailContent } from './review-detail-page'

const mocks = vi.hoisted(() => ({ query: vi.fn(), mutation: vi.fn(), auth: vi.fn(), publicAuth: vi.fn(), navigate: vi.fn(), success: vi.fn(), error: vi.fn(), visibility: vi.fn(), remove: vi.fn() }))

vi.mock('convex/react', () => ({ useQuery: mocks.query, useMutation: mocks.mutation, useConvexAuth: mocks.auth }))
vi.mock('#/features/shell/public-auth-context', () => ({ usePublicAuthState: mocks.publicAuth }))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }))
vi.mock('sonner', () => ({ toast: { error: mocks.error, success: mocks.success } }))
vi.mock('#/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: { children: React.ReactNode; onValueChange: (value: string) => void; value: string | null }) => <select aria-label="Change visibility" onChange={(event) => onValueChange(event.target.value)} value={value ?? ''}>{children}</select>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>, SelectValue: () => null, SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <option value={value}>{children}</option>,
}))

const fields = { direction: null, format: '', indent: 0, version: 1 }
const bodyJson = JSON.stringify({ version: 1, editorState: { root: { ...fields, type: 'root', children: [{ ...fields, children: [{ detail: 0, format: 0, mode: 'normal', style: '', text: 'Review body', type: 'text', version: 1 }], textFormat: 0, textStyle: '', type: 'paragraph' }] } } })
const item = (id: string, authorId: string) => ({ id, author: { id: authorId, username: `user-${id}`, displayName: `User ${id}`, avatarUrl: null }, anime: { anilistId: 1, slug: 'frieren', title: 'Frieren', coverImageUrl: null }, state: 'published', rating: 90, summary: `Summary ${id}`, containsSpoiler: false, visibility: 'public', publishedAt: 1, updatedAt: 1 })
const detail = { ...item('current', 'author-1'), bodyJson, containsSpoiler: true }
const morePage = { items: [item('current', 'author-1'), { ...item('other', 'author-2'), summary: 'Secret ending', containsSpoiler: true }], cursor: null, hasMore: false }

beforeEach(() => {
  mocks.auth.mockReturnValue({ isAuthenticated: true })
  mocks.publicAuth.mockReturnValue({ status: 'ready', authState: { status: 'complete', email: 'fan@example.com', profile: { id: 'author-1', username: 'fan', name: 'Fan', avatarUrl: null, visibility: 'public' } } })
  let mutationCall = 0
  const mutations = [mocks.visibility, mocks.remove]
  mocks.mutation.mockImplementation(() => mutations[mutationCall++ % mutations.length])
  mocks.visibility.mockResolvedValue(undefined); mocks.remove.mockResolvedValue(undefined)
  mocks.query.mockImplementation((_query, args: { reviewId?: string }) => args.reviewId ? detail : morePage)
})

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('ReviewDetailContent behavior', () => {
  it('renders owner actions and API-backed other reviews while excluding current', () => {
    render(<ReviewDetailContent reviewId="current" />)
    expect(screen.getByRole('region', { name: 'Owner actions' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Remove feed activity' })).toBeNull()
    expect(screen.getByText('Review body')).toBeTruthy()
    expect(screen.getByRole('link', { name: /User other/ }).getAttribute('href')).toBe('/reviews/other')
    expect(screen.queryByRole('link', { name: /User current/ })).toBeNull()
    expect(screen.getByText('Secret ending')).toBeTruthy()
    expect(screen.getAllByText('Spoiler')).toHaveLength(2)
    expect(screen.getByRole('img', { name: 'User current avatar' })).toBeTruthy()
  })

  it('renders explicit loading and not-found states', () => {
    mocks.query.mockReturnValue(undefined)
    const view = render(<ReviewDetailContent reviewId="missing" />)
    expect(screen.getByText('Loading Review…')).toBeTruthy()
    mocks.query.mockReturnValue(null)
    view.rerender(<ReviewDetailContent reviewId="missing" />)
    expect(screen.getByText('Review not found')).toBeTruthy()
  })

  it('runs owner visibility and delete mutations with effects', async () => {
    render(<ReviewDetailContent reviewId="current" />)
    fireEvent.change(screen.getByLabelText('Change visibility'), { target: { value: 'private' } })
    await waitFor(() => expect(mocks.visibility).toHaveBeenCalledWith({ reviewId: 'current', visibility: 'private' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete review' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith({ reviewId: 'current' }))
    expect(mocks.success).toHaveBeenCalledWith('Review deleted.')
    expect(mocks.navigate).toHaveBeenCalledWith(expect.objectContaining({ to: '/anime/$anilistId/$slug' }))
  })

  it.each(['public', 'private'] as const)('embargoes Followers UI and lets owner select %s', async (visibility) => {
    mocks.query.mockImplementation((_query, args: { reviewId?: string }) => args.reviewId ? { ...detail, visibility: 'followers' } : morePage)

    render(<ReviewDetailContent reviewId="current" />)

    expect(screen.queryByRole('button', { name: /Like/ })).toBeNull()
    expect(screen.queryByText(/Followers/)).toBeNull()
    const select = screen.getByLabelText('Change visibility')
    expect(select.textContent).toContain('Public')
    expect(select.textContent).toContain('Private')
    expect(select.textContent).not.toContain('Followers')

    fireEvent.change(select, { target: { value: visibility } })

    await waitFor(() => expect(mocks.visibility).toHaveBeenCalledWith({ reviewId: 'current', visibility }))
  })
})
