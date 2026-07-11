import { useEffect, useState } from 'react'
import { User } from 'lucide-react'

import { validateUsername } from './auth-validation'
import { checkUsername } from './profile-actions'

type UsernameStatus =
  | {
      state: 'idle'
      message: string | null
    }
  | {
      state: 'checking'
      message: string
    }
  | {
      state: 'available'
      message: string
    }
  | {
      state: 'invalid'
      message: string
    }

const getStatusClass = (state: UsernameStatus['state']): string => {
  if (state === 'available') {
    return 'auth-field-hint auth-field-hint-ok'
  }
  if (state === 'checking') {
    return 'auth-field-hint'
  }
  return 'auth-field-hint auth-field-hint-error'
}

const useUsernameCheck = (
  username: string,
  onCheckError: (message: string) => void,
): UsernameStatus => {
  const [status, setStatus] = useState<UsernameStatus>({
    state: 'idle',
    message: null,
  })

  useEffect(() => {
    const trimmedUsername = username.trim()
    if (trimmedUsername.length === 0) {
      setStatus({ state: 'idle', message: null })
      return
    }

    const localResult = validateUsername(trimmedUsername)
    if (!localResult.valid) {
      setStatus({ state: 'invalid', message: localResult.message })
      return
    }

    setStatus({ state: 'checking', message: 'Checking username...' })

    let active = true
    const timer = window.setTimeout(() => {
      void checkUsername(trimmedUsername)
        .then((result) => {
          if (!active) {
            return
          }
          if (result.available) {
            setStatus({ state: 'available', message: 'Username available.' })
            return
          }
          setStatus({
            state: 'invalid',
            message: result.message ?? 'Username is unavailable.',
          })
        })
        .catch((error: unknown) => {
          if (!active) {
            return
          }
          onCheckError(error instanceof Error ? error.message : 'Username check failed.')
          setStatus({ state: 'idle', message: null })
        })
    }, 400)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [onCheckError, username])

  return status
}

export function UsernameField({
  error,
  label,
  onCheckError,
  onBlur,
  onChange,
  value,
}: {
  error?: string | null
  label: string
  onCheckError: (message: string) => void
  onBlur: () => void
  onChange: (value: string) => void
  value: string
}) {
  const status = useUsernameCheck(value, onCheckError)
  const message = error ?? status.message
  const messageId = 'username-message'

  return (
    <label className="auth-field">
      <span>{label}</span>
      <span className="auth-input-shell">
        <User aria-hidden="true" className="auth-input-icon" />
        <input
          aria-label={label}
          aria-describedby={message ? messageId : undefined}
          aria-invalid={error ? true : undefined}
          autoComplete="username"
          name="username"
          type="text"
          value={value}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
      {message ? (
        <small className={error ? 'auth-field-hint auth-field-hint-error' : getStatusClass(status.state)} id={messageId}>{message}</small>
      ) : null}
    </label>
  )
}
