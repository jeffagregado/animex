import { useState } from 'react'

type AnimeImageProps = { alt: string; className: string; src: string | null }

/** Preserves image geometry while exposing unavailable artwork. */
export function AnimeImage({ alt, className, src }: AnimeImageProps) {
  const [failed, setFailed] = useState(false)
  if (src === null || failed) return <div role="img" aria-label={`${alt} unavailable`} className={`${className} grid place-items-center bg-white/5 p-3 text-center text-xs text-muted-foreground`}>Image unavailable</div>
  return <img alt={alt} className={className} src={src} onError={() => setFailed(true)} />
}
