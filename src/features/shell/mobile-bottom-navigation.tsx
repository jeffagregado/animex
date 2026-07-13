import { Link } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'
import { PlusSquareIcon } from 'lucide-react'

import { cn } from '#/lib/utils'
import { isCompleteAuthState } from '../auth/use-auth-state'

import { mobileNavigationItems } from './navigation'
import { usePublicAuthState } from './public-auth-context'

/** Renders typed public mobile links. */
export function MobileBottomNavigation() {
  const auth = usePublicAuthState()
  const convexAuth = useConvexAuth()
  const canCreate = auth.status === 'ready' && isCompleteAuthState(auth.authState) && convexAuth.isAuthenticated
  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 grid border-t border-white/8 bg-background/92 px-2 pb-3 pt-2 backdrop-blur-xl md:hidden',
        canCreate ? 'grid-cols-4' : 'grid-cols-3',
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
      {canCreate ? <Link className="mobile-nav-item" search={{ compose: true, feed: 'home' }} to="/home"><PlusSquareIcon aria-hidden="true" className="size-6" /><span>Create</span></Link> : null}
    </nav>
  )
}
