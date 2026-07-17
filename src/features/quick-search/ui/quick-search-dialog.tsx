import type { RefObject } from 'react'

import { Dialog, DialogContent } from '../../../components/ui/dialog'
import { QuickSearchInput, QuickSearchResults } from './quick-search-results'
import type { QuickSearchModel } from './use-quick-search'

interface QuickSearchDialogProps {
  finalFocus: HTMLElement | null
  inputRef: RefObject<HTMLInputElement | null>
  model: QuickSearchModel
  onOpenChange: (open: boolean) => void
  onOpenChangeComplete: (open: boolean) => void
  open: boolean
}

/** Presents desktop Quick Search with its field above scrollable results. */
export function QuickSearchDialog(props: QuickSearchDialogProps) {
  return (
    <Dialog
      onOpenChange={props.onOpenChange}
      onOpenChangeComplete={props.onOpenChangeComplete}
      open={props.open}
    >
      <DialogContent
        className="flex w-[min(94vw,64rem)] max-w-none flex-col overflow-hidden p-0"
        description="Search Anime, Characters, Staff, and eligible Users."
        descriptionClassName="sr-only"
        finalFocus={() => props.finalFocus}
        initialFocus={() => props.inputRef.current}
        title="Quick Search"
        titleClassName="sr-only"
      >
        <div className="shrink-0 border-b border-border p-5 pr-16">
          <QuickSearchInput inputRef={props.inputRef} model={props.model} />
        </div>
        <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <QuickSearchResults model={props.model} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
