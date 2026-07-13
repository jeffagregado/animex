// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { afterEach, beforeEach, vi } from 'vitest'

import type { ClientAuthState } from '#/features/auth/use-auth-state'
import type { UserAnimeEntry } from '../shared/anime-detail-contracts'
import { AnimeUserControls, canQueryUserAnime, getAnimeAuthDestination, reconcileRewatchItems } from './anime-user-controls'

const controlState = vi.hoisted(() => ({
  auth: { status: 'ready', authState: { status: 'complete', email: 'a@example.com', profile: { id: '1', username: 'a', name: 'A', avatarUrl: null, visibility: 'private' } } } as ClientAuthState,
  convexAuth: { isAuthenticated: true, isLoading: false },
  entry: { anilistId: 1, status: 'watching', score: 7, isFavorite: true, favoriteChangedAt: 1, rewatchCount: 0, createdAt: 1, updatedAt: 1 } as UserAnimeEntry | undefined,
  favorite: vi.fn(async () => null),
  mutationIndex: 0,
  query: vi.fn(),
  score: vi.fn(async () => null),
  status: vi.fn(async () => null),
}))

const notifications = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}))

vi.mock('#/features/shell/public-auth-context', () => ({ usePublicAuthState: () => controlState.auth }))
vi.mock('convex/react', () => ({
  useConvexAuth: () => controlState.convexAuth,
  useMutation: () => [controlState.status, controlState.score, controlState.favorite][controlState.mutationIndex++ % 3],
  useQuery: (...args: unknown[]) => { controlState.query(...args); return controlState.entry },
}))
vi.mock('sonner', () => ({ toast: notifications }))

