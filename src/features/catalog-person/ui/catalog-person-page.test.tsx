// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CatalogPersonState } from '../server/catalog-person-cache.server'
import { CatalogPersonPage } from './catalog-person-page'

vi.mock('./catalog-person-work-grid', () => ({
  CatalogPersonWorkGrid: ({ kind }: { kind: string }) => <div data-testid="work-grid">{kind}</div>,
}))

const characterState = (overrides: Record<string, unknown> = {}): CatalogPersonState => ({
  status: 'ready',
  entry: {
    detail: {
      kind: 'character',
      id: 7,
      name: 'Frieren',
      nativeName: 'フリーレン',
      imageUrl: null,
      description: 'An elven mage.',
      age: 'Over 1,000',
      gender: 'Female',
      birthday: null,
      bloodType: null,
      ...overrides,
    },
    refreshedAt: 1,
    expiresAt: 2,
  },
})

const staffState = (overrides: Record<string, unknown> = {}): CatalogPersonState => ({
  status: 'ready',
  entry: {
    detail: {
      kind: 'staff',
      id: 8,
      name: 'Atsumi Tanezaki',
      nativeName: null,
      imageUrl: 'https://example.com/staff.jpg',
      description: 'Japanese voice actor.',
      occupations: ['Voice Actor'],
      language: 'Japanese',
      hometown: null,
      activeYears: '2012–present',
      ...overrides,
    },
    refreshedAt: 1,
    expiresAt: 2,
  },
})

afterEach(cleanup)

describe('CatalogPersonPage', () => {
  it('renders explicit loading, not-found, and retryable error states', () => {
    const retry = vi.fn()
    const view = render(<CatalogPersonPage id={7} kind="character" onRetry={retry} onTabChange={() => undefined} state={{ status: 'loading' }} tab="overview" />)
    expect(screen.getByText('Loading character…').closest('[aria-busy="true"]')).toBeTruthy()
    view.rerender(<CatalogPersonPage id={7} kind="character" onRetry={retry} onTabChange={() => undefined} state={{ status: 'not-found' }} tab="overview" />)
    expect(screen.getByText('Character not found.')).toBeTruthy()
    view.rerender(<CatalogPersonPage id={7} kind="character" onRetry={retry} onTabChange={() => undefined} state={{ status: 'error', code: 'UPSTREAM', message: 'Provider unavailable.', retryAfterSeconds: null }} tab="overview" />)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(screen.getByRole('alert').textContent).toContain('Provider unavailable.')
    expect(retry).toHaveBeenCalledOnce()
  })

  it('renders Character identity, available facts, and empty whole sections', () => {
    const view = render(<CatalogPersonPage id={7} kind="character" onRetry={() => undefined} onTabChange={() => undefined} state={characterState()} tab="overview" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Frieren' })).toBeTruthy()
    expect(screen.getByText('フリーレン')).toBeTruthy()
    expect(screen.getByText('An elven mage.')).toBeTruthy()
    expect(screen.getByText('Over 1,000')).toBeTruthy()
    expect(screen.queryByText('Birthday')).toBeNull()
    view.rerender(<CatalogPersonPage id={7} kind="character" onRetry={() => undefined} onTabChange={() => undefined} state={characterState({ description: null, age: null, gender: null })} tab="overview" />)
    expect(screen.getByText('No biography available.')).toBeTruthy()
    expect(screen.getByText('No character facts available.')).toBeTruthy()
  })

  it('renders Staff metadata and exposes the shared Anime tab', () => {
    const view = render(<CatalogPersonPage id={8} kind="staff" onRetry={() => undefined} onTabChange={() => undefined} state={staffState()} tab="overview" />)
    expect(screen.getByText('Voice Actor')).toBeTruthy()
    expect(screen.getByText('Japanese')).toBeTruthy()
    expect(screen.getByText('2012–present')).toBeTruthy()
    expect(screen.queryByTestId('work-grid')).toBeNull()
    expect(screen.getByRole('tab', { name: 'Anime' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Works' })).toBeNull()
    view.rerender(<CatalogPersonPage id={8} kind="staff" onRetry={() => undefined} onTabChange={() => undefined} state={staffState()} tab={'anime' as never} />)
    expect(screen.getByTestId('work-grid').textContent).toContain('staff')
  })

  it('supports roving tab focus with Arrow, Home, and End keys', () => {
    const onTabChange = vi.fn()
    render(<CatalogPersonPage id={7} kind="character" onRetry={() => undefined} onTabChange={onTabChange} state={characterState()} tab="overview" />)
    const overview = screen.getByRole('tab', { name: 'Overview' })
    fireEvent.keyDown(overview, { key: 'ArrowRight' })
    expect(onTabChange).toHaveBeenLastCalledWith('anime')
    fireEvent.keyDown(overview, { key: 'End' })
    expect(onTabChange).toHaveBeenLastCalledWith('anime')
    const anime = screen.getByRole('tab', { name: 'Anime' })
    fireEvent.keyDown(anime, { key: 'Home' })
    expect(onTabChange).toHaveBeenLastCalledWith('overview')
  })
})
