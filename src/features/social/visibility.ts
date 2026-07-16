import type { Visibility } from './shared/social-contracts'

export const activeVisibilityOptions = ['public', 'private'] as const
export type ActiveVisibility = typeof activeVisibilityOptions[number]
export type VisibilitySelection = ActiveVisibility | null

const activeVisibilityLabels: Record<ActiveVisibility, string> = {
  private: 'Private',
  public: 'Public',
}

/** Returns a label for an active Public/Private choice. */
export function getActiveVisibilityLabel(visibility: ActiveVisibility): string {
  return activeVisibilityLabels[visibility]
}

/** Hides legacy Followers wording while retaining Public/Private labels. */
export function getVisibleVisibilityLabel(visibility: Visibility): string | null {
  return visibility === 'followers' ? null : getActiveVisibilityLabel(visibility)
}

/** Creates an active selection while preserving legacy records when requested. */
export function getVisibilitySelection(
  original: Visibility,
  preserveOriginal: boolean,
): VisibilitySelection {
  if (original !== 'followers') return original
  return preserveOriginal ? null : 'private'
}

/** Resolves a nullable legacy edit selection back to the wire contract. */
export function resolveVisibilitySelection(
  original: Visibility,
  selection: VisibilitySelection,
): Visibility {
  return selection ?? original
}
