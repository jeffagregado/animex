import { describe, expect, test } from 'vitest'

import {
  applyFavorite,
  decideStatusChange,
  normalizeScore,
  rollbackRewatch,
} from './userAnimePolicy'

describe('user anime policy', () => {
  test('accepts null or one-decimal scores from zero through ten', () => {
    expect(normalizeScore(null)).toBeNull()
    expect(normalizeScore(0)).toBe(0)
    expect(normalizeScore(10)).toBe(10)
    expect(() => normalizeScore(1.25)).toThrow()
    expect(() => normalizeScore(11)).toThrow()
  })

  test('favorite true is idempotent and off to on gets a new timestamp', () => {
    expect(applyFavorite(null, true, 100)).toBe(100)
    expect(applyFavorite(90, true, 100)).toBe(90)
    expect(applyFavorite(90, false, 100)).toBeNull()
  })

  test('completion settles once while first rewatched selection records history', () => {
    expect(decideStatusChange(null, 'completed', false)).toEqual({ createCompletion: true, recordRewatch: false })
    expect(decideStatusChange('watching', 'completed', true)).toEqual({ createCompletion: false, recordRewatch: false })
    expect(decideStatusChange('completed', 'rewatched', false)).toEqual({ createCompletion: false, recordRewatch: true })
    expect(decideStatusChange('rewatched', 'rewatched', false)).toEqual({ createCompletion: false, recordRewatch: false })
  })

  test('removing final rewatch corrects status to completed and removes milestone', () => {
    expect(rollbackRewatch([300, 200], 'rewatched')).toEqual({ milestoneAt: 200, nextStatus: 'rewatched' })
    expect(rollbackRewatch([300], 'rewatched')).toEqual({ milestoneAt: null, nextStatus: 'completed' })
  })
})
