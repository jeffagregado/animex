import { useEffect, useState } from 'react'
import { ImageOffIcon } from 'lucide-react'

interface FeedCoverImageProps {
  alt: string
  className: string
  src: string | null
}

/** Keeps anime-cover geometry stable when image loading fails. */
export function FeedCoverImage({ alt, className, src }: FeedCoverImageProps) {
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [src])

  return (
    <span className={`flex shrink-0 overflow-hidden bg-muted ${className}`}>
      {src !== null && !failed
        ? <img alt={alt} className="size-full object-cover" onError={() => setFailed(true)} src={src} />
        : <span className="flex size-full flex-col items-center justify-center gap-1 px-2 text-center text-[10px] text-muted-foreground"><ImageOffIcon aria-hidden="true" className="size-4" /><span>Image unavailable</span></span>}
    </span>
  )
}
