import { useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import { AsyncButton } from '../../components/async-button'
import { QuickSearchHeader } from '../quick-search/ui/quick-search-header'
import { GuestQuickSearchProvider } from '../quick-search/ui/quick-search-provider'
import { AnimeXLogo } from '../shell/animex-logo'
import { mainNavigationItems } from '../shell/navigation'

export function AuthPageShell({
  children,
  eyebrow,
  subtitle,
  title,
}: {
  children: ReactNode
  eyebrow: string
  subtitle: string | null
  title: string
}) {
  return (
    <GuestQuickSearchProvider>
      <main className="auth-page">
        <QuickSearchHeader
          navItems={mainNavigationItems}
          showAuthAction={false}
        />
        <div className="auth-poster-grid" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="auth-x-mark" aria-hidden="true" />
        <section className="auth-panel" aria-labelledby="auth-title">
          <AnimeXLogo ariaLabel="AnimeX home" href="/home" size="panel" />
          <p className="sr-only">{eyebrow}</p>
          <h1 id="auth-title">{title}</h1>
          {subtitle ? <p className="auth-subtitle">{subtitle}</p> : null}
          {children}
        </section>
      </main>
    </GuestQuickSearchProvider>
  )
}

export function AuthControlledField({
  autoComplete,
  error,
  icon: Icon,
  label,
  name,
  onBlur,
  onChange,
  readOnly,
  type,
  value,
}: {
  autoComplete: string
  error?: string | null
  icon: LucideIcon | null
  label: string
  name: string
  onBlur: () => void
  onChange: (value: string) => void
  readOnly?: boolean
  type: string
  value: string
}) {
  const errorId = `${name}-error`
  return (
    <label className="auth-field">
      <span>{label}</span>
      <span className="auth-input-shell">
        {Icon ? <Icon aria-hidden="true" className="auth-input-icon" /> : null}
        <input
          aria-label={label}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          autoComplete={autoComplete}
          name={name}
          readOnly={readOnly}
          type={type}
          value={value}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
      {error ? <small className="auth-field-hint auth-field-hint-error" id={errorId}>{error}</small> : null}
    </label>
  )
}

export function AuthMessage({
  kind,
  message,
}: {
  kind?: 'error' | 'status'
  message: string | null
}) {
  if (!message) {
    return null
  }
  return <p className="auth-message" role={kind === 'status' ? 'status' : 'alert'}>{message}</p>
}

export function GoogleButton({ onClick }: { onClick: () => Promise<void> }) {
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    setIsLoading(true)
    try {
      await onClick()
    } catch (error) {
      setIsLoading(false)
      throw error
    }
  }

  return (
    <AsyncButton className="auth-oauth" type="button" isLoading={isLoading} onClick={() => void handleClick()}>
      <span className="auth-google-mark" aria-hidden="true">G</span>
      Continue with Google
    </AsyncButton>
  )
}

export function Divider() {
  return (
    <div className="auth-divider">
      <span />
      <p>or</p>
      <span />
    </div>
  )
}
