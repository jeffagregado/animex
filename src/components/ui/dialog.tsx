import type { ReactNode } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { XIcon } from 'lucide-react'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger

type DialogContentProps = { children: ReactNode; title: string }

/** Renders an accessible modal with focus trapping and dismiss behavior. */
export function DialogContent({ children, title }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm data-open:animate-in data-closed:animate-out" />
      <DialogPrimitive.Popup className="scrollbar-themed fixed top-1/2 left-1/2 z-50 max-h-[85dvh] w-[min(92vw,36rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
        <DialogPrimitive.Title className="pr-12 text-xl font-black">{title}</DialogPrimitive.Title>
        <DialogPrimitive.Close aria-label="Close dialog" className="absolute top-3 right-3 grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-cyan-300">
          <XIcon aria-hidden="true" className="size-5" />
        </DialogPrimitive.Close>
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}
