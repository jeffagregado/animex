import type { ReactNode } from 'react'

import { AnimeXLogo } from '../shell/animex-logo'
import { authNavigationItems } from '../shell/navigation'
import { SiteHeader } from '../shell/site-header'

export function AuthPageShell({
  children,
  eyebrow,
  title,
}: {
  children: ReactNode
  eyebrow: string
  title: string
}) {
  return (
    <main className="auth-page">
      <SiteHeader activeLabel={null} navItems={authNavigationItems} showAuthAction={false} />
      <section className="auth-panel" aria-labelledby="auth-title">
        <AnimeXLogo ariaLabel="AnimeX home" href="/home" size="panel" />
        <p className="sr-only">{eyebrow}</p>
        <h1 id="auth-title">{title}</h1>
        {children}
      </section>
    </main>
  )
}

export function AuthField({
  autoComplete,
  label,
  name,
  type,
}: {
  autoComplete: string
  label: string
  name: string
  type: string
}) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <input autoComplete={autoComplete} name={name} type={type} />
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

export const getFormValue = (formData: FormData, name: string): string => {
  const value = formData.get(name)
  if (typeof value !== 'string') {
    throw new Error(`${name} is required.`)
  }
  return value
}
