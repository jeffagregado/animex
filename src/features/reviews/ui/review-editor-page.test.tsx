// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMutation, useQuery } from 'convex/react'
import { useBlocker, useNavigate } from '@tanstack/react-router'

import { LoadedReviewEditor, ReviewEditorPage } from './review-editor-page'

const saveDraft = vi.fn()
const publish = vi.fn()
const update = vi.fn()
const navigate = vi.fn()
const reset = vi.fn()
const proceed = vi.fn()
const publicAuth = vi.fn()
let blockerOptions: { shouldBlockFn: () => boolean } | null = null
let blocker: { status: 'idle' | 'blocked'; reset?: () => void; proceed?: () => void } = { status: 'idle' }

vi.mock('convex/react', () => ({ useMutation: vi.fn(), useQuery: vi.fn() }))
vi.mock('@tanstack/react-router', () => ({
  useBlocker: vi.fn((options) => { blockerOptions = options; return blocker }),
  useNavigate: vi.fn(() => navigate),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('#/features/shell/public-auth-context', () => ({ usePublicAuthState: () => publicAuth() }))
vi.mock('./review-editor', () => ({ ReviewEditor: ({ onChange }: { onChange: (body: unknown) => void }) => <button onClick={() => onChange(textDocument('Body text'))} type="button">Change body</button> }))
vi.mock('./review-preview', () => ({ ReviewPreview: ({ summary }: { summary: string }) => <div>Preview: {summary}</div> }))

const fields = { direction: null, format: '' as const, indent: 0 as const, version: 1 as const }
const textDocument = (value: string) => ({ version: 1 as const, editorState: { root: { ...fields, type: 'root' as const, children: [{ ...fields, children: [{ detail: 0 as const, format: 0, mode: 'normal' as const, style: '' as const, text: value, type: 'text' as const, version: 1 as const }], textFormat: 0, textStyle: '' as const, type: 'paragraph' as const }] } } })
const anime = { anilistId: 1, coverImageUrl: null, episodes: 28, format: 'TV' as const, seasonYear: 2023, slug: 'frieren', titles: { display: 'Frieren', english: null, native: null, romaji: null } }
const published = { id: 'review-1', author: { id: 'author-1', username: 'fan', displayName: 'Fan', avatarUrl: null }, anime: { anilistId: 1, slug: 'frieren', title: 'Frieren', coverImageUrl: null }, state: 'published', rating: 90, summary: 'Published summary', containsSpoiler: false, visibility: 'public', publishedAt: 1, updatedAt: 1, bodyJson: JSON.stringify(textDocument('Published body')) }

beforeEach(() => {
  let mutationCall = 0
  const mutations = [saveDraft, publish, update]
  vi.mocked(useMutation).mockReset().mockImplementation(() => mutations[mutationCall++ % mutations.length] as unknown as ReturnType<typeof useMutation>)
  vi.mocked(useNavigate).mockReturnValue(navigate)
  vi.mocked(useQuery).mockReset().mockImplementation((...args) => args[1] === 'skip' ? undefined : published as ReturnType<typeof useQuery>)
  publicAuth.mockReturnValue({ status: 'ready', authState: { status: 'signedOut' } })
  vi.mocked(useBlocker).mockImplementation((options) => { blockerOptions = options as unknown as { shouldBlockFn: () => boolean }; return blocker as ReturnType<typeof useBlocker> })
  saveDraft.mockReset().mockResolvedValue('review-1')
  publish.mockReset().mockResolvedValue('review-1')
  update.mockReset()
  navigate.mockReset(); reset.mockReset(); proceed.mockReset()
  blocker = { status: 'idle' }
  blockerOptions = null
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValueOnce('00000000-0000-4000-8000-000000000001').mockReturnValueOnce('00000000-0000-4000-8000-000000000002').mockReturnValueOnce('00000000-0000-4000-8000-000000000003')
})

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const fillPublishableReview = (): void => {
  fireEvent.change(screen.getByLabelText(/Summary/), { target: { value: 'Patient and moving.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Change body' }))
}

describe('LoadedReviewEditor lifecycle', () => {
  it('keeps rating text intact while focused and lays out spoiler control below the field grid', () => {
    render(<LoadedReviewEditor anime={anime} defaultVisibility="private" existing={null} mode="create" />)
    const rating = screen.getByLabelText('Review Rating') as HTMLInputElement
    expect(rating.type).toBe('text')
    expect(rating.inputMode).toBe('decimal')
    expect(rating.value).toBe('50')
    fireEvent.change(rating, { target: { value: '9.' } })
    expect(rating.value).toBe('9.')
    const checkbox = screen.getByRole('checkbox', { name: 'Review contains spoiler' })
    expect(checkbox.tagName).toBe('SPAN')
    expect(checkbox.getAttribute('data-slot')).toBe('checkbox')
    expect(document.querySelector('input[type="checkbox"]')?.getAttribute('aria-hidden')).toBe('true')
    expect(checkbox.closest('[data-review-spoiler-row]')?.className).toContain('justify-end')
    fireEvent.click(screen.getByText('Review contains spoiler'))
    expect(checkbox.getAttribute('aria-checked')).toBe('true')
  })

  it('persists empty Draft rating as null and rejects empty Publish rating', async () => {
    render(<LoadedReviewEditor anime={anime} defaultVisibility="private" existing={null} mode="create" />)
    fillPublishableReview()
    fireEvent.change(screen.getByLabelText('Review Rating'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /Save draft/ }))
    await waitFor(() => expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({ rating: null })))
    fireEvent.click(screen.getByRole('button', { name: /Publish review/ }))
    expect(await screen.findByText('Published Review requires a Rating.')).toBeTruthy()
    expect(publish).not.toHaveBeenCalled()
  })

  it('rejects invalid rating text instead of clamping or persisting it', async () => {
    render(<LoadedReviewEditor anime={anime} defaultVisibility="private" existing={null} mode="create" />)
    fillPublishableReview()
    fireEvent.change(screen.getByLabelText('Review Rating'), { target: { value: '100.1' } })
    fireEvent.click(screen.getByRole('button', { name: /Save draft/ }))
    expect(await screen.findByText('Rating must be between 0 and 100 with at most one decimal.')).toBeTruthy()
    expect(saveDraft).not.toHaveBeenCalled()
  })

  it('hydrates existing rating text and persists containsSpoiler during Update', async () => {
    render(<LoadedReviewEditor anime={anime} defaultVisibility="private" existing={{ ...published, body: textDocument('Published body') } as never} mode="edit" />)
    expect((screen.getByLabelText('Review Rating') as HTMLInputElement).value).toBe('90')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Review contains spoiler' }))
    fireEvent.click(screen.getByRole('button', { name: /Update review/ }))
    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({ rating: 90, containsSpoiler: true })))
  })

  it('preserves an existing Followers Review when visibility is untouched', async () => {
    const followersReview = { ...published, body: textDocument('Published body'), visibility: 'followers' as const }
    render(<LoadedReviewEditor anime={anime} defaultVisibility="private" existing={followersReview as never} mode="edit" />)

    expect(screen.getByRole('combobox').textContent).toContain('Change visibility')
    fireEvent.change(screen.getByLabelText(/Summary/), { target: { value: 'Updated summary' } })
    fireEvent.click(screen.getByRole('button', { name: /Update review/ }))

    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({
      reviewId: 'review-1',
      visibility: 'followers',
    })))
  })

  it('migrates an existing Followers Review after explicit selection', async () => {
    const followersReview = { ...published, body: textDocument('Published body'), visibility: 'followers' as const }
    render(<LoadedReviewEditor anime={anime} defaultVisibility="private" existing={followersReview as never} mode="edit" />)

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(await screen.findByRole('option', { name: 'Public' }))
    fireEvent.click(screen.getByRole('button', { name: /Update review/ }))

    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({
      visibility: 'public',
    })))
  })

  it('offers Public and Private visibility choices only', async () => {
    render(<LoadedReviewEditor anime={anime} defaultVisibility="private" existing={null} mode="create" />)

    fireEvent.click(screen.getByRole('combobox'))

    expect(await screen.findByRole('option', { name: 'Public' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Private' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Followers' })).toBeNull()
  })

  it('disables the spoiler checkbox during Publish and preserves its state', async () => {
    publish.mockImplementation(() => new Promise(() => {}))
    render(<LoadedReviewEditor anime={anime} defaultVisibility="private" existing={null} mode="create" />)
    fillPublishableReview()
    fireEvent.click(screen.getByRole('button', { name: /Publish review/ }))
    const checkbox = screen.getByRole('checkbox', { name: 'Review contains spoiler' })
    await waitFor(() => expect(checkbox.getAttribute('aria-disabled')).toBe('true'))

    fireEvent.click(screen.getByText('Review contains spoiler'))
    expect(checkbox.getAttribute('aria-checked')).toBe('false')
    fireEvent.keyDown(checkbox, { key: ' ' })
    fireEvent.keyUp(checkbox, { key: ' ' })
    expect(checkbox.getAttribute('aria-checked')).toBe('false')
  })

  it('saves Draft then publishes with distinct intent IDs and navigates after persistence', async () => {
    render(<LoadedReviewEditor anime={anime} defaultVisibility="private" existing={null} mode="create" />)
    fillPublishableReview()
    fireEvent.click(screen.getByRole('button', { name: /Save draft/ }))
    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: /Publish review/ }))
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1))

    expect(saveDraft.mock.calls[0][0].requestId).toBe('00000000-0000-4000-8000-000000000001')
    expect(publish.mock.calls[0][0].requestId).toBe('00000000-0000-4000-8000-000000000002')
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ to: '/reviews/$reviewId', params: { reviewId: 'review-1' } })))
  })

  it('retains failed Draft fields and dirty state while reusing the logical retry ID', async () => {
    saveDraft.mockRejectedValueOnce(new Error('Network failed.')).mockResolvedValueOnce('review-1')
    render(<LoadedReviewEditor anime={anime} defaultVisibility="private" existing={null} mode="create" />)
    fillPublishableReview()
    fireEvent.click(screen.getByRole('button', { name: /Save draft/ }))
    expect(await screen.findByText('Network failed.')).toBeTruthy()
    expect((screen.getByLabelText(/Summary/) as HTMLInputElement).value).toBe('Patient and moving.')
    expect(blockerOptions?.shouldBlockFn()).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Save draft/ }))
    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(2))
    expect(saveDraft.mock.calls[1][0].requestId).toBe(saveDraft.mock.calls[0][0].requestId)
  })

  it('wires blocker Stay and Discard actions', () => {
    blocker = { status: 'blocked', reset, proceed }
    render(<LoadedReviewEditor anime={anime} defaultVisibility="private" existing={null} mode="create" />)
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }))
    expect(reset).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(proceed).toHaveBeenCalledOnce()
  })
})

