import { useEffect, useState } from 'react'
import { EyeOffIcon } from 'lucide-react'

type ReviewSummaryProps = {
  hasSpoiler: boolean
  summary: string
  variant: 'detail' | 'list'
}

/** Renders independently revealable Summary text for detail and compact lists. */
export function ReviewSummary({ hasSpoiler, summary, variant }: ReviewSummaryProps) {
  const [revealedSummary, setRevealedSummary] = useState<string | null>(null)
  useEffect(() => { setRevealedSummary(null) }, [hasSpoiler, summary])
  if (summary.length === 0) return null
  if (hasSpoiler && revealedSummary !== summary) return <button className={`mt-2 flex min-h-11 w-full items-center gap-2 rounded-lg border border-cyan-400/60 bg-cyan-400/5 text-left font-bold text-cyan-300 ${variant === 'list' ? 'px-3 text-sm' : 'px-4'}`} onClick={() => setRevealedSummary(summary)} type="button"><EyeOffIcon className={variant === 'list' ? 'size-4' : 'size-5'} />Reveal summary spoiler</button>
  return <p className={variant === 'list' ? 'mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground' : 'mt-2 text-lg italic'}>{summary}</p>
}
