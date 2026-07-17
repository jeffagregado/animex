import { Link } from '@tanstack/react-router'
import { SearchIcon } from 'lucide-react'

import { AnimeXLogo } from './animex-logo'
import { HeaderAuthControls } from './header-auth-controls'
import type { ShellNavigationItem } from './navigation'

export type HeaderSearchAction =
  | {
      kind: 'discover'
      to: '/discover'
    }
  | {
      kind: 'quick-search'
      open: (trigger: HTMLElement) => void
    }

export type SiteHeaderProps = {
  navItems: ShellNavigationItem[]
  searchAction: HeaderSearchAction
  showAuthAction: boolean
}

export function SiteHeader({ navItems, searchAction, showAuthAction }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <AnimeXLogo ariaLabel="AnimeX home" href="/home" size="header" />
        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
          {navItems.map((item) => (
            <Link
              className="nav-link"
              activeProps={{ className: 'nav-link is-active' }}
              activeOptions={{ exact: true }}
              to={item.href}
              hash={item.hash}
              key={item.label}
            >
              <item.icon aria-hidden="true" className="size-5" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="site-header-actions flex items-center gap-2">
          {searchAction.kind === 'quick-search' ? (
            <button
              aria-label="Search"
              className="icon-button"
              data-header-action="Search"
              onClick={(event) => searchAction.open(event.currentTarget)}
              type="button"
            >
              <SearchIcon aria-hidden="true" className="size-5" />
            </button>
          ) : (
            <Link
              aria-label="Search"
              className="icon-button"
              data-header-action="Search"
              to={searchAction.to}
            >
              <SearchIcon aria-hidden="true" className="size-5" />
            </Link>
          )}
          {showAuthAction ? <HeaderAuthControls /> : null}
        </div>
      </div>
    </header>
  )
}