beforeEach(() => {
  controlState.auth = { status: 'ready', authState: { status: 'complete', email: 'a@example.com', profile: { id: '1', username: 'a', name: 'A', avatarUrl: null, visibility: 'private' } } }
  controlState.convexAuth = { isAuthenticated: true, isLoading: false }
  controlState.entry = { anilistId: 1, status: 'watching', score: 7, isFavorite: true, favoriteChangedAt: 1, rewatchCount: 0, createdAt: 1, updatedAt: 1 }
  controlState.mutationIndex = 0
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('anime user control policies', () => {
  it('routes only settled incomplete auth states to their required destination', () => {
    const loading: ClientAuthState = { status: 'loading' }
    expect(getAnimeAuthDestination(loading, '/anime/1/frieren')).toBeNull()
    expect(getAnimeAuthDestination({ status: 'ready', authState: { status: 'signedOut' } }, '/anime/1/frieren?tab=staff')).toBe('/auth/sign-in?returnTo=%2Fanime%2F1%2Ffrieren%3Ftab%3Dstaff')
    expect(getAnimeAuthDestination({ status: 'ready', authState: { status: 'emailUnverified', email: 'a@example.com' } }, '/anime/1/frieren')).toContain('/auth/verify-email')
    expect(getAnimeAuthDestination({ status: 'ready', authState: { status: 'needsProfile', email: 'a@example.com', signupMethod: 'password', suggestedUsername: null } }, '/anime/1/frieren?tab=characters')).toBe('/auth/username?returnTo=%2Fanime%2F1%2Ffrieren%3Ftab%3Dcharacters')
    expect(getAnimeAuthDestination({ status: 'ready', authState: { status: 'complete', email: 'a@example.com', profile: { id: '1', username: 'a', name: 'A', avatarUrl: null, visibility: 'private' } } }, '/anime/1/frieren')).toBeNull()
  })

  it('gates private queries until public and Convex auth both complete', () => {
    const complete: ClientAuthState = { status: 'ready', authState: { status: 'complete', email: 'a@example.com', profile: { id: '1', username: 'a', name: 'A', avatarUrl: null, visibility: 'private' } } }
    expect(canQueryUserAnime(complete, false)).toBe(false)
    expect(canQueryUserAnime(complete, true)).toBe(true)
    expect(canQueryUserAnime({ status: 'loading' }, true)).toBe(false)
  })

  it('replaces first-page history after mutation and deduplicates cursor pages', () => {
    const first = [{ id: 'a', anilistId: 1, completedAt: 1 }]
    const next = [{ id: 'a', anilistId: 1, completedAt: 1 }, { id: 'b', anilistId: 1, completedAt: 2 }]
    expect(reconcileRewatchItems(first, next, null)).toEqual(next)
    expect(reconcileRewatchItems(first, next, 'cursor')).toEqual([first[0], next[1]])
  })

  it('shows signed-out visitors auth links and no private controls', () => {
    controlState.auth = { status: 'ready', authState: { status: 'signedOut' } }
    controlState.convexAuth = { isAuthenticated: false, isLoading: false }
    controlState.entry = undefined
    render(createElement(AnimeUserControls, { anilistId: 1, canonicalPath: '/anime/1/frieren?tab=staff' }))

    const returnTo = '%2Fanime%2F1%2Ffrieren%3Ftab%3Dstaff'
    expect(screen.getByRole('link', { name: 'Status' }).getAttribute('href')).toBe(`/auth/sign-in?returnTo=${returnTo}`)
    expect(screen.getByRole('link', { name: 'Status' }).className).toContain('focus-visible:ring-cyan-300')
    expect(screen.getByRole('link', { name: 'Score' }).getAttribute('href')).toBe(`/auth/sign-in?returnTo=${returnTo}`)
    expect(screen.getByRole('link', { name: 'Favorite' }).getAttribute('href')).toBe(`/auth/sign-in?returnTo=${returnTo}`)
    expect(screen.queryByRole('combobox', { name: 'Status' })).toBeNull()
    expect(screen.queryByRole('textbox', { name: 'Score' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Rewatch history' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Write review' })).toBeNull()
  })

  it('keeps loading auth states as disabled facades without auth links', () => {
    controlState.auth = { status: 'loading' }
    controlState.convexAuth = { isAuthenticated: false, isLoading: true }
    render(createElement(AnimeUserControls, { anilistId: 1, canonicalPath: '/anime/1/frieren' }))

    expect(screen.queryByRole('link', { name: 'Status' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Status' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Score' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Favorite' }).hasAttribute('disabled')).toBe(true)

    cleanup()
    controlState.auth = { status: 'ready', authState: { status: 'complete', email: 'a@example.com', profile: { id: '1', username: 'a', name: 'A', avatarUrl: null, visibility: 'private' } } }
    render(createElement(AnimeUserControls, { anilistId: 1, canonicalPath: '/anime/1/frieren' }))
    expect(screen.queryByRole('link', { name: 'Status' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Status' }).hasAttribute('disabled')).toBe(true)
  })

  it('shows an actionable error when settled auth sources disagree', () => {
    controlState.convexAuth = { isAuthenticated: false, isLoading: false }
    render(createElement(AnimeUserControls, { anilistId: 1, canonicalPath: '/anime/1/frieren' }))

    expect(screen.getByRole('alert').textContent).toContain('Authentication is unavailable')
    expect(screen.getByRole('button', { name: 'Refresh authentication' })).toBeTruthy()
    expect(controlState.query).not.toHaveBeenCalled()
    expect(controlState.mutationIndex).toBe(0)
  })

  it('shows an actionable error when the public auth check fails', () => {
    controlState.auth = { status: 'error', message: 'Auth state check failed.' }
    controlState.convexAuth = { isAuthenticated: false, isLoading: false }
    render(createElement(AnimeUserControls, { anilistId: 1, canonicalPath: '/anime/1/frieren' }))

    expect(screen.getByRole('alert').textContent).toContain('Auth state check failed.')
    expect(screen.getByRole('button', { name: 'Refresh authentication' })).toBeTruthy()
    expect(controlState.query).not.toHaveBeenCalled()
    expect(controlState.mutationIndex).toBe(0)
  })

  it('keeps full controls and eligible rewatch history for complete users', () => {
    render(createElement(AnimeUserControls, { anilistId: 1, canonicalPath: '/anime/1/frieren' }))

    expect(screen.getByRole('combobox', { name: 'Status' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Score' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Favorite' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Rewatch history' })).toBeTruthy()
  })

  it('disables complete-user controls while the private entry query loads', () => {
    controlState.entry = undefined
    render(createElement(AnimeUserControls, { anilistId: 1, canonicalPath: '/anime/1/frieren' }))

    expect(screen.getByRole('combobox', { name: 'Status' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('textbox', { name: 'Score' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Favorite' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Rewatch history' }).hasAttribute('disabled')).toBe(true)
  })

  it('offers half-point score controls from zero through ten and clears to null', async () => {
    render(createElement(AnimeUserControls, { anilistId: 1, canonicalPath: '/anime/1/frieren' }))

    const score = screen.getByRole('textbox', { name: 'Score' })
    expect(score.getAttribute('min')).toBe('0')
    expect(score.getAttribute('max')).toBe('10')
    expect(score.getAttribute('step')).toBe('0.5')
    expect(screen.getByRole('button', { name: 'Decrease score' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Increase score' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Clear score' }))
    await waitFor(() => expect(controlState.score).toHaveBeenCalledWith({ anilistId: 1, score: null }))
  })

  it('rejects direct non-half-step scores with explicit feedback', async () => {
    render(createElement(AnimeUserControls, { anilistId: 1, canonicalPath: '/anime/1/frieren' }))
    const score = screen.getByRole('textbox', { name: 'Score' })

    fireEvent.change(score, { target: { value: '8.1' } })
    fireEvent.blur(score)

    expect((await screen.findByRole('alert')).textContent).toContain('Score must use 0.5 increments.')
    expect(score.getAttribute('aria-invalid')).toBe('true')
    expect(score.getAttribute('value')).toBe('7')
    expect(controlState.score).not.toHaveBeenCalled()
  })

  it('cancels a pending valid score when the next direct value is invalid', async () => {
    vi.useFakeTimers()
    render(createElement(AnimeUserControls, { anilistId: 1, canonicalPath: '/anime/1/frieren' }))
    const score = screen.getByRole('textbox', { name: 'Score' })

    fireEvent.change(score, { target: { value: '8.5' } })
    fireEvent.change(score, { target: { value: '8.1' } })
    fireEvent.blur(score)
    fireEvent.keyDown(score, { key: 'Enter' })
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })

    expect(screen.getByRole('alert').textContent).toContain('Score must use 0.5 increments.')
    expect(score.getAttribute('value')).toBe('8.5')
    expect(controlState.score).not.toHaveBeenCalled()
  })

  it('autosaves only latest score after 500 ms and skips unchanged values', async () => {
    vi.useFakeTimers()
    render(createElement(AnimeUserControls, { anilistId: 1, canonicalPath: '/anime/1/frieren' }))

    const score = screen.getByRole('textbox', { name: 'Score' })
    fireEvent.change(score, { target: { value: '8' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(499) })
    expect(controlState.score).not.toHaveBeenCalled()
    fireEvent.change(score, { target: { value: '8.5' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })
    expect(controlState.score).toHaveBeenCalledTimes(1)
    expect(controlState.score).toHaveBeenLastCalledWith({ anilistId: 1, score: 8.5 })

    controlState.score.mockClear()
    fireEvent.change(score, { target: { value: '8.5' } })
    fireEvent.blur(score)
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })
    expect(controlState.score).not.toHaveBeenCalled()
  })

  it('autosaves Status after 500 ms and flushes valid score changes on blur or Enter', () => {
    vi.useFakeTimers()
    render(createElement(AnimeUserControls, { anilistId: 1, canonicalPath: '/anime/1/frieren' }))

    fireEvent.click(screen.getByRole('combobox', { name: 'Status' }))
    fireEvent.click(screen.getByRole('option', { name: 'Completed' }))
    act(() => { vi.advanceTimersByTime(499) })
    expect(controlState.status).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(controlState.status).toHaveBeenCalledWith({ anilistId: 1, status: 'completed' })

    controlState.score.mockClear()
    const score = screen.getByRole('textbox', { name: 'Score' })
    fireEvent.change(score, { target: { value: '9' } })
    fireEvent.blur(score)
    expect(controlState.score).toHaveBeenCalledWith({ anilistId: 1, score: 9 })

    controlState.score.mockClear()
    fireEvent.change(score, { target: { value: '9.5' } })
    fireEvent.keyDown(score, { key: 'Enter' })
    expect(controlState.score).toHaveBeenCalledWith({ anilistId: 1, score: 9.5 })
  })

  it('preserves dirty drafts through query refreshes and failed score saves', async () => {
    const view = render(createElement(AnimeUserControls, { anilistId: 1, canonicalPath: '/anime/1/frieren' }))
    const score = screen.getByRole('textbox', { name: 'Score' })

    fireEvent.change(score, { target: { value: '8.5' } })
    fireEvent.click(screen.getByRole('combobox', { name: 'Status' }))
    fireEvent.click(screen.getByRole('option', { name: 'Completed' }))
    controlState.entry = { anilistId: 1, status: 'planned', score: 6, isFavorite: true, favoriteChangedAt: 2, rewatchCount: 0, createdAt: 1, updatedAt: 2 }
    view.rerender(createElement(AnimeUserControls, { anilistId: 1, canonicalPath: '/anime/1/frieren' }))
    expect(score.getAttribute('value')).toBe('8.5')
    expect(screen.getByRole('combobox', { name: 'Status' }).textContent).toContain('completed')

    controlState.score.mockRejectedValueOnce(new Error('Score save failed.'))
    fireEvent.blur(score)
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Score save failed.'))
    controlState.entry = { anilistId: 1, status: 'dropped', score: 5, isFavorite: true, favoriteChangedAt: 3, rewatchCount: 0, createdAt: 1, updatedAt: 3 }
    view.rerender(createElement(AnimeUserControls, { anilistId: 1, canonicalPath: '/anime/1/frieren' }))
    expect(score.getAttribute('value')).toBe('8.5')
  })

  it('flushes pending Status on trigger blur while pointer selection waits 500 ms', async () => {
    vi.useFakeTimers()
    render(createElement(AnimeUserControls, { anilistId: 1, canonicalPath: '/anime/1/frieren' }))
    const trigger = screen.getByRole('combobox', { name: 'Status' })

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('option', { name: 'Completed' }))
    act(() => { vi.advanceTimersByTime(499) })
    expect(controlState.status).not.toHaveBeenCalled()
    fireEvent.blur(trigger)
    expect(controlState.status).toHaveBeenCalledWith({ anilistId: 1, status: 'completed' })
  })

  it('flushes a Status selected by Enter in the portaled option list', () => {
    vi.useFakeTimers()
    render(createElement(AnimeUserControls, { anilistId: 1, canonicalPath: '/anime/1/frieren' }))
    const trigger = screen.getByRole('combobox', { name: 'Status' })

    fireEvent.focus(trigger)
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    const watching = screen.getByRole('option', { name: 'Watching' })
    fireEvent.keyDown(watching, { key: 'ArrowDown' })
    fireEvent.keyDown(watching, { key: 'ArrowDown' })
    fireEvent.keyDown(watching, { key: 'ArrowDown' })
    const completed = screen.getByRole('option', { name: 'Completed' })
    expect(document.activeElement).toBe(completed)
    fireEvent.keyDown(completed, { key: 'Enter' })

    expect(controlState.status).toHaveBeenCalledWith({ anilistId: 1, status: 'completed' })
  })

  it('steps the Base UI score field by half points with ArrowUp and ArrowDown', () => {
    render(createElement(AnimeUserControls, { anilistId: 1, canonicalPath: '/anime/1/frieren' }))
    const score = screen.getByRole('textbox', { name: 'Score' })

    fireEvent.keyDown(score, { key: 'ArrowUp' })
    expect(score.getAttribute('value')).toBe('7.5')
    fireEvent.keyDown(score, { key: 'ArrowDown' })
    expect(score.getAttribute('value')).toBe('7')
  })

  it('announces successful saves and retains retryable inline errors on failures', async () => {
    render(createElement(AnimeUserControls, { anilistId: 1, canonicalPath: '/anime/1/frieren' }))

    const score = screen.getByRole('textbox', { name: 'Score' })
    fireEvent.change(score, { target: { value: '8.5' } })
    fireEvent.blur(score)
    await waitFor(() => expect(notifications.success).toHaveBeenCalled())

    controlState.score.mockRejectedValueOnce(new Error('Score save failed.'))
    fireEvent.change(score, { target: { value: '9' } })
    fireEvent.blur(score)
    await waitFor(() => expect(notifications.error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ action: expect.objectContaining({ label: 'Retry' }) })))
    expect(screen.getByRole('alert').textContent).toContain('Score save failed.')
  })

  it('retries the exact failed save and reports a repeated failure', async () => {
    controlState.score.mockRejectedValueOnce(new Error('First score failure.')).mockRejectedValueOnce(new Error('Retry score failure.'))
    render(createElement(AnimeUserControls, { anilistId: 1, canonicalPath: '/anime/1/frieren' }))
    const score = screen.getByRole('textbox', { name: 'Score' })

    fireEvent.change(score, { target: { value: '8.5' } })
    fireEvent.blur(score)
    await screen.findByText('First score failure.')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await screen.findByText('Retry score failure.')
    expect(controlState.score).toHaveBeenCalledTimes(2)
    expect(notifications.error).toHaveBeenLastCalledWith('Retry score failure.', expect.objectContaining({ action: expect.objectContaining({ label: 'Retry' }) }))
  })

  it('toggles favorites and keeps rewatch history owner-only', async () => {
    render(createElement(AnimeUserControls, { anilistId: 1, canonicalPath: '/anime/1/frieren' }))

    fireEvent.click(screen.getByRole('button', { name: 'Favorite' }))
    await waitFor(() => expect(controlState.favorite).toHaveBeenCalledWith({ anilistId: 1, isFavorite: false }))

    expect(screen.getByRole('button', { name: 'Rewatch history' })).toBeTruthy()
  })

  it('skips private state and hides rewatch history while signed out', () => {
    controlState.auth = { status: 'ready', authState: { status: 'signedOut' } }
    controlState.convexAuth = { isAuthenticated: false, isLoading: false }
    controlState.entry = undefined
    render(createElement(AnimeUserControls, { anilistId: 1, canonicalPath: '/anime/1/frieren?tab=staff' }))

    expect(controlState.query).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Rewatch history' })).toBeNull()
  })
})
