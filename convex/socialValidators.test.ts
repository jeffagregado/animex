import { readFileSync } from 'node:fs'

import { describe, expect, test } from 'vitest'

describe('social Convex validators', () => {
  test('does not expose public any validators', () => {
    for (const file of ['convex/feed.ts', 'convex/reviews.ts']) {
      expect(readFileSync(file, 'utf8')).not.toContain('v.any()')
    }
  })

  test('keeps legacy Post cleanup internal, paginated, and action-free', () => {
    const source = readFileSync('convex/postMediaMigration.ts', 'utf8')
    expect(source).toContain('paginationOptsValidator')
    expect(source).toContain('internalMutation')
    expect(source).toContain('internalQuery')
    expect(source).not.toContain('internalAction')
    expect(source).not.toContain(".query('posts').collect()")
    expect(source).not.toContain(".query('postImages').collect()")
    expect(source).not.toContain(".query('feedCards').collect()")
  })
})
