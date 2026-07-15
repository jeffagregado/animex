import { useState } from 'react'
import { MessageCircleIcon, ThumbsUpIcon } from 'lucide-react'

import type { ReviewListItem } from '#/features/social/shared/social-contracts'

/** Shows Anime Reviews list metadata without loading full body JSON. */
export function ReviewCard({ review, signedIn }: { review: ReviewListItem; signedIn: boolean }) {
  const [revealed, setRevealed] = useState(!review.containsSpoiler)
  const date = new Date(review.publishedAt ?? review.updatedAt).toLocaleDateString()
  return <article className="rounded-xl border border-border bg-card/40 p-5"><div className="flex items-start gap-3"><Avatar review={review} /><div className="min-w-0 flex-1"><a className="font-black hover:text-cyan-300" href={`/reviews/${review.id}`}>{review.author.displayName}</a><p className="text-sm text-muted-foreground">@{review.author.username} · {date}</p></div><p className="text-2xl font-black text-cyan-300">{review.rating?.toFixed(1)}<span className="text-sm font-normal text-muted-foreground"> / 100</span></p></div>{revealed ? <p className="mt-4 leading-7">{review.summary}</p> : <button className="mt-4 min-h-11 w-full rounded-lg border border-cyan-400/60 bg-cyan-400/5 px-4 text-left font-bold text-cyan-300" onClick={() => setRevealed(true)} type="button">Reveal summary spoiler</button>}{signedIn ? <div className="mt-4 flex gap-2 border-t border-border pt-3"><button className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-muted-foreground" disabled title="Coming in Phase 6" type="button"><ThumbsUpIcon className="size-4" />Like · Coming in Phase 6</button><button className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-muted-foreground" disabled title="Coming in Phase 6" type="button"><MessageCircleIcon className="size-4" />Comment · Coming in Phase 6</button></div> : null}</article>
}

function Avatar({ review }: { review: ReviewListItem }) {
  return review.author.avatarUrl ? <img alt={`${review.author.displayName} avatar`} className="size-11 rounded-full border border-border object-cover" src={review.author.avatarUrl} /> : <span aria-label={`${review.author.displayName} avatar unavailable`} className="grid size-11 rounded-full border border-border bg-cyan-300/10 font-black text-cyan-300">{review.author.displayName.slice(0, 1).toUpperCase()}</span>
}
