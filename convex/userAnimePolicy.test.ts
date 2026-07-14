import { describe, expect, test } from 'vitest'

import {
  applyFavorite,
  applyProgressTransition,
  createMilestoneInsert,
  createMilestoneTimestampPatch,
  decideStatusChange,
  normalizeScore,
  rollbackRewatch,
  toSavedResult,
} from './userAnimePolicy'
import { requireCachedAnimeWith } from './userAnime'

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

  test('formats frozen mutation envelopes', () => {
    const entry = { anilistId: 1, status: null }
    expect(toSavedResult(entry)).toEqual({ status: 'saved', entry })
  })

  test('enforces cached anime identity before user operations', async () => {
    await expect(requireCachedAnimeWith(0, async () => ({ id: 0 }))).rejects.toThrow('positive safe integer')
    await expect(requireCachedAnimeWith(1, async () => null)).rejects.toThrow('loaded before saving')
    await expect(requireCachedAnimeWith(1, async (id) => ({ id }))).resolves.toBeUndefined()
  })

  test('keeps milestone visibility on bumps', () => {
    expect(createMilestoneInsert('owner', 1, 'rewatched', 'private', 100)).toEqual({
      userId: 'owner', anilistId: 1, kind: 'rewatched', visibility: 'private', occurredAt: 100, updatedAt: 100,
    })
    expect(createMilestoneTimestampPatch(200)).toEqual({ occurredAt: 200, updatedAt: 200 })
  })

  test('applies progress deltas across counted and excluded statuses', () => {
    const empty = { watching: 0, completed: 0, planned: 0, dropped: 0 }
    const watching = applyProgressTransition(null, 'watching', empty)
    expect(watching).toEqual({ watching: 1, completed: 0, planned: 0, dropped: 0 })

    const completed = applyProgressTransition('watching', 'completed', watching)
    expect(completed).toEqual({ watching: 0, completed: 1, planned: 0, dropped: 0 })

    const planned = applyProgressTransition('completed', 'planned', completed)
    expect(planned).toEqual({ watching: 0, completed: 0, planned: 1, dropped: 0 })

    const dropped = applyProgressTransition('planned', 'dropped', planned)
    expect(dropped).toEqual({ watching: 0, completed: 0, planned: 0, dropped: 1 })

    expect(applyProgressTransition('dropped', 'rewatched', dropped)).toEqual(empty)
    expect(applyProgressTransition('rewatched', null, empty)).toEqual(empty)
    expect(applyProgressTransition('rewatched', 'completed', empty)).toEqual({ ...empty, completed: 1 })
  })

  test('keeps repeated progress status writes idempotent', () => {
    const counts = { watching: 2, completed: 1, planned: 3, dropped: 4 }
    expect(applyProgressTransition('planned', 'planned', counts)).toEqual(counts)
    expect(applyProgressTransition(null, 'rewatched', counts)).toEqual(counts)
    expect(counts).toEqual({ watching: 2, completed: 1, planned: 3, dropped: 4 })
  })

  test('rejects progress underflow instead of hiding projection drift', () => {
    const empty = { watching: 0, completed: 0, planned: 0, dropped: 0 }
    expect(() => applyProgressTransition('watching', 'completed', empty)).toThrow('watching count cannot be negative')
  })
})
