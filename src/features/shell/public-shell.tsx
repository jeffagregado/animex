import type { ReactNode } from 'react'

import { mainNavigationItems } from './navigation'
import { MobileBottomNavigation } from './mobile-bottom-navigation'
import { PublicAuthStateProvider } from './public-auth-context'
import { SiteHeader } from './site-header'

type PublicShellProps = {
  children: ReactNode
}

/** Renders shared public navigation around public route content. */
export function PublicShell({ children }: PublicShellProps) {
  return (
    <PublicAuthStateProvider>
      <div className="min-h-dvh bg-background text-foreground">
        <SiteHeader navItems={mainNavigationItems} showAuthAction={true} />
        {children}
        <MobileBottomNavigation />
      </div>
    </PublicAuthStateProvider>
  )
}