describe('ReviewEditorPage existing Review routing', () => {
  it('keeps the edit surface loading until the public auth profile resolves', () => {
    publicAuth.mockReturnValue({ status: 'loading' })

    render(<ReviewEditorPage anime={null} mode="edit" reviewId="review-1" />)

    expect(screen.queryByText('Review unavailable')).toBeNull()
    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(2)
  })

  it('redirects an existing published create intent from an effect', async () => {
    render(<ReviewEditorPage anime={anime} mode="create" reviewId={null} />)
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/reviews/$reviewId', params: { reviewId: 'review-1' }, replace: true }))
  })

  it.each([
    ['public', 'Public'],
    ['private', 'Private'],
    ['followers', 'Private'],
  ] as const)('maps a new Review account %s default to %s', (visibility, label) => {
    publicAuth.mockReturnValue({ status: 'ready', authState: { status: 'complete', email: 'fan@example.test', profile: { id: 'author-1', username: 'fan', name: 'Fan', avatarUrl: null, visibility } } })
    vi.mocked(useQuery).mockReturnValue(null as ReturnType<typeof useQuery>)

    render(<ReviewEditorPage anime={anime} mode="create" reviewId={null} />)

    expect(screen.getByRole('combobox').textContent).toContain(label)
  })

  it('preserves an existing Review visibility instead of applying the account default', () => {
    publicAuth.mockReturnValue({ status: 'ready', authState: { status: 'complete', email: 'fan@example.test', profile: { id: 'author-1', username: 'fan', name: 'Fan', avatarUrl: null, visibility: 'private' } } })

    render(<ReviewEditorPage anime={null} mode="edit" reviewId="review-1" />)

    expect(screen.getByRole('combobox').textContent).toContain('Public')
  })
})
