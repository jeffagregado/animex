import { describe, expect, it, vi } from 'vitest'

import { runUserSearch, runUserSearchPreview } from './user-search.functions'

const user = {
  avatarUrl: null,
  id: 'user-1',
  name: 'Mika',
  username: 'mika',
}

describe('authenticated User search', () => {
  it('pins paginated search to twenty rows', async () => {
    const query = vi.fn(async () => ({
      continueCursor: '',
      isDone: true,
      page: [user],
    }))
    await runUserSearch({ query: 'mi', cursor: null }, query)
    expect(query).toHaveBeenCalledWith({
      query: 'mi',
      paginationOpts: { cursor: null, numItems: 20 },
    })
  })

  it('strictly parses five-row preview output', async () => {
    await expect(runUserSearchPreview(
      { query: 'mi' },
      async () => [user],
    )).resolves.toEqual([user])
  })

  it('preserves explicit authorization failures', async () => {
    await expect(runUserSearchPreview(
      { query: 'mi' },
      async () => { throw new Error('UNAUTHENTICATED') },
    )).rejects.toThrow('UNAUTHENTICATED')
  })
})
