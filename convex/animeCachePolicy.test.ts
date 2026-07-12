import { describe, expect, test } from 'vitest'

import { DISCOVER_SECTION_CONFIG } from '../src/features/discover/shared/discover-contracts'
import {
  DISCOVER_CACHE_SECTION_CONFIG,
  DiscoverCachePolicyError,
  SECTION_LEASE_DURATION_MS,
  assertActiveSectionLease,
  createSectionTiming,
  decideSectionLease,
  decideSectionLeaseRelease,
  isSectionFresh,
  resolveSectionRead,
  validateCacheWriteToken,
  validateSectionCommit,
} from './animeCachePolicy'

const summary = (anilistId: number) => ({ anilistId })

const getPolicyError = (callback: () => void): DiscoverCachePolicyError => {
  try {
    callback()
  } catch (error) {
    expect(error).toBeInstanceOf(DiscoverCachePolicyError)
    return error as DiscoverCachePolicyError
  }
  throw new Error('Expected discover cache policy to reject input.')
}

describe('discover cache policy', () => {
  test('acquires missing and expired leases, but blocks a different active owner', () => {
    expect(decideSectionLease(null, 'worker-a', 100, 200)).toEqual({
      acquired: true,
      leaseUntil: 200,
    })
    expect(decideSectionLease({ leaseId: 'worker-a', leaseUntil: 100 }, 'worker-b', 100, 200)).toEqual({
      acquired: true,
      leaseUntil: 200,
    })
    expect(decideSectionLease({ leaseId: 'worker-a', leaseUntil: 201 }, 'worker-b', 100, 200)).toEqual({
      acquired: false,
      leaseUntil: 201,
    })
  })

  test('renews a lease for its current owner', () => {
    expect(decideSectionLease({ leaseId: 'worker-a', leaseUntil: 150 }, 'worker-a', 100, 200)).toEqual({
      acquired: true,
      leaseUntil: 200,
    })
  })

  test('rejects a lease window that is not in the future', () => {
    expect(() => decideSectionLease(null, 'worker-a', 100, 100)).toThrow(DiscoverCachePolicyError)
    expect(getPolicyError(() => decideSectionLease(null, 'worker-a', 100, 100)).code).toBe('INVALID_LEASE_WINDOW')
  })

  test('requires the current worker to hold an active lease before commit', () => {
    expect(getPolicyError(() => assertActiveSectionLease(null, 'worker-a', 100)).code).toBe('LEASE_NOT_ACTIVE')
    expect(getPolicyError(() => assertActiveSectionLease({ leaseId: 'worker-b', leaseUntil: 200 }, 'worker-a', 100)).code).toBe('LEASE_NOT_OWNED')
    expect(getPolicyError(() => assertActiveSectionLease({ leaseId: 'worker-a', leaseUntil: 100 }, 'worker-a', 100)).code).toBe('LEASE_NOT_ACTIVE')
    expect(() => assertActiveSectionLease({ leaseId: 'worker-a', leaseUntil: 200 }, 'worker-a', 100)).not.toThrow()
  })

  test('releases only a matching lease and reports an active owner conflict', () => {
    expect(decideSectionLeaseRelease(null, 'worker-a', 100)).toBe(false)
    expect(decideSectionLeaseRelease({ leaseId: 'worker-a', leaseUntil: 200 }, 'worker-a', 100)).toBe(true)
    expect(decideSectionLeaseRelease({ leaseId: 'worker-a', leaseUntil: 100 }, 'worker-a', 100)).toBe(false)
    expect(decideSectionLeaseRelease({ leaseId: 'worker-a', leaseUntil: 100 }, 'worker-b', 100)).toBe(false)
    expect(getPolicyError(() => decideSectionLeaseRelease({ leaseId: 'worker-a', leaseUntil: 200 }, 'worker-b', 100)).code).toBe('LEASE_NOT_OWNED')
  })

  test('matches cache limits and TTLs frozen in shared discover contracts', () => {
    expect(DISCOVER_CACHE_SECTION_CONFIG).toEqual(DISCOVER_SECTION_CONFIG)
    expect(createSectionTiming('trending', 100)).toEqual({ refreshedAt: 100, expiresAt: 100 + 3 * 60 * 60 * 1000 })
    expect(createSectionTiming('upcoming', 100)).toEqual({ refreshedAt: 100, expiresAt: 100 + 6 * 60 * 60 * 1000 })
    expect(SECTION_LEASE_DURATION_MS).toBe(30_000)
  })

  test('rejects missing or invalid cache write tokens without exposing their values', () => {
    expect(getPolicyError(() => validateCacheWriteToken('worker-token', undefined)).code).toBe('CACHE_WRITE_TOKEN_MISSING')
    expect(getPolicyError(() => validateCacheWriteToken('wrong-token', 'worker-token')).code).toBe('CACHE_WRITE_UNAUTHORIZED')
    expect(() => validateCacheWriteToken('worker-token', 'worker-token')).not.toThrow()
  })

  test('reads fresh items in cached order and hides expired items', () => {
    expect(resolveSectionRead(
      'trending',
      { animeIds: [2, 1], refreshedAt: 90, expiresAt: 101 },
      [summary(1), summary(2)],
      100,
    )).toEqual({
      key: 'trending',
      status: 'fresh',
      section: {
        key: 'trending',
        items: [summary(2), summary(1)],
        refreshedAt: 90,
        expiresAt: 101,
      },
    })
    expect(resolveSectionRead(
      'trending',
      { animeIds: [1], refreshedAt: 90, expiresAt: 100 },
      [summary(1)],
      100,
    )).toEqual({ key: 'trending', status: 'expired', section: null })
  })

  test('identifies only present sections beyond their expiry as fresh', () => {
    expect(isSectionFresh(null, 100)).toBe(false)
    expect(isSectionFresh({ animeIds: [1], refreshedAt: 90, expiresAt: 100 }, 100)).toBe(false)
    expect(isSectionFresh({ animeIds: [1], refreshedAt: 90, expiresAt: 101 }, 100)).toBe(true)
  })

  test('reports missing sections and missing summary references explicitly', () => {
    expect(resolveSectionRead('trending', null, [], 100)).toEqual({
      key: 'trending',
      status: 'missing',
      section: null,
    })
    expect(getPolicyError(() => resolveSectionRead(
      'trending',
      { animeIds: [1], refreshedAt: 90, expiresAt: 101 },
      [],
      100,
    )).code).toBe('SUMMARY_MISSING')
  })

  test('accepts each section maximum and rejects an oversized section', () => {
    expect(() => validateSectionCommit('trending', Array.from({ length: 12 }, (_, index) => summary(index + 1)), 100, 200)).not.toThrow()
    expect(() => validateSectionCommit('seasonal', Array.from({ length: 12 }, (_, index) => summary(index + 1)), 100, 200)).not.toThrow()
    expect(() => validateSectionCommit('recommendations', Array.from({ length: 16 }, (_, index) => summary(index + 1)), 100, 200)).not.toThrow()
    expect(() => validateSectionCommit('upcoming', Array.from({ length: 10 }, (_, index) => summary(index + 1)), 100, 200)).not.toThrow()
    expect(getPolicyError(() => validateSectionCommit('upcoming', Array.from({ length: 11 }, (_, index) => summary(index + 1)), 100, 200)).code).toBe('SECTION_LIMIT_EXCEEDED')
  })

  test('rejects empty, duplicate, and expired section commits', () => {
    expect(getPolicyError(() => validateSectionCommit('trending', [], 100, 200)).code).toBe('EMPTY_SECTION')
    expect(getPolicyError(() => validateSectionCommit('trending', [summary(1), summary(1)], 100, 200)).code).toBe('DUPLICATE_ANILIST_ID')
    expect(getPolicyError(() => validateSectionCommit('trending', [summary(1)], 200, 200)).code).toBe('INVALID_SECTION_WINDOW')
  })
})
