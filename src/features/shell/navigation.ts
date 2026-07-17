import type { LucideIcon } from 'lucide-react'
import {
  Compass,
  Home,
} from 'lucide-react'

export type ShellNavigationItem = {
  label: string
  icon: LucideIcon
  href: string
  hash?: string
}

export const mainNavigationItems: ShellNavigationItem[] = [
  { label: 'Home', icon: Home, href: '/home' },
  { label: 'Discover', icon: Compass, href: '/discover' },
]

export const mobileNavigationItems: ShellNavigationItem[] = [
  { label: 'Home', icon: Home, href: '/home' },
  { label: 'Discover', icon: Compass, href: '/discover' },
]
