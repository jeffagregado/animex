// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FeedCard } from '../social/shared/social-contracts'
import { FeedOwnerActions } from './feed-owner-actions'

const mocks = vi.hoisted(() => ({ mutationNames: [] as string[], postVisibility: vi.fn(), removePost: vi.fn(), activityVisibility: vi.fn(), removeActivity: vi.fn(), reviewVisibility: vi.fn(), removeReviewActivity: vi.fn(), removeReview: vi.fn(), success: vi.fn(), error: vi.fn() }))
vi.mock('convex/react', async () => {
  const { getFunctionName } = await vi.importActual<typeof import('convex/server')>('convex/server')
  const mutations = { 'posts:setVisibility': mocks.postVisibility, 'posts:remove': mocks.removePost, 'feed:setActivityVisibility': mocks.activityVisibility, 'feed:removeActivity': mocks.removeActivity, 'reviews:setVisibility': mocks.reviewVisibility, 'reviews:removeActivity': mocks.removeReviewActivity, 'reviews:remove': mocks.removeReview }
  return { useMutation: (mutation: Parameters<typeof getFunctionName>[0]) => { const name = getFunctionName(mutation); mocks.mutationNames.push(name); return mutations[name as keyof typeof mutations] } }
})
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }))

const author = { id: 'owner', username: 'owner', displayName: 'Owner', avatarUrl: null }
const anime = { anilistId: 1, slug: 'anime', title: 'Anime', coverImageUrl: null, format: null, seasonYear: null }

beforeEach(() => { mocks.mutationNames.length = 0; mocks.postVisibility.mockResolvedValue(null); mocks.removePost.mockResolvedValue(null); mocks.activityVisibility.mockResolvedValue(null); mocks.removeActivity.mockResolvedValue(null); mocks.reviewVisibility.mockResolvedValue(null); mocks.removeReviewActivity.mockResolvedValue(null); mocks.removeReview.mockResolvedValue(null) })
afterEach(() => { cleanup(); Object.values(mocks).forEach((value) => { if (typeof value === 'function' && 'mockClear' in value) value.mockClear() }) })

const removeThroughMenu = async (card: Extract<FeedCard, { kind: 'post' | 'completed' | 'rewatched' }>) => {
  render(<FeedOwnerActions card={card} onChanged={() => undefined} onEdit={() => undefined} />)
  fireEvent.click(screen.getByRole('button', { name: 'Owner actions' }))
  const deleteItem = await screen.findByRole('menuitem', { name: 'Delete' })
  expect(deleteItem.getAttribute('data-variant')).toBe('destructive')
  fireEvent.click(deleteItem)
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
}

describe('FeedOwnerActions', () => {
  it('routes Post deletion with source postId', async () => {
    await removeThroughMenu({ id: 'card', kind: 'post', postId: 'post-source', author, text: 'Post', media: null, hasSpoiler: false, visibility: 'public', createdAt: 1, updatedAt: 1 })
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

  it('offers Review edit and routes Review visibility by review ID', async () => {
    render(<FeedOwnerActions card={{ id: 'review-card', kind: 'review', reviewId: 'review-source', author, anime, rating: 91, summary: 'Summary', containsSpoiler: false, visibility: 'public', publishedAt: 1, updatedAt: 1 }} onChanged={() => undefined} onEdit={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Owner actions' }))
    expect((await screen.findByRole('menuitem', { name: 'Edit Review' })).getAttribute('href')).toBe('/reviews/review-source/edit')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Followers' }))
    await waitFor(() => expect(mocks.reviewVisibility).toHaveBeenCalledWith({ reviewId: 'review-source', visibility: 'followers' }))
  })

  it('labels Review activity removal Delete while preserving activity-only behavior', async () => {
    render(<FeedOwnerActions card={{ id: 'review-card', kind: 'review', reviewId: 'review-source', author, anime, rating: 91, summary: 'Summary', containsSpoiler: false, visibility: 'public', publishedAt: 1, updatedAt: 1 }} onChanged={() => undefined} onEdit={() => undefined} />)
    expect(mocks.mutationNames).not.toContain('reviews:remove')
    fireEvent.click(screen.getByRole('button', { name: 'Owner actions' }))
    const removeItem = await screen.findByRole('menuitem', { name: 'Delete' })
    expect(removeItem.getAttribute('data-variant')).toBe('destructive')
    expect(screen.queryByRole('menuitem', { name: 'Delete Review' })).toBeNull()
    fireEvent.click(removeItem)
    expect(await screen.findByRole('dialog', { name: 'Remove feed activity?' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(mocks.removeReviewActivity).toHaveBeenCalledWith({ reviewId: 'review-source' }))
    expect(mocks.removeReview).not.toHaveBeenCalled()
    expect(mocks.success).toHaveBeenCalledWith('Activity removed.')
  })

  it('opens an overflow menu and keeps delete confirmation in a dialog', async () => {
    render(<FeedOwnerActions card={{ id: 'card', kind: 'post', postId: 'post', author, text: 'Post', media: null, hasSpoiler: false, visibility: 'public', createdAt: 1, updatedAt: 1 }} onChanged={() => undefined} onEdit={() => undefined} />)
    const trigger = screen.getByRole('button', { name: 'Owner actions' })
    expect(trigger.querySelector('svg')?.classList.contains('lucide-ellipsis')).toBe(true)
    fireEvent.click(trigger)
    expect(await screen.findByRole('menu')).toBeTruthy()
    expect(trigger.hasAttribute('data-popup-open')).toBe(true)
    expect(trigger.className).toContain('data-popup-open:bg-cyan-300/10')
    expect(trigger.className).toContain('data-popup-open:ring-2')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    expect(await screen.findByRole('dialog', { name: 'Delete Post?' })).toBeTruthy()
    expect(screen.getByText('This permanently deletes the Post.')).toBeTruthy()
  })

  it('exposes pending visibility state on the overflow trigger and restores focus', async () => {
    let resolve!: (value: null) => void
    mocks.postVisibility.mockReturnValueOnce(new Promise<null>((done) => { resolve = done }))
    render(<FeedOwnerActions card={{ id: 'card', kind: 'post', postId: 'post', author, text: 'Post', media: null, hasSpoiler: false, visibility: 'public', createdAt: 1, updatedAt: 1 }} onChanged={() => undefined} onEdit={() => undefined} />)
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
    render(<FeedOwnerActions card={{ id: 'card', kind: 'post', postId: 'post', author, text: 'Post', media: null, hasSpoiler: false, visibility: 'public', createdAt: 1, updatedAt: 1 }} onChanged={() => undefined} onEdit={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Owner actions' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
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
    render(<FeedOwnerActions card={{ id: 'card', kind: 'post', postId: 'post', author, text: 'Post', media: null, hasSpoiler: false, visibility: 'public', createdAt: 1, updatedAt: 1 }} onChanged={() => undefined} onEdit={() => undefined} />)
    const trigger = screen.getByRole('button', { name: 'Owner actions' })
    fireEvent.click(trigger)
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})
