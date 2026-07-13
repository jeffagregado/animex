// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FeedCard } from '../social/shared/social-contracts'
import { FeedOwnerActions } from './feed-owner-actions'

const mocks = vi.hoisted(() => ({ index: 0, postVisibility: vi.fn(), removePost: vi.fn(), activityVisibility: vi.fn(), removeActivity: vi.fn(), success: vi.fn(), error: vi.fn() }))
vi.mock('convex/react', () => ({ useMutation: () => [mocks.postVisibility, mocks.removePost, mocks.activityVisibility, mocks.removeActivity][mocks.index++ % 4] }))
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }))

const author = { id: 'owner', username: 'owner', displayName: 'Owner', avatarUrl: null }
const anime = { anilistId: 1, slug: 'anime', title: 'Anime', coverImageUrl: null }

beforeEach(() => { mocks.index = 0; mocks.removePost.mockResolvedValue(null); mocks.removeActivity.mockResolvedValue(null) })
afterEach(() => { cleanup(); Object.values(mocks).forEach((value) => { if (typeof value === 'function' && 'mockClear' in value) value.mockClear() }) })

const removeThroughMenu = async (card: Extract<FeedCard, { kind: 'post' | 'completed' | 'rewatched' }>) => {
  render(<FeedOwnerActions card={card} onChanged={() => undefined} onEdit={() => undefined} />)
  fireEvent.click(screen.getByRole('button', { name: 'Owner actions' }))
  fireEvent.click(await screen.findByRole('button', { name: card.kind === 'post' ? 'Delete Post' : 'Remove activity' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
}

describe('FeedOwnerActions', () => {
  it('routes Post deletion with source postId', async () => {
    await removeThroughMenu({ id: 'card', kind: 'post', postId: 'post-source', author, text: 'Post', imageIds: [], imageUrls: [], hasSpoiler: false, visibility: 'public', createdAt: 1, updatedAt: 1 })
    expect(mocks.removePost).toHaveBeenCalledWith({ postId: 'post-source' })
  })

  it('routes milestone removal with feed-card ID', async () => {
    await removeThroughMenu({ id: 'milestone-card', kind: 'completed', author, anime, settledAt: 1, visibility: 'private' })
    expect(mocks.removeActivity).toHaveBeenCalledWith({ cardId: 'milestone-card' })
  })

  it('binds milestone visibility into owner selector', async () => {
    render(<FeedOwnerActions card={{ id: 'milestone-card', kind: 'rewatched', author, anime, settledAt: 1, visibility: 'followers' }} onChanged={() => undefined} onEdit={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Owner actions' }))
    expect((await screen.findByRole('combobox', { name: 'Change visibility' })).textContent).toContain('Followers')
  })
})
