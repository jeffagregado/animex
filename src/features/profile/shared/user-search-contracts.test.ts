import { describe, expect, it } from 'vitest'

import {
  userSearchPageSchema,
  userSearchPreviewSchema,
} from './user-search-contracts'

const user = {
  avatarUrl: null,
  id: 'user-1',
  name: 'Mika',
  username: 'mika',
}

describe('user search wire contracts', () => {
  it('rejects raw auth fields and oversized preview responses', () => {
    expect(userSearchPreviewSchema.safeParse([{ ...user, email: 'secret@example.com' }]).success).toBe(false)
    expect(userSearchPreviewSchema.safeParse(Array.from({ length: 6 }, () => user)).success).toBe(false)
  })

  it('requires the exact paginated projection', () => {
    expect(userSearchPageSchema.safeParse({
      continueCursor: '',
      isDone: true,
      page: [user],
      rawUser: {},
    }).success).toBe(false)
  })
})
