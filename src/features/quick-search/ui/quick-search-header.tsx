import {
  useQuickSearchControls,
} from './quick-search-provider'
import { SiteHeader } from '../../shell/site-header'
import type { ShellNavigationItem } from '../../shell/navigation'

interface QuickSearchHeaderProps {
  navItems: ShellNavigationItem[]
  showAuthAction: boolean
}

/** Renders the shared site header with Quick Search controls. */
export function QuickSearchHeader({
  navItems,
  showAuthAction,
}: QuickSearchHeaderProps) {
  const { openSearch } = useQuickSearchControls()

  return (
    <SiteHeader
      navItems={navItems}
      openSearch={openSearch}
      showAuthAction={showAuthAction}
    />
  )
}
