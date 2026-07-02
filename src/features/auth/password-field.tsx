import { useState } from 'react'
import { Eye, EyeOff, KeyRound } from 'lucide-react'

export function PasswordField({
  autoComplete,
  label,
  name,
  onBlur,
  onChange,
  value,
}: {
  autoComplete: string
  label: string
  name: string
  onBlur: () => void
  onChange: (value: string) => void
  value: string
}) {
  const [visible, setVisible] = useState(false)
  const inputType = visible ? 'text' : 'password'
  const Icon = visible ? EyeOff : Eye

  return (
    <label className="auth-field">
      <span>{label}</span>
      <span className="auth-input-shell">
        <KeyRound aria-hidden="true" className="auth-input-icon" />
        <input
          autoComplete={autoComplete}
          name={name}
          type={inputType}
          value={value}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="auth-password-toggle"
          type="button"
          onClick={() => setVisible(!visible)}
        >
          <Icon aria-hidden="true" className="size-5" />
        </button>
      </span>
    </label>
  )
}
