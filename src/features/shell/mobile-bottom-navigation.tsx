import { Link } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'
import { PlusSquareIcon, SearchIcon, UserRoundIcon } from 'lucide-react'

import { cn } from '#/lib/utils'

import { mobileNavigationItems } from './navigation'
import { usePublicAuthState } from './public-auth-context'

/** Renders typed public mobile links. */
export function MobileBottomNavigation({
  openSearch,
}: {
  openSearch: (trigger: HTMLElement) => void
}) {
  const auth = usePublicAuthState()
  const convexAuth = useConvexAuth()
  const profile = auth.status === 'ready'
    && auth.authState.status === 'complete'
    && convexAuth.isAuthenticated
    && !convexAuth.isLoading
    ? auth.authState.profile
    : null

  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 grid border-t border-white/8 bg-background/92 px-2 pb-3 pt-2 backdrop-blur-xl md:hidden',
        profile === null ? 'grid-cols-3' : 'grid-cols-5',
      )}
      aria-label="Mobile"
    >
      {mobileNavigationItems.map((item) => {
        const Icon = item.icon
        return (
          <Link
            className="mobile-nav-item"
            activeProps={item.hash === undefined ? { className: 'mobile-nav-item is-active' } : undefined}
            activeOptions={{ exact: true }}
            to={item.href}
            hash={item.hash}
            key={item.label}
          >
            <Icon aria-hidden="true" className="size-6" />
            <span>{item.label}</span>
          </Link>
        )
      })}
      <button
        aria-label="Search"
        className="mobile-nav-item"
        onClick={(event) => openSearch(event.currentTarget)}
        type="button"
      >
        <SearchIcon aria-hidden="true" className="size-6" />
        <span>Search</span>
      </button>
      {profile !== null ? (
        <>
          <Link
            className="mobile-nav-item"
            search={{ compose: true, feed: 'home' }}
            to="/home"
          >
            <PlusSquareIcon aria-hidden="true" className="size-6" />
            <span>Create</span>
          </Link>
          <Link
            className="mobile-nav-item"
            params={{ username: profile.username }}
            search={{ tab: undefined }}
            to="/users/$username"
          >
            <UserRoundIcon aria-hidden="true" className="size-6" />
            <span>Profile</span>
          </Link>
        </>
      ) : null}
    </nav>
  )
}
