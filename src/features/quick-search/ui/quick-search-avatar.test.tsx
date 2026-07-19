// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { QuickSearchModel } from './use-quick-search'
import { QuickSearchResults } from './quick-search-results'

const userRow = {
  destination: '/users/mika',
  id: 'user-1',
  imageUrl: null,
  label: 'Mika',
  metadata: '@mika',
  publicId: 'user-1',
}

const model = (): QuickSearchModel => ({
  activeIndex: -1,
  groups: { anime: [], characters: [], staff: [], users: [userRow] },
  inputProps: {
    'aria-activedescendant': undefined,
    'aria-controls': 'quick-search-results',
    'aria-label': 'Search AnimeX',
    onChange: vi.fn(),
    onKeyDown: vi.fn(),
    placeholder: 'Search',
    role: 'searchbox',
    value: 'mika',
  },
  items: [{ ...userRow, group: 'users', optionId: 'quick-search-users-user-1' }],
  normalizedQuery: 'mika',
  providerError: null,
  providerLoading: false,
  queryReady: true,
  retryProvider: vi.fn(),
  retryUsers: vi.fn(),
  select: vi.fn(),
  status: '1 result available.',
  userError: null,
  userLoading: false,
  usersEligible: true,
})

afterEach(cleanup)

describe('Quick Search User avatar', () => {
  it('renders a circular labelled shared avatar and keeps fallback after image failure', () => {
    const state = model()
    state.groups.users[0] = { ...userRow, imageUrl: 'https://example.test/mika.jpg' }
    state.items[0] = { ...state.items[0], imageUrl: 'https://example.test/mika.jpg' }
    render(<QuickSearchResults model={state} />)

    const avatar = screen.getByRole('img', { name: 'Mika avatar' })
    expect(avatar.className).toContain('size-11')
    expect(avatar.className).toContain('rounded-full')
    fireEvent.error(avatar)
    expect(screen.getByRole('img', { name: 'Mika avatar' }).textContent).toBe('M')
  })
})
