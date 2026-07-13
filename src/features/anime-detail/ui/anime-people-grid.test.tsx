// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AnimeCharacter } from '../shared/anime-detail-contracts'
import { AnimePeopleGrid } from './anime-people-grid'

const server = vi.hoisted(() => ({ getAnimePeoplePage: vi.fn() }))
vi.mock('../server/anime-detail.functions', () => ({ getAnimePeoplePage: server.getAnimePeoplePage }))
const character = (anilistId: number, name: string): AnimeCharacter => ({ anilistId, name, role: 'MAIN', imageUrl: null, japaneseVoiceActor: null })

afterEach(() => { cleanup(); server.getAnimePeoplePage.mockReset() })

describe('AnimePeopleGrid', () => {
  it('shows truthful empty and terminal states', () => {
    render(<AnimePeopleGrid anilistId={1} initialPage={{ items: [], currentPage: 1, hasNextPage: false, perPage: 24 }} kind="characters" />)
    expect(screen.getByText('No characters available.')).toBeTruthy()
    cleanup()
    render(<AnimePeopleGrid anilistId={2} initialPage={{ items: [character(1, 'Frieren')], currentPage: 1, hasNextPage: false, perPage: 24 }} kind="characters" />)
    expect(screen.getByText('End of characters.')).toBeTruthy()
  })

  it('deduplicates appended pages and removes Load more at terminal page', async () => {
    server.getAnimePeoplePage.mockResolvedValueOnce({ status: 'ready', page: { items: [character(1, 'Frieren'), character(2, 'Fern')], currentPage: 2, hasNextPage: false, perPage: 24 } })
    render(<AnimePeopleGrid anilistId={1} initialPage={{ items: [character(1, 'Frieren')], currentPage: 1, hasNextPage: true, perPage: 24 }} kind="characters" />)
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    await screen.findByText('Fern')
    expect(screen.getAllByText('Frieren')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
  })

  it('retains cards and exposes only Retry after pagination failure', async () => {
    server.getAnimePeoplePage.mockRejectedValueOnce(new Error('AniList unavailable'))
    render(<AnimePeopleGrid anilistId={1} initialPage={{ items: [character(1, 'Frieren')], currentPage: 1, hasNextPage: true, perPage: 24 }} kind="characters" />)
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy())
    expect(screen.getByText('Frieren')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
  })
})
