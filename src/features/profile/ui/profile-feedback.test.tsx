// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProfileHeader } from './profile-header'

afterEach(cleanup)

describe('Profile feedback contract', () => {
  it('wraps long identity text and scales the phone and desktop fallback glyph', () => {
    const long = 'Mika'.repeat(80)
    render(
      <ProfileHeader
        onEditProfile={vi.fn()}
        owner={false}
        profile={{
          avatarUrl: null,
          bannerUrl: null,
          bio: long,
          id: 'profile-1',
          name: long,
          profileVisibility: 'public',
          username: long,
        }}
      />,
    )

    const heading = screen.getByRole('heading', { name: long })
    expect(heading.className).not.toContain('truncate')
    expect(heading.className).toContain('break-words')
    expect(screen.getByText(`@${long}`).className).toContain('break-all')
    expect(screen.getByText(long, { selector: 'p:not(:first-of-type)' }).className).toContain('break-words')
    const avatar = screen.getByRole('img', { name: `${long} avatar` })
    expect(avatar.className).toContain('text-4xl')
    expect(avatar.className).toContain('sm:text-5xl')
  })
})
