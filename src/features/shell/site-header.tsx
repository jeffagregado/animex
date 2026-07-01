import { cn } from '#/lib/utils'

import { AnimeXLogo } from './animex-logo'
import { HeaderAuthControls } from './header-auth-controls'
import { headerActionItems, type ShellNavigationItem } from './navigation'

export type SiteHeaderProps = {
  activeLabel: string | null
  navItems: ShellNavigationItem[]
  showAuthAction: boolean
}

export function SiteHeader({ activeLabel, navItems, showAuthAction }: SiteHeaderProps) {
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
            <a className={cn('nav-link', activeLabel === item.label ? 'is-active' : '')} href={item.href} key={item.label}>
              <item.icon aria-hidden="true" className="size-5" />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
        <div className="site-header-actions flex items-center gap-2">
          {showAuthAction ? (
            <HeaderAuthControls />
          ) : (
            <button className="icon-button" type="button" aria-label={searchAction.label} data-header-action={searchAction.label}>
              <SearchIcon aria-hidden="true" className="size-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
