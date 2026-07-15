// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { UserAvatar } from './user-avatar'

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

  it('shows explicit unavailable state for an empty name', () => {
    render(<UserAvatar avatarUrl={null} displayName="   " label="Unknown avatar" size="md" />)
    expect(screen.getByLabelText('Unknown avatar').textContent).toBe('?')
  })

  it.each([['sm', 'size-8'], ['md', 'size-11'], ['lg', 'size-12']] as const)('uses stable %s geometry', (size, className) => {
    render(<UserAvatar avatarUrl={null} displayName="Mika" label={`${size} avatar`} size={size} />)
    expect(screen.getByLabelText(`${size} avatar`).className).toContain(className)
  })
})
