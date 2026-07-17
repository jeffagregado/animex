import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
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

interface SearchSurfaceState {
  closeSearch: () => void
  finishClose: () => void
  inputRef: RefObject<HTMLInputElement | null>
  open: boolean
  openSearch: (trigger: HTMLElement) => void
  resetVersion: number
  surface: QuickSearchSurface | null
  triggerRef: RefObject<HTMLElement | null>
}

interface QuickSearchRootProps {
  authScope: string | null
  children: ReactNode
  usersEnabled: boolean
}

/** Owns responsive surface selection and close-completion reset state. */
function useSearchSurface(): SearchSurfaceState {
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const [surface, setSurface] = useState<QuickSearchSurface | null>(null)
  const [open, setOpen] = useState(false)
  const [resetVersion, setResetVersion] = useState(0)

  const closeSearch = useCallback((): void => {
    setOpen(false)
  }, [])
  const openSearch = useCallback((trigger: HTMLElement): void => {
    if (open) return
    triggerRef.current = trigger
    setSurface(window.matchMedia('(min-width: 48rem)').matches ? 'dialog' : 'drawer')
    setOpen(true)
  }, [open])
  const finishClose = useCallback((): void => {
    setSurface(null)
    setResetVersion((current) => current + 1)
    triggerRef.current = null
  }, [])

  return {
    closeSearch,
    finishClose,
    inputRef,
    open,
    openSearch,
    resetVersion,
    surface,
    triggerRef,
  }
}

/** Defers navigation until the selected surface finishes closing. */
function useCloseNavigation(
  closeSearch: () => void,
  finishClose: () => void,
  openSurface: (trigger: HTMLElement) => void,
) {
  const navigate = useNavigate()
  const pendingDestination = useRef<string | null>(null)
  const openSearch = useCallback((trigger: HTMLElement): void => {
    pendingDestination.current = null
    openSurface(trigger)
  }, [openSurface])
  const select = useCallback((destination: string): void => {
    pendingDestination.current = destination
    closeSearch()
  }, [closeSearch])
  const changeComplete = useCallback((nextOpen: boolean): void => {
    if (nextOpen) return
    const destination = pendingDestination.current
    pendingDestination.current = null
    finishClose()
    if (destination === null) return
    window.setTimeout(() => {
      void navigate({ to: destination })
    }, 0)
  }, [finishClose, navigate])

  return { changeComplete, openSearch, select }
}

/** Owns one responsive Quick Search surface and its close-before-navigation flow. */
function QuickSearchRoot({
  authScope,
  children,
  usersEnabled,
}: QuickSearchRootProps) {
  const state = useSearchSurface()
  const navigation = useCloseNavigation(
    state.closeSearch,
    state.finishClose,
    state.openSearch,
  )
  const model = useQuickSearch({
    authScope,
    onSelect: navigation.select,
    open: state.open,
    resetVersion: state.resetVersion,
    usersEnabled,
  })
  const changeOpen = useCallback((nextOpen: boolean): void => {
    if (!nextOpen) state.closeSearch()
  }, [state.closeSearch])
  const controls: QuickSearchControls = {
    closeSearch: state.closeSearch,
    openSearch: navigation.openSearch,
  }
  const surfaceProps = {
    finalFocus: state.triggerRef.current,
    inputRef: state.inputRef,
    model,
    onOpenChange: changeOpen,
    onOpenChangeComplete: navigation.changeComplete,
    open: state.open,
  }

  return (
    <QuickSearchContext.Provider value={controls}>
      {children}
      {state.surface === 'dialog' ? <QuickSearchDialog {...surfaceProps} /> : null}
      {state.surface === 'drawer' ? <QuickSearchDrawer {...surfaceProps} /> : null}
    </QuickSearchContext.Provider>
  )
}

/** Enables Quick Search with authenticated User results on public pages. */
export function QuickSearchProvider({ children }: { children: ReactNode }) {
  const auth = usePublicAuthState()
  const convexAuth = useConvexAuth()
  const completeProfile = auth.status === 'ready'
    && auth.authState.status === 'complete'
    ? auth.authState.profile
    : null
  const usersEnabled = completeProfile !== null
    && convexAuth.isAuthenticated
    && !convexAuth.isLoading

  return (
    <QuickSearchRoot
      authScope={completeProfile?.id ?? null}
      usersEnabled={usersEnabled}
    >
      {children}
    </QuickSearchRoot>
  )
}

/** Enables guest-scoped Quick Search without loading auth state. */
export function GuestQuickSearchProvider({ children }: { children: ReactNode }) {
  return (
    <QuickSearchRoot authScope={null} usersEnabled={false}>
      {children}
    </QuickSearchRoot>
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
