import { describe, expect, test } from 'vitest'

import {
  PROFILE_BIO_MAX_LENGTH,
  PROFILE_CONTENT_PAGE_SIZE,
  PROFILE_FAVORITES_PREVIEW_SIZE,
  PROFILE_MEDIA_OUTPUT_MAX_BYTES,
  PROFILE_MEDIA_PENDING_TTL_MS,
  PROFILE_MEDIA_SOURCE_MAX_BYTES,
  PROFILE_NAME_MAX_LENGTH,
  normalizeProfileEdit,
  parseProfileMediaSource,
  parseProfileTab,
  profileEditInputSchema,
} from './profile-contracts'

describe('profile contracts', () => {
  test('locks profile limits', () => {
    expect(PROFILE_NAME_MAX_LENGTH).toBe(50)
    expect(PROFILE_BIO_MAX_LENGTH).toBe(300)
    expect(PROFILE_CONTENT_PAGE_SIZE).toBe(20)
    expect(PROFILE_FAVORITES_PREVIEW_SIZE).toBe(10)
    expect(PROFILE_MEDIA_SOURCE_MAX_BYTES).toBe(10 * 1024 * 1024)
    expect(PROFILE_MEDIA_OUTPUT_MAX_BYTES).toBe(2 * 1024 * 1024)
    expect(PROFILE_MEDIA_PENDING_TTL_MS).toBe(60 * 60 * 1000)
  })

  test('defaults an absent tab and rejects unsupported tab state', () => {
    expect(parseProfileTab(undefined)).toBe('activity')
    expect(parseProfileTab('reviews')).toBe('reviews')
    expect(parseProfileTab('favorites')).toBe('favorites')
    expect(() => parseProfileTab('likes')).toThrow('PROFILE_TAB_INVALID')
    expect(() => parseProfileTab(['activity'])).toThrow('PROFILE_TAB_INVALID')
  })

  test('normalizes exact profile edit fields', () => {
    expect(normalizeProfileEdit({
      name: ' Mika ',
      bio: '  ',
      profileVisibility: 'public',
    })).toEqual({
      name: 'Mika',
      bio: null,
      profileVisibility: 'public',
    })
    expect(normalizeProfileEdit({
      name: 'Mika',
      bio: '  Watches fantasy anime.  ',
      profileVisibility: 'private',
    })).toEqual({
      name: 'Mika',
      bio: 'Watches fantasy anime.',
      profileVisibility: 'private',
    })
  })

  test('rejects invalid and extra profile edit fields', () => {
    expect(profileEditInputSchema.safeParse({
      name: 'Mika',
      bio: null,
      profileVisibility: 'public',
      username: 'must-not-change',
    }).success).toBe(false)
    expect(() => normalizeProfileEdit({
      name: '',
      bio: null,
      profileVisibility: 'public',
    })).toThrow('PROFILE_EDIT_INVALID')
    expect(() => normalizeProfileEdit({
      name: 'x'.repeat(PROFILE_NAME_MAX_LENGTH + 1),
      bio: null,
      profileVisibility: 'public',
    })).toThrow('PROFILE_EDIT_INVALID')
    expect(() => normalizeProfileEdit({
      name: 'Mika',
      bio: 'x'.repeat(PROFILE_BIO_MAX_LENGTH + 1),
      profileVisibility: 'public',
    })).toThrow('PROFILE_EDIT_INVALID')
    expect(() => normalizeProfileEdit({
      name: 'Mika',
      bio: null,
      profileVisibility: 'followers',
    })).toThrow('PROFILE_EDIT_INVALID')
  })

  test.each(['image/jpeg', 'image/png', 'image/webp'])(
    'accepts supported %s source metadata',
    (type) => {
      const source = {
        name: 'profile-image',
        type,
        size: PROFILE_MEDIA_SOURCE_MAX_BYTES,
      }

      expect(parseProfileMediaSource(source)).toEqual(source)
    },
  )

  test('rejects unsupported, empty, oversized, and extra media metadata', () => {
    expect(() => parseProfileMediaSource({
      name: 'avatar.gif',
      type: 'image/gif',
      size: 100,
    })).toThrow('PROFILE_MEDIA_INVALID')
    expect(() => parseProfileMediaSource({
      name: 'avatar.png',
      type: 'image/png',
      size: 0,
    })).toThrow('PROFILE_MEDIA_INVALID')
    expect(() => parseProfileMediaSource({
      name: 'avatar.png',
      type: 'image/png',
      size: PROFILE_MEDIA_SOURCE_MAX_BYTES + 1,
    })).toThrow('PROFILE_MEDIA_INVALID')
    expect(() => parseProfileMediaSource({
      name: 'avatar.png',
      type: 'image/png',
      size: 100,
      userId: 'leak',
    })).toThrow('PROFILE_MEDIA_INVALID')
  })
})
