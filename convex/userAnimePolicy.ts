export type AnimeStatus = 'watching' | 'planned' | 'dropped' | 'completed' | 'rewatched'

export interface UserAnimeProgress {
  watching: number
  completed: number
  planned: number
  dropped: number
}

type ProgressKey = keyof UserAnimeProgress

/** Maps only statuses represented by List Progress. */
const getProgressKey = (status: AnimeStatus | null): ProgressKey | null => status === 'rewatched' ? null : status

/** Applies one status transition to immutable List Progress counts. */
export const applyProgressTransition = (
  previous: AnimeStatus | null,
  next: AnimeStatus | null,
  counts: UserAnimeProgress,
): UserAnimeProgress => {
  const previousKey = getProgressKey(previous)
  const nextKey = getProgressKey(next)
  if (previousKey === nextKey) return { ...counts }

  const updated = { ...counts }
  if (previousKey !== null) {
    if (updated[previousKey] <= 0) throw new RangeError(`${previousKey} count cannot be negative.`)
    updated[previousKey] -= 1
  }
  if (nextKey !== null) updated[nextKey] += 1
  return updated
}

/** Wraps saved user state in the frozen mutation result contract. */
export const toSavedResult = <T>(entry: T) => ({ status: 'saved' as const, entry })

/** Builds a new milestone with visibility captured only at creation. */
export const createMilestoneInsert = <TUserId>(
  userId: TUserId,
  anilistId: number,
  kind: 'completed' | 'rewatched',
  visibility: 'private' | 'followers' | 'public',
  now: number,
) => ({ userId, anilistId, kind, visibility, occurredAt: now, updatedAt: now })

/** Bumps milestone time without changing its settled visibility. */
export const createMilestoneTimestampPatch = (now: number) => ({ occurredAt: now, updatedAt: now })

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
