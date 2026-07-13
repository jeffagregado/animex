import { describe, expect, it } from 'vitest'

import { parseAnimeRouteId } from './$anilistId/route'
import { serializeAnimeTab } from './$anilistId/$slug/route'

describe('anime detail route state', () => {
  it('accepts only positive safe integer route IDs', () => {
    expect(parseAnimeRouteId('154587')).toBe(154587)
    for (const value of ['0', '-1', '1.5', '12x', String(Number.MAX_SAFE_INTEGER + 1)]) expect(() => parseAnimeRouteId(value)).toThrow('AniList ID must be a positive safe integer.')
  })

  it('omits Overview and normalizes invalid tabs', () => {
    expect(serializeAnimeTab('overview')).toEqual({})
    expect(serializeAnimeTab('reviews')).toEqual({ tab: 'reviews' })
    expect(serializeAnimeTab('invalid')).toEqual({})
  })
})
