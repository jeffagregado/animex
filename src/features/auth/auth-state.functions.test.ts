import { describe, expect, it } from 'vitest'

import { runAuthStateQuery } from './auth-state.functions'

describe('server auth state', () => {
  it('returns strict sanitized auth state', async () => {
    await expect(runAuthStateQuery(async () => ({
      status: 'complete',
      email: 'mika@example.com',
      profile: {
        id: 'profile-1',
        username: 'mika',
        name: 'Mika',
        avatarUrl: null,
        visibility: 'public',
      },
    }))).resolves.toMatchObject({ status: 'complete' })
  })

  it.each([
    ['transport', async () => { throw new Error('network down') }],
    ['shape', async () => ({ status: 'complete', rawSession: true })],
  ])('raises AUTH_STATE_UNAVAILABLE for %s failure', async (_label, query) => {
    await expect(runAuthStateQuery(query)).rejects.toThrow('AUTH_STATE_UNAVAILABLE')
  })
})
