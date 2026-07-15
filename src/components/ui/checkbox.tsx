import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import { CheckIcon } from 'lucide-react'

import { cn } from '#/lib/utils'

/** Renders AnimeX themed standalone checkbox. */
export function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return <CheckboxPrimitive.Root
    className={cn('peer relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-border bg-card text-background outline-none transition-colors after:absolute after:-inset-x-3 after:-inset-y-2 hover:border-cyan-300 focus-visible:border-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-300/40 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-checked:border-cyan-300 data-checked:bg-cyan-300', className)}
    data-slot="checkbox"
    {...props}
  >
    <CheckboxPrimitive.Indicator className="grid place-content-center text-current [&>svg]:size-3.5" data-slot="checkbox-indicator">
      <CheckIcon aria-hidden="true" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
}
