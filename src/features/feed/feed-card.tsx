import { useState, type ReactNode } from 'react'
import { CheckIcon, FileTextIcon, HeartIcon, MessageCircleIcon, Repeat2Icon, StarIcon } from 'lucide-react'

import type { FeedCard as FeedCardData } from '../social/shared/social-contracts'
import { FeedCoverImage } from './feed-cover-image'
import { FeedOwnerActions } from './feed-owner-actions'

interface FeedCardProps {
  card: FeedCardData
  owner: boolean
  signedIn: boolean
  onEdit: (card: Extract<FeedCardData, { kind: 'post' }>) => void
  onChanged: () => void
}

const relativeTime = (value: number): string => {
  const seconds = Math.max(0, Math.floor((Date.now() - value) / 1_000))
  if (seconds < 60) return 'now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

const activityText = (card: FeedCardData): string => {
  if (card.kind === 'post') return `${card.author.displayName} posted`
  if (card.kind === 'review') return `${card.author.displayName} reviewed ${card.anime.title}`
  if (card.kind === 'completed') return `${card.author.displayName} completed ${card.anime.title}`
  return `${card.author.displayName} rewatched ${card.anime.title}`
}

const activityIcon = (card: FeedCardData): ReactNode => {
  const className = `size-4 ${card.kind === 'post' ? 'text-coral-400' : 'text-cyan-300'}`
  if (card.kind === 'post') return <FileTextIcon aria-hidden="true" className={className} />
  if (card.kind === 'review') return <StarIcon aria-hidden="true" className={className} />
  if (card.kind === 'completed') return <CheckIcon aria-hidden="true" className={className} />
  return <Repeat2Icon aria-hidden="true" className={className} />
}

/** Renders one strict discriminated feed card. */
export function FeedCard({ card, owner, signedIn, onEdit, onChanged }: FeedCardProps) {
  const [revealed, setRevealed] = useState(false)
  const occurredAt = card.kind === 'post' ? card.createdAt : card.kind === 'review' ? card.publishedAt : card.settledAt
  const edited = (card.kind === 'post' || card.kind === 'review') && card.updatedAt > occurredAt
  const accent = card.kind === 'post' ? 'border-l-coral-400' : 'border-l-cyan-300'

  return (
    <article className={`rounded-lg border border-white/8 border-l-2 ${accent} bg-card/55 px-4 py-3 shadow-lg shadow-black/10 transition hover:border-y-white/15 hover:border-r-white/15 sm:px-5`}>
      <header className="flex min-w-0 items-center gap-3">
        <span className={`grid size-9 shrink-0 place-items-center rounded-full border ${card.kind === 'post' ? 'border-coral-400/35 bg-coral-400/10' : 'border-cyan-300/35 bg-cyan-300/10'}`}>{activityIcon(card)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-100">{activityText(card)}</p>
          <a className="inline-flex rounded text-xs text-muted-foreground hover:text-cyan-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" href={`/feed/${card.id}`} title={new Date(occurredAt).toISOString()}><time dateTime={new Date(occurredAt).toISOString()}>{relativeTime(occurredAt)}</time>{edited ? ' · Edited' : ''}</a>
        </div>
        {owner ? <FeedOwnerActions card={card} onChanged={onChanged} onEdit={() => { if (card.kind === 'post') onEdit(card) }} /> : null}
      </header>
      <div className="mt-3">{renderBody(card, revealed, () => setRevealed(true))}</div>
      {signedIn ? <footer className="mt-3 flex gap-2 border-t border-white/8 pt-2"><button aria-label="Like · Coming in Phase 6" className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-70" disabled title="Coming in Phase 6" type="button"><HeartIcon className="size-4" />Like</button><button aria-label="Comment · Coming in Phase 6" className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-70" disabled title="Coming in Phase 6" type="button"><MessageCircleIcon className="size-4" />Comment</button></footer> : null}
    </article>
  )
}

const renderBody = (card: FeedCardData, revealed: boolean, reveal: () => void): ReactNode => {
  if (card.kind === 'post') {
    if (card.hasSpoiler && !revealed) return <button className="min-h-24 w-full rounded-lg border border-cyan-300/30 bg-cyan-300/5 font-bold text-cyan-200 hover:bg-cyan-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" onClick={reveal} type="button">Reveal Post spoiler</button>
    return <><p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">{card.text}</p>{card.imageUrls.length > 0 ? <div className={`mt-3 grid gap-2 overflow-hidden rounded-lg ${card.imageUrls.length > 1 ? 'grid-cols-2' : ''}`}>{card.imageUrls.map((url, index) => <img alt={`Post image ${index + 1}`} className={`${card.imageUrls.length === 1 ? 'aspect-video' : 'aspect-square'} max-h-[32rem] w-full object-cover`} key={url} src={url} />)}</div> : null}</>
  }
  if (card.kind === 'review') return <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4 sm:grid-cols-[6rem_minmax(0,1fr)]"><a className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" href={`/anime/${card.anime.anilistId}/${card.anime.slug}`}><FeedCoverImage alt={`${card.anime.title} cover`} className="aspect-[2/3] w-20 rounded-lg sm:w-24" src={card.anime.coverImageUrl} /></a><div className="min-w-0"><h2 className="truncate font-black">{card.anime.title}</h2><p className="mt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Rating</p><p className="text-2xl font-black tabular-nums text-cyan-300">{card.rating.toFixed(card.rating % 1 === 0 ? 0 : 1)}<span className="text-sm font-medium text-muted-foreground"> / 100</span></p>{card.summaryHasSpoiler && !revealed ? <button className="mt-2 min-h-11 rounded-lg border border-cyan-300/30 px-4 text-sm font-bold text-cyan-200 hover:bg-cyan-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" onClick={reveal} type="button">Reveal Summary spoiler</button> : <p className="mt-2 text-sm leading-6 text-slate-200">{card.summary}</p>}<a className="mt-2 inline-flex rounded text-sm font-bold text-cyan-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" href={`/reviews/${card.reviewId}`}>Read Review</a></div></div>
  return <a className="flex gap-4 rounded-lg border border-white/8 p-3 outline-none transition hover:border-cyan-300/50 hover:bg-cyan-300/5 focus-visible:ring-2 focus-visible:ring-cyan-300" href={`/anime/${card.anime.anilistId}/${card.anime.slug}`}><FeedCoverImage alt={`${card.anime.title} cover`} className="aspect-[2/3] w-16 rounded-md" src={card.anime.coverImageUrl} /><div className="min-w-0"><p className="text-xs font-black uppercase tracking-wider text-cyan-300">{card.kind === 'completed' ? 'Completed' : 'Rewatched'}</p><h2 className="mt-1 line-clamp-2 font-black">{card.anime.title}</h2><p className="mt-1 text-sm text-muted-foreground">View Anime Detail</p></div></a>
}
