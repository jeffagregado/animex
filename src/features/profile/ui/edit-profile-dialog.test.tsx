// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EditProfileDialog } from './edit-profile-dialog'

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
}))

vi.mock('convex/react', () => ({
  useMutation: () => mocks.update,
}))

const profile = {
  name: 'Rinko',
  bio: 'Seasonal reviews',
  profileVisibility: 'public' as const,
}

const renderDialog = (
  onOpenChange = vi.fn(),
  finalFocus: HTMLElement | null = null,
) => render(
  <EditProfileDialog
    finalFocus={finalFocus}
    onOpenChange={onOpenChange}
    open
    profile={profile}
  />,
)

beforeEach(() => {
  mocks.update.mockReset()
  mocks.update.mockResolvedValue(null)
})

afterEach(() => {
  cleanup()
})

describe('EditProfileDialog', () => {
  it('shows disabled media slots and cancel performs no mutation', () => {
    const onOpenChange = vi.fn()
    renderDialog(onOpenChange)

    expect(screen.getByRole('dialog', { name: 'Edit Profile' })).toBeTruthy()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Change avatar' }).disabled).toBe(true)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Change banner' }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(mocks.update).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('focuses the first invalid field and shows client field errors', async () => {
    renderDialog()
    const name = screen.getByRole('textbox', { name: 'Display name' })
    fireEvent.change(name, { target: { value: '   ' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Bio' }), {
      target: { value: 'x'.repeat(301) },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(document.activeElement).toBe(name))
    expect(name.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById('profile-name-error')?.textContent).toBeTruthy()
    expect(screen.getByText(/300/i)).toBeTruthy()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('disables actions and announces save progress until mutation succeeds', async () => {
    let resolve!: (value: null) => void
    mocks.update.mockReturnValue(new Promise<null>((pass) => {
      resolve = pass
    }))
    const onOpenChange = vi.fn()
    renderDialog(onOpenChange)

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({
      name: 'Rinko',
      bio: 'Seasonal reviews',
      profileVisibility: 'public',
    }))
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Saving changes…' }).disabled).toBe(true)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cancel' }).disabled).toBe(true)
    resolve(null)
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('keeps an explicit failure visible and retries the mutation', async () => {
    mocks.update
      .mockRejectedValueOnce(new Error('Profile service unavailable.'))
      .mockResolvedValueOnce(null)
    const onOpenChange = vi.fn()
    renderDialog(onOpenChange)

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Profile service unavailable.')
    expect(onOpenChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('returns focus to the supplied trigger after dismissal', async () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'Edit Profile'
    document.body.append(trigger)
    trigger.focus()
    const onOpenChange = vi.fn()
    const view = renderDialog(onOpenChange, trigger)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    view.rerender(
      <EditProfileDialog
        finalFocus={trigger}
        onOpenChange={onOpenChange}
        open={false}
        profile={profile}
      />,
    )

    await waitFor(() => expect(document.activeElement).toBe(trigger))
    trigger.remove()
  })

  it('uses fade-only popup and backdrop transitions', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog')
    const backdrop = document.querySelector('[data-testid="edit-profile-backdrop"]')

    expect(dialog.className).toContain('fade-in-0')
    expect(dialog.className).not.toMatch(/zoom|scale/)
    expect(backdrop?.className).toContain('fade-in-0')
    expect(backdrop?.className).not.toMatch(/zoom|scale/)
  })
})
