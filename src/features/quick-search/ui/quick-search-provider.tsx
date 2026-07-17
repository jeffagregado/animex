import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'

import { usePublicAuthState } from '../../shell/public-auth-context'
import { QuickSearchDialog } from './quick-search-dialog'
import { QuickSearchDrawer } from './quick-search-drawer'
import { useQuickSearch } from './use-quick-search'

type QuickSearchSurface = 'dialog' | 'drawer'

export interface QuickSearchControls {
  closeSearch: () => void
  openSearch: (trigger: HTMLElement) => void
}

const QuickSearchContext = createContext<QuickSearchControls | null>(null)

/** Owns one responsive Quick Search surface and its close-before-navigation flow. */
export function QuickSearchProvider({ children }: { children: ReactNode }) {
  const auth = usePublicAuthState()
  const convexAuth = useConvexAuth()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const pendingDestination = useRef<string | null>(null)
  const [surface, setSurface] = useState<QuickSearchSurface | null>(null)
  const [open, setOpen] = useState(false)
  const [resetVersion, setResetVersion] = useState(0)
  const completeProfile = auth.status === 'ready'
    && auth.authState.status === 'complete'
    ? auth.authState.profile
    : null
  const usersEnabled = completeProfile !== null
    && convexAuth.isAuthenticated
    && !convexAuth.isLoading

  const closeSearch = useCallback((): void => {
    setOpen(false)
  }, [])
  const openSearch = useCallback((trigger: HTMLElement): void => {
    if (open) return
    triggerRef.current = trigger
    pendingDestination.current = null
    setSurface(window.matchMedia('(min-width: 48rem)').matches ? 'dialog' : 'drawer')
    setOpen(true)
  }, [open])
  const select = useCallback((destination: string): void => {
    pendingDestination.current = destination
    setOpen(false)
  }, [])
  const model = useQuickSearch({
    authScope: completeProfile?.id ?? null,
    onSelect: select,
    open,
    resetVersion,
    usersEnabled,
  })
  const changeOpen = useCallback((nextOpen: boolean): void => {
    if (!nextOpen) closeSearch()
  }, [closeSearch])
  const changeComplete = useCallback((nextOpen: boolean): void => {
    if (nextOpen) return
    const destination = pendingDestination.current
    pendingDestination.current = null
    setSurface(null)
    setResetVersion((current) => current + 1)
    triggerRef.current = null
    if (destination !== null) {
      window.setTimeout(() => {
        void navigate({ to: destination })
      }, 0)
    }
  }, [navigate])
  const controls: QuickSearchControls = { closeSearch, openSearch }
  const surfaceProps = {
    finalFocus: triggerRef.current,
    inputRef,
    model,
    onOpenChange: changeOpen,
    onOpenChangeComplete: changeComplete,
    open,
  }

  return (
    <QuickSearchContext.Provider value={controls}>
      {children}
      {surface === 'dialog' ? <QuickSearchDialog {...surfaceProps} /> : null}
      {surface === 'drawer' ? <QuickSearchDrawer {...surfaceProps} /> : null}
    </QuickSearchContext.Provider>
  )
}

/** Returns Quick Search controls from the nearest single provider. */
export function useQuickSearchControls(): QuickSearchControls {
  const controls = useContext(QuickSearchContext)
  if (controls === null) {
    throw new Error('Quick Search controls require QuickSearchProvider.')
  }
  return controls
}
