import type { LucideIcon } from 'lucide-react'
import {
  Compass,
  Home,
  Search,
} from 'lucide-react'

export type ShellNavigationItem = {
  label: string
  icon: LucideIcon
  href: string
  hash?: string
}

export type ShellHeaderAction = {
  label: string
  icon: LucideIcon
  href: string
  hash?: string
}

export const mainNavigationItems: ShellNavigationItem[] = [
  { label: 'Home', icon: Home, href: '/home' },
  { label: 'Discover', icon: Compass, href: '/discover' },
]

export const headerActionItems: ShellHeaderAction[] = [
  { label: 'Search', icon: Search, href: '/discover', hash: 'discover-search' },
]

export const mobileNavigationItems: ShellNavigationItem[] = [
  { label: 'Home', icon: Home, href: '/home' },
  { label: 'Discover', icon: Compass, href: '/discover' },
  { label: 'Search', icon: Search, href: '/discover', hash: 'discover-search' },
]
