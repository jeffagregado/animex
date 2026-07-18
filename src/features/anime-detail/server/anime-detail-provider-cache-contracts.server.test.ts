import { readFile } from 'node:fs/promises'

import { describe, expect, test } from 'vitest'

import {
  animeDetailProviderSchema,
  parseProviderAnilistId,
} from './anime-detail-provider-cache-contracts.server'

const serverSource = async (fileName: string): Promise<string> => await readFile(
  new URL(fileName, import.meta.url),
  'utf8',
)

describe('anime detail provider and cache contracts', () => {
  test('keeps numeric AniList identity in provider payload validation', () => {
    expect(animeDetailProviderSchema.shape.anilistId.parse(52991)).toBe(52991)
    expect(parseProviderAnilistId(52991)).toBe(52991)
    expect(() => parseProviderAnilistId('52991')).toThrow(
      'AniList ID must be a positive safe integer.',
    )
  })

  test('keeps provider and cache modules independent from browser-public DTOs', async () => {
    const sources = await Promise.all([
      serverSource('anime-detail-provider-cache-contracts.server.ts'),
      serverSource('anilist-detail.server.ts'),
      serverSource('anime-detail-cache.server.ts'),
    ])

    for (const source of sources) {
      expect(source).not.toContain('../shared/anime-detail-contracts')
      expect(source).not.toContain('../../discover/shared/discover-contracts')
    }
  })
})
