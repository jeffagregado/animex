import { useEffect, useState } from 'react'
import { EyeOffIcon } from 'lucide-react'

/** Renders Summary identically in Preview and published Detail. */
export function ReviewSummary({ hasSpoiler, summary }: { hasSpoiler: boolean; summary: string }) {
  const [revealedSummary, setRevealedSummary] = useState<string | null>(null)
  useEffect(() => { setRevealedSummary(null) }, [hasSpoiler, summary])
  if (summary.length === 0) return null
  if (hasSpoiler && revealedSummary !== summary) return <button className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-lg border border-cyan-400/60 bg-cyan-400/5 px-4 text-left font-bold text-cyan-300" onClick={() => setRevealedSummary(summary)} type="button"><EyeOffIcon className="size-5" />Reveal summary spoiler</button>
  return <p className="mt-2 text-lg italic">{summary}</p>
}
