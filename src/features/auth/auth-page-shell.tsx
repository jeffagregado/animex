import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import { AnimeXLogo } from '../shell/animex-logo'
import { authNavigationItems } from '../shell/navigation'
import { SiteHeader } from '../shell/site-header'

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
    <main className="auth-page">
      <SiteHeader activeLabel={null} navItems={authNavigationItems} showAuthAction={false} />
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
  )
}

export function AuthControlledField({
  autoComplete,
  icon: Icon,
  label,
  name,
  onBlur,
  onChange,
  type,
  value,
}: {
  autoComplete: string
  icon: LucideIcon | null
  label: string
  name: string
  onBlur: () => void
  onChange: (value: string) => void
  type: string
  value: string
}) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <span className="auth-input-shell">
        {Icon ? <Icon aria-hidden="true" className="auth-input-icon" /> : null}
        <input
          autoComplete={autoComplete}
          name={name}
          type={type}
          value={value}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </label>
  )
}

export function AuthMessage({ message }: { message: string | null }) {
  if (!message) {
    return null
  }
  return <p className="auth-message">{message}</p>
}

export function GoogleButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="auth-oauth" type="button" onClick={onClick}>
      <span className="auth-google-mark" aria-hidden="true">G</span>
      Continue with Google
    </button>
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
