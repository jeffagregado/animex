import { useState } from 'react'
import { HeartIcon, MessageCircleIcon, UserRoundIcon } from 'lucide-react'

import type { FeedCard as FeedCardData } from '../social/shared/social-contracts'
import { FeedOwnerActions } from './feed-owner-actions'

interface FeedCardProps {
  card: FeedCardData
  owner: boolean
  signedIn: boolean
  onEdit: (card: Extract<FeedCardData, { kind: 'post' }>) => void
  onChanged: () => void
}

const timestamp = (value: number): string => {
  const elapsed = Date.now() - value
  if (elapsed < 60_000) return 'just now'
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`
  return new Date(value).toLocaleDateString()
}

/** Renders one strict discriminated feed card. */
export function FeedCard({ card, owner, signedIn, onEdit, onChanged }: FeedCardProps) {
  const [revealed, setRevealed] = useState(false)
  const occurredAt = card.kind === 'post' ? card.createdAt : card.kind === 'review' ? card.publishedAt : card.settledAt
  const edited = (card.kind === 'post' || card.kind === 'review') && card.updatedAt > occurredAt
  return (
    <article className="rounded-xl border border-white/8 bg-card/55 p-4 shadow-lg shadow-black/10 sm:p-5">
      <header className="flex items-start gap-3">
        {card.author.avatarUrl ? <img alt={`${card.author.displayName} avatar`} className="size-11 rounded-full object-cover" src={card.author.avatarUrl} /> : <span aria-label={`${card.author.displayName} avatar`} className="grid size-11 shrink-0 place-items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 font-black text-cyan-300">{card.author.displayName.slice(0, 1).toUpperCase()}</span>}
        <div className="min-w-0 flex-1"><p className="truncate font-black">{card.author.displayName}</p><p className="text-sm text-muted-foreground">@{card.author.username} · <a className="hover:text-cyan-300 hover:underline focus-visible:ring-2 focus-visible:ring-cyan-300" href={`/feed/${card.id}`} title={new Date(occurredAt).toLocaleString()}>{timestamp(occurredAt)}</a>{edited ? ' · Edited' : ''}</p></div>
        {owner && card.kind !== 'review' ? <FeedOwnerActions card={card} onChanged={onChanged} onEdit={() => { if (card.kind === 'post') onEdit(card) }} /> : null}
      </header>
      <div className="mt-4">{renderBody(card, revealed, () => setRevealed(true))}</div>
      {signedIn ? <footer className="mt-4 flex gap-3 border-t border-white/8 pt-3"><button aria-label="Like · Coming in Phase 6" className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-muted-foreground disabled:opacity-70" disabled title="Coming in Phase 6" type="button"><HeartIcon className="size-5" />Like</button><button aria-label="Comment · Coming in Phase 6" className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-muted-foreground disabled:opacity-70" disabled title="Coming in Phase 6" type="button"><MessageCircleIcon className="size-5" />Comment</button></footer> : null}
    </article>
  )
}

const renderBody = (card: FeedCardData, revealed: boolean, reveal: () => void) => {
  if (card.kind === 'post') {
    if (card.hasSpoiler && !revealed) return <button className="min-h-24 w-full rounded-lg border border-cyan-300/30 bg-cyan-300/5 font-bold text-cyan-200 hover:bg-cyan-300/10 focus-visible:ring-2 focus-visible:ring-cyan-300" onClick={reveal} type="button">Reveal Post spoiler</button>
    return <><p className="whitespace-pre-wrap leading-7 text-slate-200">{card.text}</p>{card.imageUrls.length > 0 ? <div className={`mt-4 grid gap-2 overflow-hidden rounded-lg ${card.imageUrls.length > 1 ? 'grid-cols-2' : ''}`}>{card.imageUrls.map((url, index) => <img alt={`Post image ${index + 1}`} className="max-h-[32rem] h-full w-full object-cover" key={url} src={url} />)}</div> : null}</>
  }
  if (card.kind === 'review') return <div className="grid gap-4 sm:grid-cols-[7rem_1fr]"><a href={`/anime/${card.anime.anilistId}/${card.anime.slug}`}>{card.anime.coverImageUrl ? <img alt={`${card.anime.title} cover`} className="h-40 w-28 rounded-lg object-cover" src={card.anime.coverImageUrl} /> : <span className="grid h-40 w-28 place-items-center rounded-lg bg-white/5"><UserRoundIcon /></span>}</a><div><p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Review Rating</p><p className="text-3xl font-black text-cyan-200">{card.rating.toFixed(1)} <span className="text-base text-muted-foreground">/ 100</span></p>{card.summaryHasSpoiler && !revealed ? <button className="mt-3 min-h-11 rounded-lg border border-cyan-300/30 px-4 font-bold text-cyan-200" onClick={reveal} type="button">Reveal Summary spoiler</button> : <p className="mt-3 leading-7 text-slate-200">{card.summary}</p>}<a className="mt-3 inline-block font-bold text-cyan-300 hover:underline focus-visible:ring-2 focus-visible:ring-cyan-300" href={`/reviews/${card.reviewId}`}>Read Review</a></div></div>
  return <a className="flex gap-4 rounded-lg border border-white/8 p-3 hover:border-cyan-300/50 hover:bg-cyan-300/5 focus-visible:ring-2 focus-visible:ring-cyan-300" href={`/anime/${card.anime.anilistId}/${card.anime.slug}`}>{card.anime.coverImageUrl ? <img alt={`${card.anime.title} cover`} className="h-28 w-20 rounded-md object-cover" src={card.anime.coverImageUrl} /> : <span className="grid h-28 w-20 place-items-center rounded-md bg-white/5"><UserRoundIcon /></span>}<div><p className="text-xs font-black uppercase tracking-wider text-cyan-300">{card.kind === 'completed' ? 'Completed' : 'Rewatched'}</p><h2 className="mt-2 text-lg font-black">{card.anime.title}</h2><p className="mt-1 text-sm text-muted-foreground">View Anime Detail</p></div></a>
}
