import { useState } from 'react'
import { EyeOffIcon } from 'lucide-react'

/** Renders Summary identically in Preview and published Detail. */
export function ReviewSummary({ hasSpoiler, summary }: { hasSpoiler: boolean; summary: string }) {
  const [revealed, setRevealed] = useState(!hasSpoiler)
  if (summary.length === 0) return null
  if (!revealed) return <button className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-lg border border-cyan-400/60 bg-cyan-400/5 px-4 text-left font-bold text-cyan-300" onClick={() => setRevealed(true)} type="button"><EyeOffIcon className="size-5" />Reveal summary spoiler</button>
  return <p className="mt-2 text-lg italic">{summary}</p>
}
