import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  Compass,
  Home,
  Search,
  SquarePlus,
  UserRound,
} from 'lucide-react'

export type ShellNavigationItem = {
  label: string
  icon: LucideIcon
  href: string
}

export type ShellHeaderAction = {
  label: string
  icon: LucideIcon
}

export const mainNavigationItems: ShellNavigationItem[] = [
  { label: 'Home', icon: Home, href: '/home' },
  { label: 'Discover', icon: Compass, href: '/home' },
]

export const authNavigationItems: ShellNavigationItem[] = [
  { label: 'Home', icon: Home, href: '/home' },
  { label: 'Discover', icon: Compass, href: '/home' },
]

export const headerActionItems: ShellHeaderAction[] = [
  { label: 'Search', icon: Search },
  { label: 'Notifications', icon: Bell },
  { label: 'Profile', icon: UserRound },
]

export const mobileNavigationItems: ShellNavigationItem[] = [
  { label: 'Home', icon: Home, href: '/home' },
  { label: 'Discover', icon: Compass, href: '/home' },
  { label: 'Search', icon: Search, href: '/home' },
  { label: 'Create', icon: SquarePlus, href: '/home' },
  { label: 'Profile', icon: UserRound, href: '/home' },
]
