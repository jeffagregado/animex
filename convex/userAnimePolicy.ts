export type AnimeStatus = 'watching' | 'planned' | 'dropped' | 'completed' | 'rewatched'

/** Validates a nullable score with at most one decimal place. */
export const normalizeScore = (score: number | null): number | null => {
  if (score === null) return null
  if (!Number.isFinite(score) || score < 0 || score > 10 || Math.round(score * 10) !== score * 10) {
    throw new RangeError('Score must be null or between 0 and 10 with at most one decimal place.')
  }
  return score
}

/** Applies explicit favorite state while retaining an existing on timestamp. */
export const applyFavorite = (favoriteAt: number | null, favorite: boolean, now: number): number | null => favorite
  ? favoriteAt ?? now
  : null

/** Selects milestone effects for a status change. */
export const decideStatusChange = (
  previous: AnimeStatus | null,
  next: AnimeStatus,
  hasCompletionMilestone: boolean,
) => ({
  createCompletion: next === 'completed' && !hasCompletionMilestone,
  recordRewatch: next === 'rewatched' && previous !== 'rewatched',
})

/** Rolls rewatch state back to the preceding occurrence or Completed. */
export const rollbackRewatch = (descendingTimes: number[], status: AnimeStatus | null) => ({
  milestoneAt: descendingTimes.length > 1 ? descendingTimes[1] : null,
  nextStatus: descendingTimes.length > 1 ? status : 'completed' as AnimeStatus,
})
