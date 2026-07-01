import { useEffect, useState } from 'react'

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

const useUsernameCheck = (username: string): UsernameStatus => {
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
          setStatus({
            state: 'invalid',
            message: error instanceof Error ? error.message : 'Username check failed.',
          })
        })
    }, 400)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [username])

  return status
}

export function UsernameField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const status = useUsernameCheck(value)

  return (
    <label className="auth-field">
      <span>{label}</span>
      <input
        autoComplete="username"
        name="username"
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {status.message ? (
        <small className={getStatusClass(status.state)}>{status.message}</small>
      ) : null}
    </label>
  )
}
