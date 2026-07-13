import { readFileSync } from 'node:fs'

import { describe, expect, test } from 'vitest'

describe('social Convex validators', () => {
  test('does not expose public any validators', () => {
    for (const file of ['convex/feed.ts', 'convex/reviews.ts']) {
      expect(readFileSync(file, 'utf8')).not.toContain('v.any()')
    }
  })
})
