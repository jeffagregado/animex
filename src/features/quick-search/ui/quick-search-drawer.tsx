import type { RefObject } from 'react'
import { XIcon } from 'lucide-react'

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '../../../components/ui/drawer'
import { QuickSearchInput, QuickSearchResults } from './quick-search-results'
import type { QuickSearchModel } from './use-quick-search'

interface QuickSearchDrawerProps {
  finalFocus: HTMLElement | null
  inputRef: RefObject<HTMLInputElement | null>
  model: QuickSearchModel
  onOpenChange: (open: boolean) => void
  onOpenChangeComplete: (open: boolean) => void
  open: boolean
}

/** Presents mobile Quick Search with results above its bottom field. */
export function QuickSearchDrawer(props: QuickSearchDrawerProps) {
  return (
    <Drawer
      onOpenChange={props.onOpenChange}
      onOpenChangeComplete={props.onOpenChangeComplete}
      open={props.open}
      showSwipeHandle
      swipeDirection="down"
    >
      <DrawerContent
        className="[--drawer-content-max-height:calc(100dvh-1rem)] [--drawer-height:calc(100dvh-1rem)]"
        finalFocus={() => props.finalFocus}
        initialFocus={() => props.inputRef.current}
      >
        <DrawerHeader className="relative border-b border-border px-4 pb-3 text-left">
          <DrawerTitle className="pr-12 text-xl font-black">Quick Search</DrawerTitle>
          <DrawerDescription>Search Anime, Characters, Staff, and eligible Users.</DrawerDescription>
          <DrawerClose
            aria-label="Close Quick Search"
            className="absolute top-1 right-3 grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-cyan-300/10 hover:text-cyan-200 focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <XIcon aria-hidden="true" className="size-5" />
          </DrawerClose>
        </DrawerHeader>
        <div className="scrollbar-themed flex min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <QuickSearchResults model={props.model} />
        </div>
        <DrawerFooter className="border-t border-border bg-popover p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <QuickSearchInput inputRef={props.inputRef} model={props.model} />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
