import { describe, expect, it, vi } from 'vitest'

import { runProfileContentRead, runProfileRead } from './profile-read.functions'

const profile = {
  access: 'header',
  owner: false,
  profile: {
    avatarUrl: null,
    bannerUrl: null,
    bio: '',
    id: 'user-1',
    name: 'Mika',
    profileVisibility: 'private',
    username: 'mika',
  },
}

describe('authenticated Profile reads', () => {
  it('strictly parses profile transport output', async () => {
    await expect(runProfileRead(
      { username: 'mika' },
      async () => profile,
    )).resolves.toEqual(profile)
  })

  it('routes validated content tabs without changing cursor input', async () => {
    const query = vi.fn(async () => ({ items: [], cursor: null, hasMore: false }))
    await runProfileContentRead(
      { username: 'mika', tab: 'reviews', cursor: 'next' },
      query,
    )
    expect(query).toHaveBeenCalledWith('reviews', {
      username: 'mika',
      cursor: 'next',
    })
  })

  it('preserves explicit authorization errors', async () => {
    await expect(runProfileRead(
      { username: 'mika' },
      async () => { throw new Error('PROFILE_NOT_AUTHORIZED') },
    )).rejects.toThrow('PROFILE_NOT_AUTHORIZED')
  })
})
