import { describe, expect, it, vi } from 'vitest'

import {
  catalogRouteIdentityInputSchema,
  runCatalogRouteIdentity,
} from './catalog-identity.functions'

describe('catalog route identity server function', () => {
  it('accepts opaque and legacy route IDs through one provider-neutral contract', () => {
    expect(catalogRouteIdentityInputSchema.parse({
      kind: 'anime',
      rawId: 'anime_frieren',
    })).toEqual({ kind: 'anime', rawId: 'anime_frieren' })
    expect(catalogRouteIdentityInputSchema.parse({
      kind: 'staff',
      rawId: '21',
    })).toEqual({ kind: 'staff', rawId: '21' })
  })

  it('rejects malformed or widened route inputs', () => {
    for (const input of [
      { kind: 'anime', rawId: '' },
      { kind: 'media', rawId: 'anime_frieren' },
      { kind: 'anime', rawId: 'anime_frieren', provider: 'anilist' },
    ]) {
      expect(() => catalogRouteIdentityInputSchema.parse(input)).toThrow()
    }
  })

  it('runs the validated identity lookup without exposing provider fields', async () => {
    const runner = vi.fn().mockResolvedValue({
      status: 'resolved',
      source: 'legacy',
      publicId: 'anime_frieren',
      kind: 'anime',
    })
    await expect(runCatalogRouteIdentity({
      kind: 'anime',
      rawId: '52991',
    }, runner)).resolves.toEqual({
      status: 'resolved',
      source: 'legacy',
      publicId: 'anime_frieren',
      kind: 'anime',
    })
    expect(runner).toHaveBeenCalledWith({ kind: 'anime', rawId: '52991' })
  })
})
