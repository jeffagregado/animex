import { readFileSync } from 'node:fs'

import { describe, expect, test, vi } from 'vitest'

import {
  quickCatalogSearchInputSchema,
  runQuickCatalogSearch,
  searchQuickCatalog,
} from './quick-search.functions'

const emptyResult = { anime: [], characters: [], staff: [] }

describe('Quick Search server function', () => {
  test('exports a public GET function with strict normalized input', () => {
    expect(searchQuickCatalog).toBeTypeOf('function')
    expect(quickCatalogSearchInputSchema.parse({ query: '  frieren  ' })).toEqual({
      query: 'frieren',
    })
    expect(quickCatalogSearchInputSchema.parse({ query: 'ab' })).toEqual({ query: 'ab' })
    expect(quickCatalogSearchInputSchema.parse({ query: 'x'.repeat(100) })).toEqual({
      query: 'x'.repeat(100),
    })
    expect(() => quickCatalogSearchInputSchema.parse({ query: 'x' })).toThrow()
    expect(() => quickCatalogSearchInputSchema.parse({ query: 'x'.repeat(101) })).toThrow()
    expect(() => quickCatalogSearchInputSchema.parse({ query: 'ok', user: true })).toThrow()
  })

  test('validates before invoking the runner', async () => {
    const runner = vi.fn(async () => emptyResult)

    await expect(runQuickCatalogSearch({ query: 'x' }, runner)).rejects.toThrow()
    expect(runner).not.toHaveBeenCalled()
  })

  test('invokes the runner once with normalized input', async () => {
    const runner = vi.fn(async () => emptyResult)

    await expect(runQuickCatalogSearch({ query: '  frieren  ' }, runner)).resolves.toEqual(emptyResult)
    expect(runner).toHaveBeenCalledOnce()
    expect(runner).toHaveBeenCalledWith({ query: 'frieren' })
  })

  test('preserves runner errors unchanged', async () => {
    const error = new Error('provider failed')
    const runner = vi.fn(async () => {
      throw error
    })

    await expect(runQuickCatalogSearch({ query: 'error' }, runner)).rejects.toBe(error)
  })

  test('keeps server runtime imports inside the GET handler boundary', () => {
    const source = readFileSync(new URL('./quick-search.functions.ts', import.meta.url), 'utf8')
    const imports = source
      .split('\n')
      .filter((line) => line.startsWith('import ') && !line.startsWith('import type '))
      .join('\n')

    expect(source).toContain("createServerFn({ method: 'GET' })")
    expect(source).toContain("await import('./anilist-quick-search.server')")
    expect(source).toContain("await import('../../../lib/anilist-client.server')")
    expect(imports).not.toContain('anilist-quick-search.server')
    expect(imports).not.toContain('anilist-client.server')
  })
})
