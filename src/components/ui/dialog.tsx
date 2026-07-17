import type { ReactNode } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { XIcon } from 'lucide-react'

import { cn } from '../../lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger

type DialogContentProps = {
  children: ReactNode
  className?: string
  description?: string
  descriptionClassName?: string
  finalFocus?: DialogPrimitive.Popup.Props['finalFocus']
  initialFocus?: DialogPrimitive.Popup.Props['initialFocus']
  title: string
  titleClassName?: string
}

/** Renders an accessible modal with focus trapping and dismiss behavior. */
export function DialogContent({
  children,
  className,
  description,
  descriptionClassName,
  finalFocus,
  initialFocus,
  title,
  titleClassName,
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm duration-150 data-open:animate-in data-closed:animate-out motion-reduce:duration-0" />
      <DialogPrimitive.Popup
        className={cn(
          'scrollbar-themed fixed top-1/2 left-1/2 z-50 max-h-[85dvh] w-[min(92vw,36rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-2xl outline-none duration-150 focus-visible:ring-2 focus-visible:ring-cyan-300 motion-reduce:duration-0',
          className,
        )}
        finalFocus={finalFocus}
        initialFocus={initialFocus}
      >
        <DialogPrimitive.Title className={cn('pr-12 text-xl font-black', titleClassName)}>
          {title}
        </DialogPrimitive.Title>
        {description === undefined ? null : (
          <DialogPrimitive.Description className={cn('mt-1 text-sm text-muted-foreground', descriptionClassName)}>
            {description}
          </DialogPrimitive.Description>
        )}
        <DialogPrimitive.Close aria-label="Close dialog" className="absolute top-3 right-3 grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-cyan-300">
          <XIcon aria-hidden="true" className="size-5" />
        </DialogPrimitive.Close>
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}
