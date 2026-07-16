import { describe, expect, it } from 'vitest'

import {
  activeVisibilityOptions,
  getActiveVisibilityLabel,
  getVisibilitySelection,
  getVisibleVisibilityLabel,
  resolveVisibilitySelection,
} from './visibility'

describe('social visibility embargo policy', () => {
  it('exposes Public and Private only', () => {
    expect(activeVisibilityOptions).toEqual(['public', 'private'])
    expect(getActiveVisibilityLabel('public')).toBe('Public')
    expect(getActiveVisibilityLabel('private')).toBe('Private')
  })

  it('maps a Followers account default to Private for new content', () => {
    expect(getVisibilitySelection('followers', false)).toBe('private')
  })

  it('preserves legacy Followers content until the owner selects a replacement', () => {
    expect(getVisibilitySelection('followers', true)).toBeNull()
    expect(resolveVisibilitySelection('followers', null)).toBe('followers')
    expect(resolveVisibilitySelection('followers', 'public')).toBe('public')
    expect(resolveVisibilitySelection('followers', 'private')).toBe('private')
  })

  it('suppresses Followers labels', () => {
    expect(getVisibleVisibilityLabel('followers')).toBeNull()
    expect(getVisibleVisibilityLabel('public')).toBe('Public')
    expect(getVisibleVisibilityLabel('private')).toBe('Private')
  })
})
