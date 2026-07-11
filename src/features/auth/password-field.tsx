import { useState } from 'react'
import { Eye, EyeOff, KeyRound } from 'lucide-react'

export function PasswordField({
  autoComplete,
  error,
  label,
  name,
  onBlur,
  onChange,
  value,
}: {
  autoComplete: string
  error?: string | null
  label: string
  name: string
  onBlur: () => void
  onChange: (value: string) => void
  value: string
}) {
  const [visible, setVisible] = useState(false)
  const inputType = visible ? 'text' : 'password'
  const Icon = visible ? EyeOff : Eye
  const errorId = `${name}-error`

  return (
    <label className="auth-field">
      <span>{label}</span>
      <span className="auth-input-shell">
        <KeyRound aria-hidden="true" className="auth-input-icon" />
        <input
          aria-label={label}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
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
      {error ? <small className="auth-field-hint auth-field-hint-error" id={errorId}>{error}</small> : null}
    </label>
  )
}
