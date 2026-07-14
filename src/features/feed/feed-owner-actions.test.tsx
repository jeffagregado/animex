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

beforeEach(() => { mocks.index = 0; mocks.postVisibility.mockResolvedValue(null); mocks.removePost.mockResolvedValue(null); mocks.activityVisibility.mockResolvedValue(null); mocks.removeActivity.mockResolvedValue(null) })
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
    expect(trigger.hasAttribute('data-popup-open')).toBe(true)
    expect(trigger.className).toContain('data-popup-open:bg-cyan-300/10')
    expect(trigger.className).toContain('data-popup-open:ring-2')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete Post' }))
    expect(await screen.findByRole('dialog', { name: 'Delete Post?' })).toBeTruthy()
  })

  it('exposes pending visibility state on the overflow trigger and restores focus', async () => {
    let resolve!: (value: null) => void
    mocks.postVisibility.mockReturnValueOnce(new Promise<null>((done) => { resolve = done }))
    render(<FeedOwnerActions card={{ id: 'card', kind: 'post', postId: 'post', author, text: 'Post', imageIds: [], imageUrls: [], hasSpoiler: false, visibility: 'public', createdAt: 1, updatedAt: 1 }} onChanged={() => undefined} onEdit={() => undefined} />)
    const trigger = screen.getByRole('button', { name: 'Owner actions' })
    trigger.focus()
    fireEvent.click(trigger)
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Followers' }))
    await waitFor(() => expect(mocks.postVisibility).toHaveBeenCalledWith({ postId: 'post', visibility: 'followers' }))
    expect(trigger.hasAttribute('disabled')).toBe(true)
    expect(trigger.getAttribute('aria-busy')).toBe('true')
    expect(trigger.className).toContain('disabled:bg-cyan-300/10')
    expect(trigger.className).toContain('disabled:opacity-100')
    resolve(null)
    await waitFor(() => expect(trigger.hasAttribute('disabled')).toBe(false))
    expect(document.activeElement).toBe(trigger)
  })

  it('disables confirmation controls while deletion is pending', async () => {
    let resolve!: (value: null) => void
    mocks.removePost.mockReturnValueOnce(new Promise<null>((done) => { resolve = done }))
    render(<FeedOwnerActions card={{ id: 'card', kind: 'post', postId: 'post', author, text: 'Post', imageIds: [], imageUrls: [], hasSpoiler: false, visibility: 'public', createdAt: 1, updatedAt: 1 }} onChanged={() => undefined} onEdit={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Owner actions' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete Post' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
    const confirm = await screen.findByRole('button', { name: 'Deleting…' })
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    expect(confirm.hasAttribute('disabled')).toBe(true)
    expect(confirm.className).toContain('disabled:cursor-wait')
    expect(confirm.className).toContain('disabled:bg-red-500/60')
    expect(cancel.hasAttribute('disabled')).toBe(true)
    expect(cancel.className).toContain('disabled:cursor-wait')
    expect(cancel.className).toContain('disabled:bg-white/5')
    resolve(null)
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Post deleted.'))
  })

  it('returns focus to the overflow trigger when deletion is cancelled', async () => {
    render(<FeedOwnerActions card={{ id: 'card', kind: 'post', postId: 'post', author, text: 'Post', imageIds: [], imageUrls: [], hasSpoiler: false, visibility: 'public', createdAt: 1, updatedAt: 1 }} onChanged={() => undefined} onEdit={() => undefined} />)
    const trigger = screen.getByRole('button', { name: 'Owner actions' })
    fireEvent.click(trigger)
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete Post' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})
