import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Bell,
  Compass,
  Home,
  Search,
  SquarePlus,
  UserRound,
  UsersRound,
} from 'lucide-react'

export interface NavigationItem {
  label: string
  icon: LucideIcon
  active: boolean
}

export interface AnimePoster {
  title: string
  detail: string
  imageUrl: string
}

export interface FeedEntry {
  author: string
  action: string
  time: string
  body: string
  animeTitle: string
  animeMeta: string
  imageUrl: string
  accent: 'coral' | 'cyan'
  likes: number
  comments: number
  score: string | null
}

export interface AnimeListMetric {
  label: string
  count: number
}

export const desktopNavigationItems: NavigationItem[] = [
  { label: 'Home', icon: Home, active: true },
  { label: 'Discover', icon: Compass, active: false },
  { label: 'Community', icon: UsersRound, active: false },
  { label: 'Stats', icon: BarChart3, active: false },
]

export const mobileNavigationItems: NavigationItem[] = [
  { label: 'Home', icon: Home, active: true },
  { label: 'Discover', icon: Compass, active: false },
  { label: 'Search', icon: Search, active: false },
  { label: 'Create', icon: SquarePlus, active: false },
  { label: 'Profile', icon: UserRound, active: false },
]

export const seasonalAnime: AnimePoster[] = [
  {
    title: 'WIND BREAKER',
    detail: 'Season 2',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx163270-wboZJp0ybwVK.jpg',
  },
  {
    title: 'Solo Leveling',
    detail: 'Season 1',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-it355ZgzquUd.png',
  },
  {
    title: 'Frieren',
    detail: 'Journey continues',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-qQTzQnEJJ3oB.jpg',
  },
  {
    title: 'Attack on Titan',
    detail: 'Final Season',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-buvcRTBx4NSm.jpg',
  },
  {
    title: 'ONE PIECE',
    detail: 'Weekly',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21-ELSYx3yMPcKM.jpg',
  },
]

export const feedEntries: FeedEntry[] = [
  {
    author: 'Nikigal',
    action: 'posted',
    time: '2m ago',
    body: 'That final battle was absolutely insane. Every cut landed, and the last frame still has me stuck.',
    animeTitle: 'WIND BREAKER',
    animeMeta: 'Season 2',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx163270-wboZJp0ybwVK.jpg',
    accent: 'coral',
    likes: 142,
    comments: 18,
    score: null,
  },
  {
    author: 'Rinko',
    action: 'reviewed',
    time: '1h ago',
    body: 'The animation is top-tier and the pacing keeps you hooked from start to finish.',
    animeTitle: 'Solo Leveling',
    animeMeta: 'Winter 2024',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-it355ZgzquUd.png',
    accent: 'cyan',
    likes: 98,
    comments: 12,
    score: '91',
  },
  {
    author: 'Sora',
    action: 'completed',
    time: '3h ago',
    body: 'A masterpiece from start to finish. The story, characters, and world-building all stay with you.',
    animeTitle: 'Frieren: Beyond Journey',
    animeMeta: '28 episodes',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-qQTzQnEJJ3oB.jpg',
    accent: 'cyan',
    likes: 212,
    comments: 24,
    score: '8.5',
  },
]

export const animeListMetrics: AnimeListMetric[] = [
  { label: 'Watching', count: 12 },
  { label: 'Completed', count: 104 },
  { label: 'Planning', count: 28 },
]

export const utilityPosters: AnimePoster[] = [
  {
    title: 'Death Note',
    detail: 'Classic',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1535-kUgkcrfOrkUM.jpg',
  },
  {
    title: 'Hunter x Hunter',
    detail: 'Adventure',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx11061-y5gsT1hoHuHw.png',
  },
  {
    title: 'A Silent Voice',
    detail: 'Film',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20954-sYRfE5jQRtSB.jpg',
  },
]

export const headerActions: NavigationItem[] = [
  { label: 'Search', icon: Search, active: false },
  { label: 'Notifications', icon: Bell, active: false },
  { label: 'Profile', icon: UserRound, active: false },
]
