import type { ReactNode } from 'react'

interface DetailPageLayoutProps {
  hero: ReactNode
  content: ReactNode
  aside: ReactNode
}

/** Provides shared responsive geometry for catalog detail pages. */
export function DetailPageLayout({ hero, content, aside }: DetailPageLayoutProps) {
  return (
    <main className="mx-auto grid max-w-[1480px] grid-cols-[minmax(0,1fr)] gap-4 px-4 pb-24 md:px-7 md:pb-12 lg:grid-cols-[minmax(0,3fr)_minmax(17rem,1fr)]">
      <div className="min-w-0">
        {hero}
        {content}
      </div>
      {aside}
    </main>
  )
}
