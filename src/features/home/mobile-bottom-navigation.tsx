import { cn } from '#/lib/utils'

import { mobileNavigationItems } from '../shell/navigation'

export function MobileBottomNavigation({ showPrivateItems }: { showPrivateItems: boolean }) {
  const visibleItems = showPrivateItems
    ? mobileNavigationItems
    : mobileNavigationItems.filter((item) => item.label !== 'Create' && item.label !== 'Profile')

  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 grid border-t border-white/8 bg-background/92 px-2 pb-3 pt-2 backdrop-blur-xl md:hidden',
        showPrivateItems ? 'grid-cols-5' : 'grid-cols-3',
      )}
      aria-label="Mobile"
    >
      {visibleItems.map((item) => (
        <button className={cn('mobile-nav-item', item.label === 'Home' ? 'is-active' : '')} type="button" key={item.label}>
          <item.icon aria-hidden="true" className="size-6" />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
