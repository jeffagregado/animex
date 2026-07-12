import { readFileSync } from 'node:fs'

import { describe, expect, test } from 'vitest'

import { getDiscoverPage, refreshDiscoverSection, searchAnime } from './discover.functions'

describe('Discover server-function boundary', () => {
  test('declares GET reads/search and POST cache refresh', () => {
    expect(getDiscoverPage.method).toBe('GET')
    expect(searchAnime.method).toBe('GET')
    expect(refreshDiscoverSection.method).toBe('POST')
  })

  test('wires frozen input schemas into its exported server handlers', () => {
    const source = readFileSync(new URL('./discover.functions.ts', import.meta.url), 'utf8')

    expect(source).toContain('.validator(discoverSectionKeySchema)')
    expect(source).toContain('.validator(animeSearchInputSchema)')
  })
})
