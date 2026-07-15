// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Checkbox } from './checkbox'

function CheckboxProbe({ disabled }: { disabled: boolean }) {
  const [checked, setChecked] = useState(false)
  return <div>
    <Checkbox checked={checked} disabled={disabled} id="probe" onCheckedChange={setChecked} />
    <label htmlFor="probe">Probe</label>
  </div>
}

afterEach(cleanup)

describe('Checkbox', () => {
  it('toggles through associated label and exposes checked state', () => {
    render(<CheckboxProbe disabled={false} />)
    const checkbox = screen.getByRole('checkbox', { name: 'Probe' })
    fireEvent.click(screen.getByText('Probe'))
    expect(checkbox.getAttribute('aria-checked')).toBe('true')
    expect(checkbox.getAttribute('data-checked')).not.toBeNull()
  })

  it('does not toggle while disabled', () => {
    render(<CheckboxProbe disabled />)
    const checkbox = screen.getByRole('checkbox', { name: 'Probe' })
    fireEvent.click(screen.getByText('Probe'))
    expect(checkbox.getAttribute('aria-checked')).toBe('false')
  })

  it('styles the Base UI disabled state', () => {
    render(<CheckboxProbe disabled />)
    const checkbox = screen.getByRole('checkbox', { name: 'Probe' })
    expect(checkbox.getAttribute('data-disabled')).not.toBeNull()
    expect(checkbox.classList).toContain('data-disabled:cursor-not-allowed')
    expect(checkbox.classList).toContain('data-disabled:opacity-50')
  })
})
