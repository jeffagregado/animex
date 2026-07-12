import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type HorizontalRailProps = {
  children: ReactNode
  label: string
}

type RailPosition = {
  isAtEnd: boolean
  isAtStart: boolean
}

/** Provides native horizontal scrolling with accessible viewport controls. */
export function HorizontalRail({ children, label }: HorizontalRailProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<RailPosition>({ isAtStart: true, isAtEnd: true })

  useEffect(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (viewport === null || content === null) {
      return
    }

    const updatePosition = (): void => {
      const nextPosition = {
        isAtStart: viewport.scrollLeft <= 1,
        isAtEnd: viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 1,
      }
      setPosition((current) => current.isAtStart === nextPosition.isAtStart && current.isAtEnd === nextPosition.isAtEnd ? current : nextPosition)
    }

    updatePosition()
    viewport.addEventListener('scroll', updatePosition, { passive: true })
    window.addEventListener('resize', updatePosition)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updatePosition)
    observer?.observe(viewport)
    observer?.observe(content)
    return () => {
      viewport.removeEventListener('scroll', updatePosition)
      window.removeEventListener('resize', updatePosition)
      observer?.disconnect()
    }
  }, [children])

  const scrollViewport = (direction: number): void => {
    const viewport = viewportRef.current
    if (viewport === null) {
      return
    }
    viewport.scrollBy({ left: viewport.clientWidth * direction, behavior: 'smooth' })
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-2">
        <button className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-card text-foreground outline-none transition hover:border-cyan-300 hover:bg-cyan-300/10 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:pointer-events-none disabled:opacity-45" type="button" onClick={() => scrollViewport(-1)} aria-label={`Previous ${label}`} disabled={position.isAtStart}><ChevronLeft aria-hidden="true" className="size-4" /></button>
        <button className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-card text-foreground outline-none transition hover:border-cyan-300 hover:bg-cyan-300/10 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:pointer-events-none disabled:opacity-45" type="button" onClick={() => scrollViewport(1)} aria-label={`Next ${label}`} disabled={position.isAtEnd}><ChevronRight aria-hidden="true" className="size-4" /></button>
      </div>
      <div ref={viewportRef} role="region" aria-label={label} tabIndex={0} className="scrollbar-none overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2">
        <div ref={contentRef} className="flex w-max gap-3 [&>*]:snap-start">
          {children}
        </div>
      </div>
    </div>
  )
}
