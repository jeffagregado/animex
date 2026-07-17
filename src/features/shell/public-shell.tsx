import type { ReactNode } from 'react'

import {
  QuickSearchProvider,
  useQuickSearchControls,
} from '../quick-search/ui/quick-search-provider'
import { QuickSearchHeader } from '../quick-search/ui/quick-search-header'
import { mainNavigationItems } from './navigation'
import { MobileBottomNavigation } from './mobile-bottom-navigation'
import { PublicAuthStateProvider } from './public-auth-context'

type PublicShellProps = {
  children: ReactNode
}

function PublicShellContent({ children }: PublicShellProps) {
  const { openSearch } = useQuickSearchControls()

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <QuickSearchHeader
        navItems={mainNavigationItems}
        showAuthAction={true}
      />
      {children}
      <MobileBottomNavigation openSearch={openSearch} />
    </div>
  )
}

/** Renders shared public navigation around public route content. */
export function PublicShell({ children }: PublicShellProps) {
  return (
    <PublicAuthStateProvider>
      <QuickSearchProvider>
        <PublicShellContent>{children}</PublicShellContent>
      </QuickSearchProvider>
    </PublicAuthStateProvider>
  )
}
