import { cn } from '#/lib/utils'

export type AnimeXLogoSize = 'header' | 'panel'

export type AnimeXLogoProps = {
  ariaLabel: string
  href: string
  size: AnimeXLogoSize
}

export function AnimeXLogo({ ariaLabel, href, size }: AnimeXLogoProps) {
  return (
    <a className={cn('animex-logo', `animex-logo--${size}`)} href={href} aria-label={ariaLabel}>
      <img className="animex-logo__image" src="/animex-logo.svg" alt="" aria-hidden="true" />
    </a>
  )
}
