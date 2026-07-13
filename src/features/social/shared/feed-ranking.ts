import { FEED_PAGE_SIZE, type FeedCard } from './social-contracts'

export interface FeedMergeResult {
  items: FeedCard[]
  prioritizedConsumed: number
  globalConsumed: number
  nextCycleIndex: number
}

/** Interleaves two prioritized cards then one global card with cursor-safe counts. */
export const mergeFeedCards = (
  prioritized: readonly FeedCard[],
  global: readonly FeedCard[],
  limit: number,
  initialCycleIndex: number,
): FeedMergeResult => {
  if (!Number.isInteger(limit) || limit < 1 || limit > FEED_PAGE_SIZE) {
    throw new RangeError(`Feed merge limit must be an integer from 1 through ${FEED_PAGE_SIZE}.`)
  }
  if (!Number.isInteger(initialCycleIndex) || initialCycleIndex < 0 || initialCycleIndex > 2) {
    throw new RangeError('Feed cycle index must be 0, 1, or 2.')
  }

  const items: FeedCard[] = []
  const seenIds = new Set<string>()
  let prioritizedConsumed = 0
  let globalConsumed = 0
  let cycleIndex = initialCycleIndex

  const takeNext = (lane: 'prioritized' | 'global'): FeedCard | null => {
    const source = lane === 'prioritized' ? prioritized : global
    while ((lane === 'prioritized' ? prioritizedConsumed : globalConsumed) < source.length) {
      const index = lane === 'prioritized' ? prioritizedConsumed++ : globalConsumed++
      const candidate = source[index]
      if (candidate !== undefined && !seenIds.has(candidate.id)) return candidate
    }
    return null
  }

  while (items.length < limit && (prioritizedConsumed < prioritized.length || globalConsumed < global.length)) {
    const preferredLane = cycleIndex % 3 === 2 ? 'global' : 'prioritized'
    const fallbackLane = preferredLane === 'prioritized' ? 'global' : 'prioritized'
    const candidate = takeNext(preferredLane) ?? takeNext(fallbackLane)
    if (candidate === null) break
    seenIds.add(candidate.id)
    items.push(candidate)
    cycleIndex += 1
  }

  return { items, prioritizedConsumed, globalConsumed, nextCycleIndex: cycleIndex % 3 }
}
