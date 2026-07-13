// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PostComposer } from './post-composer'

const mocks = vi.hoisted(() => ({ discardAll: vi.fn(async () => undefined), onCancel: vi.fn(), confirm: vi.fn() }))
vi.mock('@tanstack/react-router', () => ({ useBlocker: () => ({ status: 'idle', reset: vi.fn(), proceed: vi.fn() }) }))
vi.mock('./use-post-composer', () => ({ usePostComposer: () => ({ text: 'draft', setText: vi.fn(), images: [], hasSpoiler: false, setHasSpoiler: vi.fn(), visibility: 'public', setVisibility: vi.fn(), submitting: false, dirty: true, upload: vi.fn(), remove: vi.fn(), move: vi.fn(), submit: vi.fn(), discardAll: mocks.discardAll }) }))

afterEach(() => { cleanup(); vi.unstubAllGlobals(); mocks.discardAll.mockClear(); mocks.onCancel.mockClear() })

describe('PostComposer dirty flow', () => {
  it('uses themed AlertDialog and awaits cleanup before closing', async () => {
    vi.stubGlobal('confirm', mocks.confirm)
    render(<PostComposer initial={{ text: '', imageIds: [], imageUrls: [], hasSpoiler: false, visibility: 'public' }} onCancel={mocks.onCancel} onSaved={() => undefined} postId={null} registerClose={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(await screen.findByText('Discard unsaved Post?')).toBeTruthy()
    expect(mocks.confirm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(mocks.onCancel).toHaveBeenCalled())
    expect(mocks.discardAll).toHaveBeenCalled()
  })
})
