import type { Visibility } from './shared/social-contracts'

const visibilityLabels: Record<Visibility, string> = {
  followers: 'Followers',
  private: 'Private',
  public: 'Public',
}

/** Returns the user-facing label for a visibility value. */
export function getVisibilityLabel(visibility: Visibility): string {
  return visibilityLabels[visibility]
}
