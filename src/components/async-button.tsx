import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'

type AsyncButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  children: ReactNode
  isLoading: boolean
}

export function AsyncButton({
  children,
  disabled,
  isLoading,
  ...buttonProps
}: AsyncButtonProps) {
  const isDisabled = Boolean(disabled) || isLoading

  return (
    <button {...buttonProps} aria-busy={isLoading} disabled={isDisabled}>
      {isLoading ? <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin" /> : null}
      {children}
    </button>
  )
}
