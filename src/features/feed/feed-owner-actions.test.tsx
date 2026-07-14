// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  fireEvent.click(await screen.findByRole('menuitem', { name: card.kind === 'post' ? 'Delete Post' : 'Remove activity' }))
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
    expect(await screen.findByRole('menu')).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Followers' }).getAttribute('aria-disabled')).toBe('true')
  })

  it('opens an overflow menu and keeps delete confirmation in a dialog', async () => {
    render(<FeedOwnerActions card={{ id: 'card', kind: 'post', postId: 'post', author, text: 'Post', imageIds: [], imageUrls: [], hasSpoiler: false, visibility: 'public', createdAt: 1, updatedAt: 1 }} onChanged={() => undefined} onEdit={() => undefined} />)
    const trigger = screen.getByRole('button', { name: 'Owner actions' })
    expect(trigger.querySelector('svg')?.classList.contains('lucide-ellipsis')).toBe(true)
    fireEvent.click(trigger)
    expect(await screen.findByRole('menu')).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete Post' }))
    expect(await screen.findByRole('dialog', { name: 'Delete Post?' })).toBeTruthy()
  })

  it('disables confirmation controls while deletion is pending', async () => {
    let resolve!: (value: null) => void
    mocks.removePost.mockReturnValueOnce(new Promise<null>((done) => { resolve = done }))
    render(<FeedOwnerActions card={{ id: 'card', kind: 'post', postId: 'post', author, text: 'Post', imageIds: [], imageUrls: [], hasSpoiler: false, visibility: 'public', createdAt: 1, updatedAt: 1 }} onChanged={() => undefined} onEdit={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Owner actions' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete Post' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
    expect((await screen.findByRole('button', { name: 'Deleting…' })).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(true)
    resolve(null)
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Post deleted.'))
  })
})
