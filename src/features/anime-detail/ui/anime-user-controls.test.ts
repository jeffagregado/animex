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
  entry: { animeId: 'anime_frieren', status: 'watching', score: 7, isFavorite: true, favoriteChangedAt: 1, rewatchCount: 0, createdAt: 1, updatedAt: 1 } as UserAnimeEntry | undefined,
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
  controlState.entry = { animeId: 'anime_frieren', status: 'watching', score: 7, isFavorite: true, favoriteChangedAt: 1, rewatchCount: 0, createdAt: 1, updatedAt: 1 }
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
    expect(getAnimeAuthDestination(loading, '/anime/anime_frieren/frieren')).toBeNull()
    expect(getAnimeAuthDestination({ status: 'ready', authState: { status: 'signedOut' } }, '/anime/anime_frieren/frieren?tab=staff')).toBe('/auth/sign-in?returnTo=%2Fanime%2Fanime_frieren%2Ffrieren%3Ftab%3Dstaff')
    expect(getAnimeAuthDestination({ status: 'ready', authState: { status: 'emailUnverified', email: 'a@example.com' } }, '/anime/anime_frieren/frieren')).toContain('/auth/verify-email')
    expect(getAnimeAuthDestination({ status: 'ready', authState: { status: 'needsProfile', email: 'a@example.com', signupMethod: 'password', suggestedUsername: null } }, '/anime/anime_frieren/frieren?tab=characters')).toBe('/auth/username?returnTo=%2Fanime%2Fanime_frieren%2Ffrieren%3Ftab%3Dcharacters')
    expect(getAnimeAuthDestination({ status: 'ready', authState: { status: 'complete', email: 'a@example.com', profile: { id: '1', username: 'a', name: 'A', avatarUrl: null, visibility: 'private' } } }, '/anime/anime_frieren/frieren')).toBeNull()
  })

  it('gates private queries until public and Convex auth both complete', () => {
    const complete: ClientAuthState = { status: 'ready', authState: { status: 'complete', email: 'a@example.com', profile: { id: '1', username: 'a', name: 'A', avatarUrl: null, visibility: 'private' } } }
    expect(canQueryUserAnime(complete, false)).toBe(false)
    expect(canQueryUserAnime(complete, true)).toBe(true)
    expect(canQueryUserAnime({ status: 'loading' }, true)).toBe(false)
  })

  it('replaces first-page history after mutation and deduplicates cursor pages', () => {
    const first = [{ id: 'a', animeId: 'anime_frieren', completedAt: 1 }]
    const next = [{ id: 'a', animeId: 'anime_frieren', completedAt: 1 }, { id: 'b', animeId: 'anime_frieren', completedAt: 2 }]
    expect(reconcileRewatchItems(first, next, null)).toEqual(next)
    expect(reconcileRewatchItems(first, next, 'cursor')).toEqual([first[0], next[1]])
  })

  it('shows signed-out visitors auth links and no private controls', () => {
    controlState.auth = { status: 'ready', authState: { status: 'signedOut' } }
    controlState.convexAuth = { isAuthenticated: false, isLoading: false }
    controlState.entry = undefined
    render(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren?tab=staff' }))

    const returnTo = '%2Fanime%2Fanime_frieren%2Ffrieren%3Ftab%3Dstaff'
    expect(screen.getByRole('link', { name: 'Status' }).getAttribute('href')).toBe(`/auth/sign-in?returnTo=${returnTo}`)
    expect(screen.getByRole('link', { name: 'Status' }).className).toContain('focus-visible:ring-cyan-300')
    expect(screen.getByRole('link', { name: 'Status' }).textContent).toContain('Set status')
    expect(screen.getByRole('link', { name: 'Score' }).getAttribute('href')).toBe(`/auth/sign-in?returnTo=${returnTo}`)
    expect(screen.getByRole('link', { name: 'Score' }).textContent).toContain('0')
    expect(screen.getByRole('link', { name: 'Favorite' }).getAttribute('href')).toBe(`/auth/sign-in?returnTo=${returnTo}`)
    expect(screen.queryByRole('combobox', { name: 'Status' })).toBeNull()
    expect(screen.queryByRole('textbox', { name: 'Score' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Rewatch history' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Write review' })).toBeNull()
  })

  it('keeps loading auth states as disabled facades without auth links', () => {
    controlState.auth = { status: 'loading' }
    controlState.convexAuth = { isAuthenticated: false, isLoading: true }
    render(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren' }))

    expect(screen.queryByRole('link', { name: 'Status' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Status' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Score' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Favorite' }).hasAttribute('disabled')).toBe(true)

    cleanup()
    controlState.auth = { status: 'ready', authState: { status: 'complete', email: 'a@example.com', profile: { id: '1', username: 'a', name: 'A', avatarUrl: null, visibility: 'private' } } }
    render(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren' }))
    expect(screen.queryByRole('link', { name: 'Status' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Status' }).hasAttribute('disabled')).toBe(true)
  })

  it('shows an actionable error when settled auth sources disagree', () => {
    controlState.convexAuth = { isAuthenticated: false, isLoading: false }
    render(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren' }))

    expect(screen.getByRole('alert').textContent).toContain('Authentication is unavailable')
    expect(screen.getByRole('button', { name: 'Refresh authentication' })).toBeTruthy()
    expect(controlState.query).not.toHaveBeenCalled()
    expect(controlState.mutationIndex).toBe(0)
  })

  it('shows an actionable error when the public auth check fails', () => {
    controlState.auth = { status: 'error', message: 'Auth state check failed.' }
    controlState.convexAuth = { isAuthenticated: false, isLoading: false }
    render(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren' }))

    expect(screen.getByRole('alert').textContent).toContain('Auth state check failed.')
    expect(screen.getByRole('button', { name: 'Refresh authentication' })).toBeTruthy()
    expect(controlState.query).not.toHaveBeenCalled()
    expect(controlState.mutationIndex).toBe(0)
  })

  it('keeps full controls and eligible rewatch history for complete users', () => {
    render(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren' }))

    expect(screen.getByRole('combobox', { name: 'Status' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Score' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Favorite' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Rewatch history' })).toBeTruthy()
  })

  it('disables complete-user controls while the private entry query loads', () => {
    controlState.entry = undefined
    render(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren' }))

    expect(screen.getByRole('combobox', { name: 'Status' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('textbox', { name: 'Score' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Favorite' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Rewatch history' }).hasAttribute('disabled')).toBe(true)
  })

  it('shows the reference-aligned controls with an unscored default of zero', () => {
    controlState.entry = { animeId: 'anime_frieren', status: null, score: null, isFavorite: false, favoriteChangedAt: null, rewatchCount: 0, createdAt: 1, updatedAt: 1 }
    render(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren' }))

    const score = screen.getByRole('textbox', { name: 'Score' })
    expect(score.getAttribute('min')).toBe('0')
    expect(score.getAttribute('max')).toBe('10')
    expect(score.getAttribute('step')).toBe('0.5')
    expect(score.getAttribute('value')).toBe('')
    expect(score.getAttribute('placeholder')).toBe('0')
    expect(screen.getByRole('button', { name: 'Decrease score' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Increase score' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Clear score' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Rewatch history' }).className).toContain('min-h-14')
    expect(controlState.score).not.toHaveBeenCalled()
  })

  it('persists an explicitly entered zero from an unset score', async () => {
    controlState.entry = { animeId: 'anime_frieren', status: null, score: null, isFavorite: false, favoriteChangedAt: null, rewatchCount: 0, createdAt: 1, updatedAt: 1 }
    render(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren' }))

    const score = screen.getByRole('textbox', { name: 'Score' })
    fireEvent.keyDown(score, { key: '0' })
    fireEvent.change(score, { target: { value: '0' } })
    fireEvent.blur(score)

    await waitFor(() => expect(controlState.score).toHaveBeenCalledWith({ animeId: 'anime_frieren', score: 0 }))
  })

  it('replaces the visual zero without prefixing typed scores', () => {
    controlState.entry = { animeId: 'anime_frieren', status: null, score: null, isFavorite: false, favoriteChangedAt: null, rewatchCount: 0, createdAt: 1, updatedAt: 1 }
    render(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren' }))

    const score = screen.getByRole('textbox', { name: 'Score' }) as HTMLInputElement
    fireEvent.click(score)
    expect(score.selectionStart).toBe(0)
    expect(score.selectionEnd).toBe(score.getAttribute('value')?.length)
    fireEvent.change(score, { target: { value: '' } })
    fireEvent.change(score, { target: { value: '8' } })
    fireEvent.change(score, { target: { value: '8.7' } })

    expect(score.getAttribute('value')).toBe('8.7')
  })

  it('shows the exact Status label with the reference state indicator', () => {
    controlState.entry = { animeId: 'anime_frieren', status: 'planned', score: 0, isFavorite: false, favoriteChangedAt: null, rewatchCount: 0, createdAt: 1, updatedAt: 1 }
    render(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren' }))

    expect(screen.getByRole('combobox', { name: 'Status' }).textContent).toContain('Plan to watch')
    expect(screen.getByTestId('status-indicator').className).toContain('bg-emerald-400')
  })

  it('accepts one-decimal typed scores and rejects values with more precision', async () => {
    render(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren' }))
    const score = screen.getByRole('textbox', { name: 'Score' })

    fireEvent.change(score, { target: { value: '8.1' } })
    fireEvent.blur(score)

    await waitFor(() => expect(controlState.score).toHaveBeenCalledWith({ animeId: 'anime_frieren', score: 8.1 }))
    controlState.score.mockClear()

    fireEvent.change(score, { target: { value: '8.12' } })
    fireEvent.blur(score)

    expect((await screen.findByRole('alert')).textContent).toContain('Score must use at most one decimal place.')
    expect(score.getAttribute('aria-invalid')).toBe('true')
    expect(score.getAttribute('value')).toBe('8.1')
    expect(controlState.score).not.toHaveBeenCalled()
  })

  it('reports the score range separately from decimal precision', () => {
    render(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren' }))
    const score = screen.getByRole('textbox', { name: 'Score' })

    fireEvent.change(score, { target: { value: '11' } })
    fireEvent.blur(score)

    expect(screen.getByRole('alert').textContent).toContain('Score must be between 0 and 10.')
    expect(controlState.score).not.toHaveBeenCalled()
  })

  it('cancels a pending valid score when the next direct value is invalid', async () => {
    vi.useFakeTimers()
    render(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren' }))
    const score = screen.getByRole('textbox', { name: 'Score' })

    fireEvent.change(score, { target: { value: '8.5' } })
    fireEvent.change(score, { target: { value: '8.12' } })
    fireEvent.blur(score)
    fireEvent.keyDown(score, { key: 'Enter' })
    await act(async () => { await vi.advanceTimersByTimeAsync(750) })

    expect(screen.getByRole('alert').textContent).toContain('Score must use at most one decimal place.')
    expect(score.getAttribute('value')).toBe('8.5')
    expect(controlState.score).not.toHaveBeenCalled()
  })

  it('autosaves only latest score after 750 ms and skips unchanged values', async () => {
    vi.useFakeTimers()
    render(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren' }))

    const score = screen.getByRole('textbox', { name: 'Score' })
    fireEvent.change(score, { target: { value: '8' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(749) })
    expect(controlState.score).not.toHaveBeenCalled()
    fireEvent.change(score, { target: { value: '8.5' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(750) })
    expect(controlState.score).toHaveBeenCalledTimes(1)
    expect(controlState.score).toHaveBeenLastCalledWith({ animeId: 'anime_frieren', score: 8.5 })

    controlState.score.mockClear()
    fireEvent.change(score, { target: { value: '8.5' } })
    fireEvent.blur(score)
    await act(async () => { await vi.advanceTimersByTimeAsync(750) })
    expect(controlState.score).not.toHaveBeenCalled()
  })

  it('autosaves Status after 750 ms and flushes valid score changes on blur or Enter', async () => {
    vi.useFakeTimers()
    render(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren' }))

    fireEvent.click(screen.getByRole('combobox', { name: 'Status' }))
    fireEvent.click(screen.getByRole('option', { name: 'Completed' }))
    act(() => { vi.advanceTimersByTime(749) })
    expect(controlState.status).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(controlState.status).toHaveBeenCalledWith({ animeId: 'anime_frieren', status: 'completed' })

    controlState.score.mockClear()
    const score = screen.getByRole('textbox', { name: 'Score' })
    fireEvent.change(score, { target: { value: '9' } })
    fireEvent.blur(score)
    expect(controlState.score).toHaveBeenCalledWith({ animeId: 'anime_frieren', score: 9 })
    await act(async () => { await Promise.resolve() })

    controlState.score.mockClear()
    fireEvent.change(score, { target: { value: '9.5' } })
    fireEvent.keyDown(score, { key: 'Enter' })
    expect(controlState.score).toHaveBeenCalledWith({ animeId: 'anime_frieren', score: 9.5 })
  })

  it('keeps the Score field focused and enabled while its save is pending', async () => {
    vi.useFakeTimers()
    let resolveSave: (() => void) | null = null
    controlState.score.mockImplementationOnce(() => new Promise<null>((resolve) => { resolveSave = () => resolve(null) }))
    render(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren' }))
    const score = screen.getByRole('textbox', { name: 'Score' })

    score.focus()
    fireEvent.change(score, { target: { value: '8' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(750) })
    const disabledWhileSaving = score.hasAttribute('disabled')
    const focusedWhileSaving = document.activeElement === score
    const savingMessage = screen.queryByRole('status')?.textContent
    await act(async () => { resolveSave?.(); await Promise.resolve() })

    expect(disabledWhileSaving).toBe(false)
    expect(focusedWhileSaving).toBe(true)
    expect(savingMessage).toContain('Saving')
  })

  it('coalesces score edits made while a prior save is pending', async () => {
    vi.useFakeTimers()
    let resolveSave: (() => void) | null = null
    controlState.score.mockImplementationOnce(() => new Promise<null>((resolve) => { resolveSave = () => resolve(null) }))
    render(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren' }))
    const score = screen.getByRole('textbox', { name: 'Score' })

    fireEvent.change(score, { target: { value: '8' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(750) })
    fireEvent.change(score, { target: { value: '9' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(750) })
    const callsWhileSaving = controlState.score.mock.calls.length
    await act(async () => { resolveSave?.(); await Promise.resolve(); await vi.advanceTimersByTimeAsync(0) })

    expect(callsWhileSaving).toBe(1)
    expect(controlState.score).toHaveBeenCalledTimes(2)
    expect(controlState.score).toHaveBeenLastCalledWith({ animeId: 'anime_frieren', score: 9 })
  })

  it('preserves dirty drafts through query refreshes and failed score saves', async () => {
    const view = render(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren' }))
    const score = screen.getByRole('textbox', { name: 'Score' })

    fireEvent.change(score, { target: { value: '8.5' } })
    fireEvent.click(screen.getByRole('combobox', { name: 'Status' }))
    fireEvent.click(screen.getByRole('option', { name: 'Completed' }))
    controlState.entry = { animeId: 'anime_frieren', status: 'planned', score: 6, isFavorite: true, favoriteChangedAt: 2, rewatchCount: 0, createdAt: 1, updatedAt: 2 }
    view.rerender(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren' }))
    expect(score.getAttribute('value')).toBe('8.5')
    expect(screen.getByRole('combobox', { name: 'Status' }).textContent).toContain('Completed')

    controlState.score.mockRejectedValueOnce(new Error('Score save failed.'))
    fireEvent.blur(score)
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Score save failed.'))
    controlState.entry = { animeId: 'anime_frieren', status: 'dropped', score: 5, isFavorite: true, favoriteChangedAt: 3, rewatchCount: 0, createdAt: 1, updatedAt: 3 }
    view.rerender(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren' }))
    expect(score.getAttribute('value')).toBe('8.5')
  })

  it('flushes pending Status on trigger blur while pointer selection waits 750 ms', async () => {
    vi.useFakeTimers()
    render(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren' }))
    const trigger = screen.getByRole('combobox', { name: 'Status' })

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('option', { name: 'Completed' }))
    act(() => { vi.advanceTimersByTime(749) })
    expect(controlState.status).not.toHaveBeenCalled()
    fireEvent.blur(trigger)
    expect(controlState.status).toHaveBeenCalledWith({ animeId: 'anime_frieren', status: 'completed' })
  })

  it('flushes a Status selected by Enter in the portaled option list', () => {
    vi.useFakeTimers()
    render(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren' }))
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

    expect(controlState.status).toHaveBeenCalledWith({ animeId: 'anime_frieren', status: 'completed' })
  })

  it('steps the Base UI score field by half points with ArrowUp and ArrowDown', () => {
    render(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren' }))
    const score = screen.getByRole('textbox', { name: 'Score' })

    fireEvent.keyDown(score, { key: 'ArrowUp' })
    expect(score.getAttribute('value')).toBe('7.5')
    fireEvent.keyDown(score, { key: 'ArrowDown' })
    expect(score.getAttribute('value')).toBe('7')
  })

  it('announces successful saves and retains retryable inline errors on failures', async () => {
    render(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren' }))

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
    render(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren' }))
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
    render(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren' }))

    fireEvent.click(screen.getByRole('button', { name: 'Favorite' }))
    await waitFor(() => expect(controlState.favorite).toHaveBeenCalledWith({ animeId: 'anime_frieren', isFavorite: false }))

    expect(screen.getByRole('button', { name: 'Rewatch history' })).toBeTruthy()
  })

  it('skips private state and hides rewatch history while signed out', () => {
    controlState.auth = { status: 'ready', authState: { status: 'signedOut' } }
    controlState.convexAuth = { isAuthenticated: false, isLoading: false }
    controlState.entry = undefined
    render(createElement(AnimeUserControls, { publicId: 'anime_frieren', canonicalPath: '/anime/anime_frieren/frieren?tab=staff' }))

    expect(controlState.query).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Rewatch history' })).toBeNull()
  })
})
