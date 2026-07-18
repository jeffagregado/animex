// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps, ComponentType } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { UserAvatar } from './user-avatar'

type FeedbackAvatarProps = Omit<ComponentProps<typeof UserAvatar>, 'size'> & {
  size: ComponentProps<typeof UserAvatar>['size'] | 'search' | 'profile'
}
const FeedbackUserAvatar = UserAvatar as ComponentType<FeedbackAvatarProps>

afterEach(cleanup)

describe('UserAvatar', () => {
  it('renders a labelled cover-cropped image', () => {
    render(<UserAvatar avatarUrl="https://example.test/mika.jpg" displayName="Mika" label="Mika avatar" size="md" />)
    const image = screen.getByRole('img', { name: 'Mika avatar' })
    expect(image.className).toContain('object-cover')
    expect(image.className).toContain('rounded-full')
  })

  it('uses uppercase initial fallback for missing and failed images', () => {
    const view = render(<UserAvatar avatarUrl={null} displayName="mika" label="Mika avatar" size="sm" />)
    expect(screen.getByLabelText('Mika avatar').textContent).toBe('M')
    view.rerender(<UserAvatar avatarUrl="https://example.test/broken.jpg" displayName="mika" label="Mika avatar" size="sm" />)
    fireEvent.error(screen.getByRole('img'))
    expect(screen.getByLabelText('Mika avatar').textContent).toBe('M')
  })

  it('resets image failure when URL changes', () => {
    const view = render(<UserAvatar avatarUrl="https://example.test/one.jpg" displayName="Mika" label="Mika avatar" size="lg" />)
    fireEvent.error(screen.getByRole('img'))
    view.rerender(<UserAvatar avatarUrl="https://example.test/two.jpg" displayName="Mika" label="Mika avatar" size="lg" />)
    expect(screen.getByRole('img').getAttribute('src')).toBe('https://example.test/two.jpg')
  })

  it('retries the same URL after an intervening missing URL', () => {
    const avatarUrl = 'https://example.test/reused.jpg'
    const view = render(<UserAvatar avatarUrl={avatarUrl} displayName="Mika" label="Mika avatar" size="md" />)
    fireEvent.error(screen.getByRole('img'))
    view.rerender(<UserAvatar avatarUrl={null} displayName="Mika" label="Mika avatar" size="md" />)
    view.rerender(<UserAvatar avatarUrl={avatarUrl} displayName="Mika" label="Mika avatar" size="md" />)
    expect(screen.getByRole('img').getAttribute('src')).toBe(avatarUrl)
  })

  it('shows explicit unavailable state for an empty name', () => {
    render(<UserAvatar avatarUrl={null} displayName="   " label="Unknown avatar" size="md" />)
    expect(screen.getByLabelText('Unknown avatar').textContent).toBe('?')
  })

  it.each([['sm', 'size-8'], ['md', 'size-11'], ['lg', 'size-12']] as const)('uses stable %s geometry', (size, className) => {
    render(<UserAvatar avatarUrl={null} displayName="Mika" label={`${size} avatar`} size={size} />)
    expect(screen.getByLabelText(`${size} avatar`).className).toContain(className)
  })

  it.each([
    ['search', ['size-16'], ['text-2xl']],
    ['profile', ['size-24', 'sm:size-32'], ['text-4xl', 'sm:text-5xl']],
  ] as const)('uses locked %s fallback geometry', (size, boxClasses, glyphClasses) => {
    render(
      <FeedbackUserAvatar
        avatarUrl={null}
        displayName="Mika"
        label={`${size} avatar`}
        size={size}
      />,
    )
    const avatar = screen.getByRole('img', { name: `${size} avatar` })
    for (const boxClass of boxClasses) expect(avatar.className).toContain(boxClass)
    for (const glyphClass of glyphClasses) expect(avatar.className).toContain(glyphClass)
    expect(avatar.className).toContain('aspect-square')
    expect(avatar.className).toContain('overflow-hidden')
  })
})
