import type { ComponentProps } from 'react'
import { Select as SelectPrimitive } from '@base-ui/react/select'
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react'

import { cn } from '#/lib/utils.ts'

export const Select = SelectPrimitive.Root

/** Groups related select choices. */
export function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return <SelectPrimitive.Group data-slot="select-group" className={cn('scroll-my-1 p-1', className)} {...props} />
}

/** Displays current select choice. */
export function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return <SelectPrimitive.Value data-slot="select-value" className={cn('flex flex-1 text-left', className)} {...props} />
}

type SelectTriggerProps = SelectPrimitive.Trigger.Props & {
  size?: 'sm' | 'default'
}

/** Opens select choices. */
export function SelectTrigger({ className, size, children, ...props }: SelectTriggerProps) {
  const triggerSize = size ?? 'default'

  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={triggerSize}
      className={cn(
        'flex h-10 w-full items-center justify-between gap-1.5 rounded-lg border border-border bg-card px-3 text-sm text-foreground transition outline-none select-none hover:border-cyan-300 hover:bg-cyan-300/5 focus-visible:border-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-50 data-placeholder:text-muted-foreground',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon render={<ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-cyan-300" />} />
    </SelectPrimitive.Trigger>
  )
}

type SelectContentProps = SelectPrimitive.Popup.Props & Pick<
  SelectPrimitive.Positioner.Props,
  'align' | 'alignOffset' | 'side' | 'sideOffset' | 'alignItemWithTrigger'
>

/** Portals select choices beside trigger. */
export function SelectContent({
  className,
  children,
  side,
  sideOffset,
  align,
  alignOffset,
  alignItemWithTrigger,
  ...props
}: SelectContentProps) {
  const positionerSide = side ?? 'bottom'
  const positionerSideOffset = sideOffset ?? 4
  const positionerAlign = align ?? 'center'
  const positionerAlignOffset = alignOffset ?? 0
  const alignWithTrigger = alignItemWithTrigger ?? true

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={positionerSide}
        sideOffset={positionerSideOffset}
        align={positionerAlign}
        alignOffset={positionerAlignOffset}
        alignItemWithTrigger={alignWithTrigger}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignWithTrigger}
          className={cn(
            'relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 overflow-x-hidden overflow-y-auto rounded-lg border border-border bg-card text-card-foreground shadow-2xl duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
            className,
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

/** Renders selectable choice with selected check. */
export function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'relative flex w-full cursor-default items-center gap-1.5 rounded-md py-2 pr-8 pl-2 text-sm outline-none select-none data-[highlighted]:bg-cyan-300/10 data-[highlighted]:text-cyan-100 data-[selected]:bg-cyan-300/15 data-[selected]:text-cyan-100 data-disabled:pointer-events-none data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator render={<span data-slot="select-item-indicator" className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />}>
        <CheckIcon className="pointer-events-none size-4 text-cyan-300" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

/** Scrolls choices upward when overflowing. */
function SelectScrollUpButton({ className, ...props }: ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow data-slot="select-scroll-up-button" className={cn('top-0 z-10 flex w-full cursor-default items-center justify-center bg-card py-1', className)} {...props}>
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpArrow>
  )
}

/** Scrolls choices downward when overflowing. */
function SelectScrollDownButton({ className, ...props }: ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow data-slot="select-scroll-down-button" className={cn('bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-card py-1', className)} {...props}>
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownArrow>
  )
}
