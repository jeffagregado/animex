import { Link } from '@tanstack/react-router'

import { AnimeXLogo } from './animex-logo'
import { HeaderAuthControls } from './header-auth-controls'
import { headerActionItems, type ShellNavigationItem } from './navigation'

export type SiteHeaderProps = {
  navItems: ShellNavigationItem[]
  showAuthAction: boolean
}

export function SiteHeader({ navItems, showAuthAction }: SiteHeaderProps) {
  const searchAction = headerActionItems.find((item) => item.label === 'Search')
  if (!searchAction) {
    throw new Error('Header search action is required.')
  }
  const SearchIcon = searchAction.icon

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
          {showAuthAction ? (
            <HeaderAuthControls />
          ) : (
            <Link className="icon-button" to={searchAction.href} hash={searchAction.hash} aria-label={searchAction.label} data-header-action={searchAction.label}>
              <SearchIcon aria-hidden="true" className="size-5" />
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
