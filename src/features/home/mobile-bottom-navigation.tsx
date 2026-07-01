import { cn } from '#/lib/utils'

import { mobileNavigationItems } from '../shell/navigation'

export function MobileBottomNavigation() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/8 bg-background/92 px-2 pb-3 pt-2 backdrop-blur-xl md:hidden" aria-label="Mobile">
      {mobileNavigationItems.map((item) => (
        <button className={cn('mobile-nav-item', item.label === 'Home' ? 'is-active' : '')} type="button" key={item.label}>
          <item.icon aria-hidden="true" className="size-6" />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
