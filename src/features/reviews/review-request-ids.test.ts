import { describe, expect, it, vi } from 'vitest'

import {
  createReviewRequestState,
  getReviewRequestId,
  settleReviewRequest,
} from './review-request-ids'

describe('Review request IDs', () => {
  it('uses distinct stable IDs for Draft and Publish intents', () => {
    const makeId = vi.fn().mockReturnValueOnce('draft-1').mockReturnValueOnce('publish-1')
    let state = createReviewRequestState()
    const draft = getReviewRequestId(state, 'draft', 'payload', makeId)
    state = draft.state
    const draftRetry = getReviewRequestId(state, 'draft', 'payload', makeId)
    state = draftRetry.state
    const publish = getReviewRequestId(state, 'publish', 'payload', makeId)

    expect([draft.id, draftRetry.id, publish.id]).toEqual(['draft-1', 'draft-1', 'publish-1'])
  })

  it('uses a fresh Draft ID after edits or a successful save', () => {
    const makeId = vi.fn().mockReturnValueOnce('draft-1').mockReturnValueOnce('draft-2').mockReturnValueOnce('draft-3')
    let state = getReviewRequestId(createReviewRequestState(), 'draft', 'payload-a', makeId).state
    const edited = getReviewRequestId(state, 'draft', 'payload-b', makeId)
    state = settleReviewRequest(edited.state, 'draft', edited.id)
    const savedAgain = getReviewRequestId(state, 'draft', 'payload-b', makeId)

    expect([edited.id, savedAgain.id]).toEqual(['draft-2', 'draft-3'])
  })
})
