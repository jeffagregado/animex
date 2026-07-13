import { describe, expect, test } from 'vitest'

import { createAniListDependencies } from '../../../lib/anilist-client.server'
import { fetchAnimeDetailFromAniList, fetchAnimePeoplePageFromAniList } from './anilist-detail.server'

const runLive = process.env.ANILIST_LIVE === '1'
const rateHeaders: Array<{ limit: string | null; remaining: string | null; retryAfter: string | null }> = []
const baseLive = createAniListDependencies()
const live = {
  ...baseLive,
  fetch: async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await baseLive.fetch(input, init)
    rateHeaders.push({
      limit: response.headers.get('x-ratelimit-limit'),
      remaining: response.headers.get('x-ratelimit-remaining'),
      retryAfter: response.headers.get('retry-after'),
    })
    return response
  },
}

const expectHttpsOrNull = (value: string | null): void => {
  if (value !== null) expect(value.startsWith('https://')).toBe(true)
}

describe.runIf(runLive)('anime detail AniList live smoke', () => {
  test('fetches public detail and independent Character and Staff pages', async () => {
    const anilistId = 178789
    const detail = await fetchAnimeDetailFromAniList(anilistId, live)
    expect(detail).not.toBeNull()
    if (!detail) throw new Error('Expected known AniList detail.')

    expect(detail.anilistId).toBe(anilistId)
    expect(detail.related.length).toBeLessThanOrEqual(5)
    expect(detail.recommendations.length).toBeLessThanOrEqual(5)
    expect(detail.externalLinks.length).toBeLessThanOrEqual(8)
    expect(detail.charactersPage).toMatchObject({ currentPage: 1, perPage: 24 })
    expect(detail.staffPage).toMatchObject({ currentPage: 1, perPage: 24 })
    expect(detail.synopsis ?? '').not.toMatch(/<[^>]+>/)
    expectHttpsOrNull(detail.coverImageUrl)
    expectHttpsOrNull(detail.bannerImageUrl)
    detail.externalLinks.forEach((link) => expect(link.url.startsWith('https://')).toBe(true))

    const characters = await fetchAnimePeoplePageFromAniList(anilistId, 'characters', 2, live)
    const staff = await fetchAnimePeoplePageFromAniList(anilistId, 'staff', 2, live)
    expect(characters).toMatchObject({ currentPage: 2, perPage: 24 })
    expect(staff).toMatchObject({ currentPage: 2, perPage: 24 })
    expect(characters?.items.length ?? 25).toBeLessThanOrEqual(24)
    expect(staff?.items.length ?? 25).toBeLessThanOrEqual(24)

    console.info('AniList detail live rate headers:', JSON.stringify(rateHeaders))
  }, 60_000)
})
