import { Heart, MessageCircle, MoreHorizontal } from 'lucide-react'

import { feedEntries } from './home-data'

export function FeedList() {
  return (
    <section className="space-y-4" aria-label="Home feed preview">
      {feedEntries.map((entry) => (
        <article className={`feed-card feed-card--${entry.accent}`} key={`${entry.author}-${entry.animeTitle}`}>
          <div className="flex items-start gap-3">
            <div className="avatar">{entry.author.slice(0, 2).toUpperCase()}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h2 className="font-extrabold">{entry.author}</h2>
                <span className="text-muted-foreground">{entry.action}</span>
                <span className="text-sm text-muted-foreground">{entry.time}</span>
              </div>
              <p className="mt-2 max-w-3xl leading-7 text-slate-200">{entry.body}</p>
              <div className="mt-4 grid gap-4 rounded-md border border-white/8 bg-white/[0.025] p-3 sm:grid-cols-[84px_minmax(0,1fr)_auto]">
                <img className="h-28 w-20 rounded-md object-cover" src={entry.imageUrl} alt={`${entry.animeTitle} cover`} />
                <div className="min-w-0">
                  <h3 className="font-extrabold">{entry.animeTitle}</h3>
                  <p className="text-sm text-muted-foreground">{entry.animeMeta}</p>
                </div>
                {entry.score ? (
                  <div className="self-end text-right">
                    <p className="text-xs uppercase text-muted-foreground">Score</p>
                    <p className="text-3xl font-black text-cyan-300">{entry.score}</p>
                  </div>
                ) : null}
              </div>
              <div className="mt-4 flex items-center gap-6 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2 text-coral-400">
                  <Heart aria-hidden="true" className="size-5 fill-current" />
                  {entry.likes}
                </span>
                <span className="inline-flex items-center gap-2">
                  <MessageCircle aria-hidden="true" className="size-5" />
                  {entry.comments}
                </span>
              </div>
            </div>
            <button className="icon-button" type="button" aria-label="More actions">
              <MoreHorizontal aria-hidden="true" className="size-5" />
            </button>
          </div>
        </article>
      ))}
    </section>
  )
}
