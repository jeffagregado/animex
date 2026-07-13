export type ReviewRequestIntent = 'draft' | 'publish'
type RequestEntry = { id: string; payload: string; settled: boolean }
export type ReviewRequestState = Record<ReviewRequestIntent, RequestEntry | null>

/** Starts empty request tracking for independent Draft and Publish intents. */
export const createReviewRequestState = (): ReviewRequestState => ({ draft: null, publish: null })

/** Reuses only an unsettled identical logical retry; otherwise creates a fresh ID. */
export const getReviewRequestId = (
  state: ReviewRequestState,
  intent: ReviewRequestIntent,
  payload: string,
  makeId: () => string,
): { id: string; state: ReviewRequestState } => {
  const current = state[intent]
  if (current && !current.settled && current.payload === payload) return { id: current.id, state }
  const entry = { id: makeId(), payload, settled: false }
  return { id: entry.id, state: { ...state, [intent]: entry } }
}

/** Marks exactly one successful logical request; future clicks get a new ID. */
export const settleReviewRequest = (state: ReviewRequestState, intent: ReviewRequestIntent, id: string): ReviewRequestState => {
  const current = state[intent]
  return current?.id === id ? { ...state, [intent]: { ...current, settled: true } } : state
}
